import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { nextQuestion, extractProfileDelta, type StudentContext } from "@/core/ai";
import { mergeProfile, computeCompleteness, type ProfileDelta } from "@/core/profile-builder";
import {
  activitiesForStream, drawnToChoices, choiceLabelToCluster,
} from "@/core/interest-questions";
import type { ChatMessage } from "@/lib/groq";
import type { StudentProfile } from "@/types/profile";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  stage: z.string().min(1).max(40),
  message: z.string().max(2000).optional(),
  // true when the student clicked a predefined choice button — skips LLM extraction
  // and writes the profile delta directly, saving ~600ms per turn.
  isChoice: z.boolean().optional(),
});

// ── Gap state machine (SERVER-SIDE, single source of truth) ───────────────────
// Core gaps (subjects, interest, goal): keep asking until captured. Each follow-up
// builds on what the student said — a different angle, not a repeat. After
// MAX_FAILS_CORE vague turns on the same gap, ask the student for permission to
// move on. If yes → skip. If no or neutral → keep trying until hard ceiling.
// Permission is asked at most once per gap.
//
// Soft gaps (priorities, budget, location, family, workstyle): after
// MAX_FAILS_SOFT vague answers, silently soft-skip and move on.
//
// State rides inside the profile JSON (_gapState). _lastGap marks which gap the
// last question targeted. _askingPermission flags that the last question was a
// permission question so the next turn can parse the response correctly.
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

// The eight profile dimensions the chat tries to fill, in priority order.
const GAP_IDS = [
  "subjects", "interest", "goal", "priorities", "budget", "location", "family", "workstyle",
] as const;
type GapId = (typeof GAP_IDS)[number];

// Which profile dimensions are currently captured. Shared by the gap builder
// (what to ask next) and the "enough captured?" stop check.
function capturedDims(p?: Partial<StudentProfile> | null) {
  return {
    subjects: (p?.academic?.strongSubjects?.length ?? 0) > 0,
    interest: Object.values(p?.interests ?? {}).some((v) => (v ?? 0) >= 0.3),
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

// Maps predefined choice button labels to profile deltas without an LLM call.
// Only covers the fixed choice sets shown in the UI. Falls back to LLM extraction
// for anything typed in the "Other" field.
function directDeltaFromChoice(message: string): ProfileDelta | null {
  const fieldMap: Record<string, string> = {
    "Technology / computers": "technology_coding",
    "Medicine / healthcare": "health_medicine",
    "Science / research": "science_research",
    "Business / commerce": "business_money",
    "Design / arts": "design_visual",
    "Teaching / social work": "helping_teaching",
    "Law / justice": "law_justice",
    "Nature / environment": "nature_agriculture",
    "Defence / adventure": "defence_adventure",
  };
  if (fieldMap[message]) return { interests: { [fieldMap[message]]: 0.7 } };

  // Two-phase pinned interest choices (stream-tailored activities + drawn-to).
  const pinnedCluster = choiceLabelToCluster(message);
  if (pinnedCluster) return { interests: { [pinnedCluster]: 0.8 } };

  const subjectMap: Record<string, string> = {
    "Mathematics": "Mathematics", "Maths": "Mathematics",
    "Physics": "Physics", "Chemistry": "Chemistry", "Biology": "Biology",
    "Computer Science": "Computer Science", "Computer science": "Computer Science",
    "Accountancy": "Accountancy", "Business Studies": "Business Studies",
    "Economics": "Economics", "English": "English",
    "English / Literature": "English", "History": "History",
    "History / Political Science": "History", "Political Science": "Political Science",
    "Psychology": "Psychology", "Geography": "Geography",
    "Fine Arts / Design": "Fine Arts", "Social Science": "Social Science",
  };
  if (subjectMap[message]) return { academic: { strongSubjects: [subjectMap[message]] } };

  if (message === "High salary and fast growth") return { aspiration: { careerPriorities: ["high_salary"] } };
  if (message === "Stable job and job security") return { aspiration: { careerPriorities: ["job_security"] } };
  if (message === "Work I am passionate about") return { aspiration: { careerPriorities: ["passion"] } };
  if (message === "Government or public service job") return { aspiration: { careerPriorities: ["government"] } };

  if (message === "My family has a preference") return { constraints: { familyExpectations: ["family has career preference"] } };
  if (message === "I already have a career in mind") return null;
  if (message === "Still figuring it out") return { interests: {} };
  if (message === "A few options, not sure which") return null;

  if (message === "Study further (BTech / BSc / degree)") return { aspiration: { goalOrientation: "higher_study" } };
  if (message === "Find a job quickly") return { aspiration: { goalOrientation: "job_soon" } };
  if (message === "Govt exams (PSC / UPSC)") return { aspiration: { goalOrientation: "government" } };
  if (message === "Start my own business") return { aspiration: { goalOrientation: "business" } };

  if (message === "With people (patients / students / clients)") return { personality: { social: 0.8 } };
  if (message === "Solo work (coding / writing / research)") return { personality: { social: -0.7, analytical: 0.7 } };
  if (message === "Outdoors / fieldwork / hands-on") return { personality: { practical: 0.8, social: -0.2 } };
  if (message === "Mix of both") return { personality: { social: 0.2 } };

  if (message === "Comfortable — no problem") return { constraints: { budgetBand: "no_constraint" } };
  if (message === "Manageable with effort") return { constraints: { budgetBand: "medium" } };
  if (message === "Need a scholarship or loan") return { constraints: { budgetBand: "low" } };

  if (message === "Stay in Kerala") return { constraints: { locationPref: "kerala" } };
  if (message === "Anywhere in India") return { constraints: { locationPref: "india" } };
  if (message === "Open to going abroad") return { constraints: { locationPref: "abroad" } };
  if (message === "Open to studying abroad") return { constraints: { locationPref: "abroad" } };
  if (message === "Open to abroad") return { constraints: { locationPref: "abroad" } };
  if (
    message === "Depends on the course" ||
    message === "I'm not sure yet" ||
    message === "Not sure yet" ||
    message === "Flexible"
  ) return { constraints: { locationPref: "india" } };

  if (message === "Study a degree further") return { aspiration: { goalOrientation: "higher_study" } };
  if (message === "Get a job quickly") return { aspiration: { goalOrientation: "job_soon" } };
  if (message === "Prepare for govt exams (PSC/UPSC)") return { aspiration: { goalOrientation: "government" } };
  if (message === "Start a business or an independent project") return { aspiration: { goalOrientation: "business" } };

  if (message === "Family can manage it") return { constraints: { budgetBand: "no_constraint" } };
  if (message === "Not sure about costs") return { constraints: { budgetBand: "medium" } };

  if (message === "They support my choice fully") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They want a specific career") return { constraints: { familyExpectations: ["family has career preference"] } };
  if (message === "Some preferences, not strict") return { constraints: { familyExpectations: ["some family preferences"] } };
  if (message === "Haven't discussed yet") return { constraints: { familyExpectations: ["none"] } };
  if (message === "Very involved and supportive") return { constraints: { familyExpectations: ["supportive"] } };
  if (message === "Somewhat involved but not decisive") return { constraints: { familyExpectations: ["some_preference"] } };
  if (message === "Somewhat involved, but I have some freedom") return { constraints: { familyExpectations: ["some_preference"] } };
  if (message === "Not very involved, but I'll consider their views") return { constraints: { familyExpectations: ["none"] } };
  if (message === "Not involved at all, I'll make my own decision") return { constraints: { familyExpectations: ["none"] } };
  if (message === "Not at all involved, I make my own decisions") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They have a strong preference") return { constraints: { familyExpectations: ["family_preference"] } };
  if (message === "They are very supportive and excited for you") return { constraints: { familyExpectations: ["supportive"] } };
  if (message === "They have some concerns but are open to discussing it") return { constraints: { familyExpectations: ["some_concerns"] } };
  if (message === "They have strong expectations for you to pursue a different career") return { constraints: { familyExpectations: ["strong_expectations"] } };
  if (message === "They haven't discussed it with you yet") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They are neutral and open to suggestions") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They are open to suggestions") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They have a moderate preference") return { constraints: { familyExpectations: ["some_preference"] } };
  if (message === "They are not involved in my career choice") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They don't have any expectations") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They have no expectations") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They're open to my choice") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They want me to pursue a different field") return { constraints: { familyExpectations: ["family_preference"] } };
  if (message === "They want me to choose something else") return { constraints: { familyExpectations: ["family_preference"] } };
  if (message === "I make the final decision") return { constraints: { familyExpectations: ["none"] } };
  if (message === "My family has a lot of influence") return { constraints: { familyExpectations: ["family_preference"] } };
  if (message === "They are fully supportive of my choice") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They have some preferences") return { constraints: { familyExpectations: ["some_preference"] } };
  if (message === "They have strong career expectations") return { constraints: { familyExpectations: ["family_preference"] } };
  if (message === "We haven't discussed it yet") return { constraints: { familyExpectations: ["none"] } };

  return null;
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

// POST /api/chat — save the student message, extract profile signals, persist,
// and return the AI's next question plus choice buttons for the UI.
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

      // Load previous profile before extraction so we can check permission state
      // and compute filledThisTurn without a second round-trip.
      const { data: prevRow } = await db
        .from("student_profiles")
        .select("profile")
        .eq("session_id", sessionId)
        .maybeSingle();
      const prevProfile = prevRow?.profile as Partial<StudentProfile> | null;

      // Permission button responses ("Keep exploring this" / "Let's move on") carry
      // no profile information — skip extraction entirely and handle in gap state.
      const wasAskingPermission = !!(prevProfile as Record<string, unknown> | null)?._askingPermission;
      const isPermissionButton = wasAskingPermission && isChoice &&
        (message === "Let's move on" || message === "Keep exploring this");

      let delta: ProfileDelta | null = null;
      let extractModel = "direct-choice";

      if (!isPermissionButton) {
        if (isChoice) {
          delta = directDeltaFromChoice(message);
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
        const mergedWithState = { ...merged, _gapState: readGapState(prevProfile) };
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

    const detectedInterests = Object.entries(ctxProfile?.interests ?? {})
      .filter(([, v]) => (v ?? 0) >= 0.2)
      .map(([k]) => INTEREST_LABELS[k] ?? k);

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

    const interestAskedCount = readGapState(ctxProfile).interest?.asks ?? 0;
    const interestPhase: "activities" | "drawnTo" = interestAskedCount >= 1 ? "drawnTo" : "activities";
    const streamKey = ctxProfile?.academic?.stream;
    const interestChoiceSet = interestPhase === "activities"
      ? activitiesForStream(streamKey)
      : drawnToChoices();
    const interestPrompt = interestPhase === "activities"
      ? `which ACTIVITY they would most enjoy doing regularly — use EXACTLY these 4 choices in this order: ${interestChoiceSet.choices.map((c) => `'${c.label}'`).join(", ")}`
      : `what they are naturally DRAWN TO watching, reading, or following — use EXACTLY these choices: ${interestChoiceSet.choices.map((c) => `'${c.label}'`).join(", ")}`;

    const GAP_PROMPTS: Record<GapId, string> = {
      subjects: "which specific subjects they enjoy most or score best in — give 4 stream-appropriate subject names as choices",
      interest: sc
        ? `what specifically draws them to "${sc}" and what daily activities in that field excite them — use EXACTLY these 4 choices in this order: ${activitiesForStream(streamKey).choices.map((c) => `'${c.label}'`).join(", ")}`
        : interestPrompt,
      goal: "their goal after school — study further, get a job, govt exams (PSC/UPSC), or start a business",
      priorities: "what matters most to them in a career — high salary and growth, job stability and security, following their passion, or government/public service",
      budget: "whether study costs are a concern for their family",
      location: "whether they can move to another city or abroad to study",
      family: "whether their family has strong expectations about their career choice",
      workstyle: "how they prefer to work — with people, solo / focused, or outdoors / hands-on",
    };

    const CORE_GAPS = new Set<GapId>(["subjects", "interest", "goal"]);

    // ── Server-side gap state ────────────────────────────────────────────────
    const gapState = readGapState(ctxProfile);
    const wasAskingPermissionLastTurn = !!(ctxProfile as Record<string, unknown> | null)?._askingPermission;

    if (answered) {
      const lastGap = (ctxProfile as { _lastGap?: GapId } | null)?._lastGap;
      if (lastGap && GAP_IDS.includes(lastGap)) {
        const gs = (gapState[lastGap] ??= { asks: 0, fails: 0 });
        if (wasAskingPermissionLastTurn) {
          // Permission response — mark asked, grant if student said yes.
          gs.permissionAsked = true;
          if (message === "Let's move on") gs.permissionGranted = true;
          // Don't increment asks/fails; this wasn't a content question.
        } else {
          gs.asks += 1;
          if (!filledThisTurn) gs.fails += 1;
        }
      }
    }

    // ── Askable gaps ─────────────────────────────────────────────────────────
    // Core gaps: always askable until captured or permission granted.
    // Interest is two-phase (activities → drawnTo) but still a core gap — no
    // phase cap; we keep asking from different angles until captured or permission.
    // Soft gaps: silent skip after MAX_FAILS_SOFT vague answers.
    const askableGaps = GAP_IDS.filter((id) => {
      if (captured[id]) return false;
      const gs = gapState[id];
      if (CORE_GAPS.has(id)) {
        // Core gaps are only skipped when the student explicitly gave permission.
        return !gs?.permissionGranted;
      }
      // Soft gaps: skip after too many failures.
      if (!gs) return true;
      return gs.fails < MAX_FAILS_SOFT;
    });
    const topGapId: GapId | null = askableGaps[0] ?? null;
    const remainingGaps: string[] = askableGaps.map((id) => GAP_PROMPTS[id]);

    // Should we ask permission to move on? Only for core gaps after MAX_FAILS_CORE
    // vague answers, and only once per gap.
    const topGapGs = topGapId ? (gapState[topGapId] ?? { asks: 0, fails: 0 }) : null;
    const shouldAskPermission =
      topGapId !== null &&
      CORE_GAPS.has(topGapId) &&
      !captured[topGapId] &&
      (topGapGs?.fails ?? 0) >= MAX_FAILS_CORE &&
      !topGapGs?.permissionAsked;

    // ── Stop condition ────────────────────────────────────────────────────────
    const capturedCount = countCaptured(ctxProfile);
    const coreCaptured = captured.subjects && captured.interest && captured.goal;
    const answeredCount = (history ?? []).filter((h) => h.role === "user").length;
    const done =
      (coreCaptured && captured.priorities && captured.family && capturedCount >= 5) ||
      (coreCaptured && captured.priorities && answeredCount >= 8) ||
      askableGaps.length === 0 ||
      answeredCount >= HARD_TURN_CEILING;

    // Persist updated gap state, lastGap, and permission flag before responding.
    if (answered) {
      const { data: profRow } = await db
        .from("student_profiles")
        .select("profile")
        .eq("session_id", sessionId)
        .maybeSingle();
      const cur = (profRow?.profile ?? {}) as Record<string, unknown>;
      cur._gapState = gapState;
      cur._lastGap = topGapId;
      cur._askingPermission = shouldAskPermission;
      await db.from("student_profiles")
        .update({ profile: cur, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId);
    }

    if (answered && done) {
      await db.from("sessions")
        .update({ status: "in_chat", updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return NextResponse.json({ done: true, stage });
    }

    // ── Permission question ───────────────────────────────────────────────────
    // After MAX_FAILS_CORE vague answers on a core gap, ask the student whether
    // they want to keep exploring or move on. This is hardcoded — no LLM needed.
    if (shouldAskPermission) {
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

    // A follow-up = the student answered but captured nothing new AND the same gap
    // is still open. Tell the AI to build on what they said with a different angle,
    // not rephrase the same question. Skip after a permission turn — the student
    // already indicated they want to keep going, so start fresh.
    const isFollowUp = answered && !filledThisTurn && topGapId !== null && !wasAskingPermissionLastTurn;

    const rawStream = ctxProfile?.academic?.stream as string | undefined;
    const studentContext: StudentContext = {
      stream: rawStream ? (STREAM_LABELS[rawStream] ?? rawStream) : undefined,
      percentage: ctxProfile?.academic?.percentage,
      statedCareer: statedCareer || undefined,
      knownGoal: ctxProfile?.aspiration?.goalOrientation,
      knownBudget: ctxProfile?.constraints?.budgetBand,
      knownLocation: ctxProfile?.constraints?.locationPref,
      detectedInterests: detectedInterests.length > 0 ? detectedInterests : undefined,
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

    // 4. Ask the next question.
    const q = await nextQuestion({ stage, history: chatHistory, studentContext });

    await db.from("conversations").insert({
      session_id: sessionId, role: "assistant", stage, content: q.content,
      model: q.model, prompt_tokens: q.promptTokens, output_tokens: q.outputTokens,
    });
    await db.from("sessions")
      .update({ status: "in_chat", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    // PINNED INTEREST CHOICES OVERRIDE: when the next gap is interest, ignore
    // whatever choices the AI generated and return the curated stream-tailored set.
    let choices = q.choices;
    if (topGapId === "interest" && !sc) {
      choices = interestChoiceSet.choices.map((c) => c.label);
    }

    return NextResponse.json({ question: q.content, stage, choices, gapId: topGapId, done: false });
  } catch (e) {
    console.error(e);
    return serverError("Chat failed");
  }
}
