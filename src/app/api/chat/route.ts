import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { nextQuestion, extractProfileDelta, type StudentContext } from "@/core/ai";
import { mergeProfile, computeCompleteness, type ProfileDelta } from "@/core/profile-builder";
import type { ChatMessage } from "@/lib/groq";
import type { StudentProfile, InterestCluster, GoalOrientation, BudgetBand, LocationPref } from "@/types/profile";
import { INTEREST_CLUSTERS } from "@/types/profile";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  stage: z.string().min(1).max(40),
  message: z.string().max(2000).optional(),
  isChoice: z.boolean().optional(),
});

// ── Gap state machine (SERVER-SIDE, single source of truth) ───────────────────
const MAX_FAILS_CORE = 5;
const MAX_FAILS_SOFT = 3;
const HARD_TURN_CEILING = 14;
type GapState = Record<string, {
  asks: number;
  fails: number;
  permissionAsked?: boolean;
  permissionGranted?: boolean;
}>;

function readGapState(profile: unknown): GapState {
  const g = (profile as { _gapState?: GapState } | null)?._gapState;
  return g && typeof g === "object" ? g : {};
}

// Pending choices: maps button label → { value, gapId } saved after each AI question.
// When a student clicks a button, the server looks up this map to get the profile delta
// without any LLM call. Cleared when the student sends a message; refreshed after each
// new AI question.
type PendingChoice = { value: string; gapId: string };
type PendingChoices = Record<string, PendingChoice>;

function readPendingChoices(profile: unknown): PendingChoices {
  const p = (profile as { _pendingChoices?: unknown } | null)?._pendingChoices;
  return p && typeof p === "object" ? p as PendingChoices : {};
}

// Convert a pending choice value to a ProfileDelta based on which gap is being asked.
function pendingChoiceToProfile(value: string, gapId: string): ProfileDelta | null {
  if (!value) return null;
  switch (gapId) {
    case "subjects":
      return { academic: { strongSubjects: [value] } };

    case "interest": {
      const cluster = INTEREST_CLUSTERS.includes(value as InterestCluster)
        ? (value as InterestCluster)
        : findClosestCluster(value);
      return cluster ? { interests: { [cluster]: 0.8 } } : null;
    }

    case "goal": {
      const valid: GoalOrientation[] = ["higher_study", "job_soon", "business", "government"];
      return valid.includes(value as GoalOrientation)
        ? { aspiration: { goalOrientation: value as GoalOrientation } }
        : null;
    }

    case "priorities":
      return { aspiration: { careerPriorities: [value] } };

    case "budget": {
      const valid: BudgetBand[] = ["low", "medium", "high", "no_constraint"];
      return valid.includes(value as BudgetBand)
        ? { constraints: { budgetBand: value as BudgetBand } }
        : null;
    }

    case "location": {
      const valid: LocationPref[] = ["kerala", "india", "abroad"];
      return valid.includes(value as LocationPref)
        ? { constraints: { locationPref: value as LocationPref } }
        : null;
    }

    case "family":
      return { constraints: { familyExpectations: [value] } };

    case "workstyle":
      if (value === "social") return { personality: { social: 0.8 } };
      if (value === "analytical_solo") return { personality: { social: -0.7, analytical: 0.7 } };
      if (value === "practical_outdoor") return { personality: { practical: 0.8, social: -0.2 } };
      if (value === "mixed") return { personality: { social: 0.2 } };
      return null;

    default:
      return null;
  }
}

// Fuzzy fallback for interest cluster values: if the AI returns a non-standard string,
// map it to the closest valid cluster rather than dropping the signal.
function findClosestCluster(value: string): InterestCluster | null {
  const lower = value.toLowerCase().replace(/[_-]/g, " ");
  for (const c of INTEREST_CLUSTERS) {
    if (lower === c.replace(/_/g, " ")) return c;
  }
  const keywords: Record<string, InterestCluster> = {
    tech: "technology_coding", coding: "technology_coding", software: "technology_coding",
    computer: "technology_coding", programming: "technology_coding", it: "technology_coding",
    health: "health_medicine", medicine: "health_medicine", medical: "health_medicine",
    doctor: "health_medicine", nurse: "health_medicine", hospital: "health_medicine",
    business: "business_money", money: "business_money", finance: "business_money",
    commerce: "business_money", entrepreneur: "business_money",
    science: "science_research", research: "science_research", lab: "science_research",
    design: "design_visual", art: "design_visual", visual: "design_visual",
    creative: "design_visual", drawing: "design_visual",
    teach: "helping_teaching", education: "helping_teaching", counsel: "helping_teaching",
    social: "helping_teaching", welfare: "helping_teaching",
    law: "law_justice", legal: "law_justice", justice: "law_justice",
    advocate: "law_justice", rights: "law_justice",
    build: "building_engineering", engineer: "building_engineering",
    construct: "building_engineering", architecture: "building_engineering",
    media: "media_communication", journalism: "media_communication",
    film: "media_communication", content: "media_communication",
    nature: "nature_agriculture", farm: "nature_agriculture", agri: "nature_agriculture",
    environment: "nature_agriculture", wildlife: "nature_agriculture",
    defence: "defence_adventure", defense: "defence_adventure", army: "defence_adventure",
    military: "defence_adventure", adventure: "defence_adventure", police: "defence_adventure",
    number: "numbers_analysis", math: "numbers_analysis", stat: "numbers_analysis",
    data: "numbers_analysis", analys: "numbers_analysis", account: "numbers_analysis",
  };
  for (const [kw, cluster] of Object.entries(keywords)) {
    if (lower.includes(kw)) return cluster;
  }
  return null;
}

const GAP_IDS = [
  "subjects", "interest", "goal", "priorities", "budget", "location", "family", "workstyle",
] as const;
type GapId = (typeof GAP_IDS)[number];

function capturedDims(p?: Partial<StudentProfile> | null) {
  return {
    subjects: (p?.academic?.strongSubjects?.length ?? 0) > 0,
    // Threshold 0.6: start-quiz saves at 0.5 (shallow, needs chat deepening).
    // Chat extractions land at 0.6+ once the student says something concrete.
    interest: Object.values(p?.interests ?? {}).some((v) => (v ?? 0) >= 0.6),
    goal: !!p?.aspiration?.goalOrientation,
    priorities: (p?.aspiration?.careerPriorities?.length ?? 0) > 0,
    budget: !!p?.constraints?.budgetBand,
    location: !!p?.constraints?.locationPref,
    family: (p?.constraints?.familyExpectations?.length ?? 0) > 0,
    workstyle: Object.values(p?.personality ?? {}).some((v) => Math.abs((v as number) ?? 0) > 0.2),
  } satisfies Record<GapId, boolean>;
}

function countCaptured(p?: Partial<StudentProfile> | null): number {
  return Object.values(capturedDims(p)).filter(Boolean).length;
}

// Maps a stated career name to the most relevant interest cluster.
function inferInterestFromCareer(career: string): Record<string, number> | null {
  const c = career.toLowerCase();
  if (/doctor|medicine|mbbs|nursing|medical|physician|surgeon|dentist|pharmacist|hospital|physiotherapy|healthcare|paramedic/.test(c))
    return { health_medicine: 0.7 };
  if (/software|developer|programmer|coding|engineer|tech|computer|information technology|app|web|data science|artificial intelligence|machine learning|cyber/.test(c))
    return { technology_coding: 0.7 };
  if (/business|entrepreneur|management|marketing|finance|accounting|commerce|startup|ceo|mba|economics/.test(c))
    return { business_money: 0.7 };
  if (/lawyer|law|legal|advocate|judge|solicitor|ias|upsc|psc|civil service|government service/.test(c))
    return { law_justice: 0.7 };
  if (/teacher|teaching|education|professor|lecturer|trainer|counsellor/.test(c))
    return { helping_teaching: 0.7 };
  if (/design|architect|graphic|animation|fashion|interior|ui|ux|visual art/.test(c))
    return { design_visual: 0.7 };
  if (/scientist|research|biology|chemistry|physics|biotech|bioinformatics|ecology|geology/.test(c))
    return { science_research: 0.7 };
  if (/army|navy|air force|military|nda|defence|defense|police|soldier|officer/.test(c))
    return { defence_adventure: 0.7 };
  if (/farmer|agriculture|environment|animal|vet|wildlife|forest|horticulture/.test(c))
    return { nature_agriculture: 0.7 };
  if (/journalist|media|film|acting|writer|content|communication|public relations|journalism|broadcasting/.test(c))
    return { media_communication: 0.7 };
  if (/chartered accountant|ca\b|actuary|financial analyst|statistician|data analyst/.test(c))
    return { numbers_analysis: 0.7 };
  if (/civil engineer|mechanical engineer|electrical engineer|construction|architecture/.test(c))
    return { building_engineering: 0.7 };
  return null;
}

// Persist gap state, lastGap, permission flag, and pending choices to the profile.
async function persistGapState(
  db: ReturnType<typeof getServiceClient>,
  sessionId: string,
  gapState: GapState,
  topGapId: GapId | null,
  askingPermission: boolean,
  pendingChoices: PendingChoices = {}
) {
  const { data: profRow } = await db
    .from("student_profiles")
    .select("profile")
    .eq("session_id", sessionId)
    .maybeSingle();
  const cur = (profRow?.profile ?? {}) as Record<string, unknown>;
  cur._gapState = gapState;
  cur._lastGap = topGapId;
  cur._askingPermission = askingPermission;
  cur._pendingChoices = pendingChoices;
  await db.from("student_profiles")
    .update({ profile: cur, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}

// POST /api/chat
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid chat payload", parsed.error.flatten());

  const { sessionId, stage, message, isChoice } = parsed.data;
  const limited = await enforceRateLimit(limiters.chat, "chat", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();
  let filledThisTurn = false;
  const answered = !!(message && message.trim());

  try {
    // 1. Persist the student's message (if any) and extract structured signals.
    if (message && message.trim()) {
      const { data: lastQ } = await db
        .from("conversations")
        .select("content")
        .eq("session_id", sessionId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const precedingQuestion = lastQ?.content as string | undefined;

      await db.from("conversations").insert({ session_id: sessionId, role: "user", stage, content: message });

      const { data: prevRow } = await db
        .from("student_profiles")
        .select("profile")
        .eq("session_id", sessionId)
        .maybeSingle();
      const prevProfile = prevRow?.profile as Partial<StudentProfile> | null;

      const wasAskingPermission = !!(prevProfile as Record<string, unknown> | null)?._askingPermission;
      const isPermissionButton = wasAskingPermission && isChoice &&
        (message === "Let's move on" || message === "Keep exploring this");

      let delta: ProfileDelta | null = null;
      let extractModel = "direct-choice";

      if (!isPermissionButton) {
        if (isChoice) {
          // Look up saved pending choices from the previous AI turn.
          const pending = readPendingChoices(prevProfile);
          const match = pending[message];
          if (match) {
            delta = pendingChoiceToProfile(match.value, match.gapId);
          }
        }
        if (!delta) {
          const result = await extractProfileDelta({ reply: message, stage, precedingQuestion });
          delta = result.delta;
          extractModel = result.model;
        }
      }

      if (delta) {
        const merged = mergeProfile(prevProfile, delta);
        filledThisTurn = countCaptured(merged) > countCaptured(prevProfile);
        const prevMeta = prevProfile as Record<string, unknown> | null;
        const mergedWithState = {
          ...merged,
          _gapState: readGapState(prevProfile),
          _lastGap: prevMeta?._lastGap,
          _askingPermission: prevMeta?._askingPermission,
          // Clear pending choices after they've been consumed.
          _pendingChoices: {},
        };
        await db.from("student_profiles").upsert(
          {
            session_id: sessionId,
            profile: mergedWithState,
            completeness_pct: computeCompleteness(merged),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );
      }
      await db.from("conversations").update({ model: extractModel }).eq("session_id", sessionId).eq("role", "user").eq("content", message);
    }

    // 2. Load recent history for context.
    const { data: history } = await db
      .from("conversations")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const chatHistory: ChatMessage[] = (history ?? []).map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    }));

    // 3. Fetch current profile for AI context.
    const { data: ctxRow } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    let ctxProfile = ctxRow?.profile as Partial<StudentProfile> | null;

    // When the student named a specific career but no interest cluster was captured
    // yet, infer the cluster from the career name and persist it.
    {
      const sc = ctxProfile?.aspiration?.statedCareer;
      const hasCluster = Object.values(ctxProfile?.interests ?? {}).some(v => (v ?? 0) >= 0.3);
      if (sc && !hasCluster) {
        const inferred = inferInterestFromCareer(sc);
        if (inferred) {
          const merged = mergeProfile(ctxProfile, { interests: inferred });
          await db.from("student_profiles").upsert(
            {
              session_id: sessionId,
              profile: merged,
              completeness_pct: computeCompleteness(merged),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "session_id" }
          );
          ctxProfile = merged;
        }
      }
    }

    const STREAM_LABELS: Record<string, string> = {
      science_bio: "Science (Biology)",
      science_maths: "Science (Maths)",
      science_cs: "Science (Computer Science)",
      commerce: "Commerce",
      humanities: "Humanities / Arts",
    };

    const INTEREST_LABELS: Record<string, string> = {
      technology_coding: "technology / coding",
      health_medicine: "health / medicine",
      business_money: "business / entrepreneurship",
      science_research: "science / research",
      design_visual: "design / arts",
      helping_teaching: "teaching / helping others",
      law_justice: "law / justice",
      building_engineering: "engineering / construction",
      media_communication: "media / communication",
      nature_agriculture: "nature / agriculture",
      defence_adventure: "defence / adventure",
      numbers_analysis: "mathematics / data analysis",
    };

    // Deep interests (>= 0.6): gap is closed — AI must not re-ask.
    // Shallow interests (0.2–0.59): captured from start quiz, needs chat deepening.
    const detectedInterests = Object.entries(ctxProfile?.interests ?? {})
      .filter(([, v]) => (v ?? 0) >= 0.6)
      .map(([k]) => INTEREST_LABELS[k] ?? k);
    const shallowInterestEntry = Object.entries(ctxProfile?.interests ?? {})
      .find(([, v]) => (v ?? 0) >= 0.2 && (v ?? 0) < 0.6);
    const shallowInterest = shallowInterestEntry
      ? (INTEREST_LABELS[shallowInterestEntry[0]] ?? shallowInterestEntry[0])
      : undefined;

    const statedCareer = ctxProfile?.aspiration?.statedCareer ?? undefined;

    const hasPersonalityData = Object.values(ctxProfile?.personality ?? {}).some(
      (v) => Math.abs((v as number) ?? 0) > 0.2
    );

    const interests = ctxProfile?.interests ?? {};
    const relevantExams = new Set<string>();
    if ((interests.technology_coding ?? 0) >= 0.2 || (interests.numbers_analysis ?? 0) >= 0.2) {
      relevantExams.add("JEE"); relevantExams.add("KEAM");
    }
    if ((interests.health_medicine ?? 0) >= 0.2) relevantExams.add("NEET");
    if ((interests.science_research ?? 0) >= 0.2 || (interests.nature_agriculture ?? 0) >= 0.2) {
      relevantExams.add("CUET"); relevantExams.add("IISER Aptitude Test"); relevantExams.add("NEST");
    }
    if ((interests.law_justice ?? 0) >= 0.2) relevantExams.add("CLAT");
    if ((interests.business_money ?? 0) >= 0.2) {
      relevantExams.add("CUET"); relevantExams.add("IPMAT");
    }
    if ((interests.design_visual ?? 0) >= 0.2) {
      relevantExams.add("NID DAT"); relevantExams.add("NIFT");
    }
    if ((interests.defence_adventure ?? 0) >= 0.2) {
      relevantExams.add("NDA"); relevantExams.add("CDS");
    }
    if ((interests.helping_teaching ?? 0) >= 0.2 || (interests.media_communication ?? 0) >= 0.2) {
      relevantExams.add("CUET");
    }
    const relevantExamsList = Array.from(relevantExams);

    const capturedFamilyExpectations = (ctxProfile?.constraints?.familyExpectations?.length ?? 0) > 0;

    const captured = capturedDims(ctxProfile);
    const sc = ctxProfile?.aspiration?.statedCareer;

    const CORE_GAPS = new Set<GapId>(["subjects", "interest", "goal"]);

    const gapState = readGapState(ctxProfile);
    const wasAskingPermissionLastTurn = !!(ctxProfile as Record<string, unknown> | null)?._askingPermission;

    const prevTopGap = (ctxProfile as { _lastGap?: GapId } | null)?._lastGap;

    if (answered) {
      if (prevTopGap && GAP_IDS.includes(prevTopGap)) {
        const gs = (gapState[prevTopGap] ??= { asks: 0, fails: 0 });
        if (wasAskingPermissionLastTurn) {
          gs.permissionAsked = true;
          if (message === "Let's move on") gs.permissionGranted = true;
        } else {
          gs.asks += 1;
          if (!filledThisTurn) gs.fails += 1;
        }
      }
    }

    const GAP_PROMPTS: Record<GapId, string> = {
      subjects: "which specific subjects they enjoy most or score best in — 4 stream-appropriate subject names; value = exact subject name",
      interest: `what specific field or activity they would most enjoy — 4 concrete activity-based choices tailored to their stream and captured subjects; value = interest cluster ID`,
      goal: "their goal after school — study further, job, govt exams, or business; value = higher_study | job_soon | business | government",
      priorities: "what matters most in a career — salary/growth, stability, passion, or government; value = high_salary | job_security | passion | government_service",
      budget: "whether study costs are a concern for their family; value = no_constraint | medium | low",
      location: "whether they can move to another city or abroad to study; value = kerala | india | abroad",
      family: "whether their family has strong expectations about their career; value = none | some_preference | family_preference",
      workstyle: "how they prefer to work — with people, solo, or outdoors; value = social | analytical_solo | practical_outdoor | mixed",
    };

    const askableGaps = GAP_IDS.filter((id) => {
      if (captured[id]) return false;
      const gs = gapState[id];
      if (CORE_GAPS.has(id)) return !gs?.permissionGranted;
      if (!gs) return true;
      return gs.fails < MAX_FAILS_SOFT;
    });
    const topGapId: GapId | null = askableGaps[0] ?? null;
    const remainingGaps: string[] = askableGaps.map((id) => GAP_PROMPTS[id]);

    const topGapGs = topGapId ? (gapState[topGapId] ?? { asks: 0, fails: 0 }) : null;
    const shouldAskPermission =
      topGapId !== null &&
      CORE_GAPS.has(topGapId) &&
      !captured[topGapId] &&
      (topGapGs?.fails ?? 0) >= MAX_FAILS_CORE &&
      !topGapGs?.permissionAsked;

    const capturedCount = countCaptured(ctxProfile);
    const coreCaptured = captured.subjects && captured.interest && captured.goal;
    const answeredCount = (history ?? []).filter((h) => h.role === "user").length;
    const done =
      (coreCaptured && captured.priorities && captured.family && capturedCount >= 5) ||
      (coreCaptured && captured.priorities && answeredCount >= 8) ||
      askableGaps.length === 0 ||
      answeredCount >= HARD_TURN_CEILING;

    // Early return: done — persist gap state before returning.
    if (answered && done) {
      await persistGapState(db, sessionId, gapState, topGapId, false);
      await db.from("sessions")
        .update({ status: "in_chat", updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return NextResponse.json({ done: true, stage });
    }

    // Permission question — hardcoded, no AI call. Persist gap state before returning.
    if (shouldAskPermission) {
      await persistGapState(db, sessionId, gapState, topGapId, true);
      const permQ = "That's completely fine — it's a big decision! Should we keep exploring this, or move on for now?";
      await db.from("conversations").insert({
        session_id: sessionId, role: "assistant", stage, content: permQ, model: "hardcoded",
      });
      await db.from("sessions")
        .update({ status: "in_chat", updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return NextResponse.json({
        question: permQ,
        stage,
        choices: ["Keep exploring this", "Let's move on"],
        gapId: topGapId,
        done: false,
      });
    }

    const isFollowUp = answered &&
      topGapId !== null &&
      prevTopGap === topGapId &&
      !captured[topGapId] &&
      !wasAskingPermissionLastTurn;

    const rawStream = ctxProfile?.academic?.stream as string | undefined;
    const studentName = (ctxProfile as Record<string, unknown> | null)?._name as string | undefined;
    const studentContext: StudentContext = {
      stream: rawStream ? (STREAM_LABELS[rawStream] ?? rawStream) : undefined,
      percentage: ctxProfile?.academic?.percentage,
      studentName: studentName || undefined,
      statedCareer: statedCareer || undefined,
      knownGoal: ctxProfile?.aspiration?.goalOrientation,
      knownBudget: ctxProfile?.constraints?.budgetBand,
      knownLocation: ctxProfile?.constraints?.locationPref,
      detectedInterests: detectedInterests.length > 0 ? detectedInterests : undefined,
      shallowInterest: shallowInterest || undefined,
      strongSubjects: (ctxProfile?.academic?.strongSubjects?.length ?? 0) > 0
        ? (ctxProfile?.academic?.strongSubjects ?? undefined)
        : undefined,
      careerPriorities: (ctxProfile?.aspiration?.careerPriorities?.length ?? 0) > 0
        ? (ctxProfile?.aspiration?.careerPriorities ?? undefined)
        : undefined,
      hasPersonalityData,
      remainingGaps: remainingGaps.length > 0 ? remainingGaps : undefined,
      relevantExams: relevantExamsList.length > 0 ? relevantExamsList : undefined,
      capturedFamilyExpectations: capturedFamilyExpectations || undefined,
      followUp: isFollowUp || undefined,
    };

    // 4. Ask the next question (AI generates choices with label + value).
    const q = await nextQuestion({ stage, history: chatHistory, studentContext });

    // Build the pending choices map from the AI's structured response.
    // This is saved to profile so the next button click can skip LLM extraction.
    const newPendingChoices: PendingChoices = {};
    for (const c of q.choices) {
      if (c.label && c.value && topGapId) {
        newPendingChoices[c.label] = { value: c.value, gapId: topGapId };
      }
    }

    // Persist gap state + pending choices together (one DB write).
    await persistGapState(db, sessionId, gapState, topGapId, false, newPendingChoices);

    await db.from("conversations").insert({
      session_id: sessionId, role: "assistant", stage, content: q.content,
      model: q.model, prompt_tokens: q.promptTokens, output_tokens: q.outputTokens,
    });
    await db.from("sessions")
      .update({ status: "in_chat", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    // Return labels only to the client — values stay server-side in _pendingChoices.
    const choiceLabels = q.choices.map((c) => c.label);

    return NextResponse.json({ question: q.content, stage, choices: choiceLabels, gapId: topGapId, done: false });
  } catch (e) {
    console.error(e);
    return serverError("Chat failed");
  }
}
