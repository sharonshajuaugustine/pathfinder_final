import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { nextQuestion, extractProfileDelta, type StudentContext } from "@/core/ai";
import { mergeProfile, computeCompleteness, type ProfileDelta } from "@/core/profile-builder";
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
// The previous design split gap tracking across client + server, which caused
// the bot to over-drill one topic or drift from the priority order. Now the
// server tracks, per gap:
//   asks   — how many times the gap has been posed as a question
//   fails  — how many times the student answered but captured nothing (vague)
// Each gap gets ONE follow-up: if the first answer captures nothing, the SAME
// gap is rephrased with concrete examples exactly once. A second failure (or a
// second ask) SOFT-SKIPS the gap — it's dropped from the askable list so the
// conversation moves on and every gap still gets touched. State rides inside
// the profile JSON (`_gapState`) so it survives across the stateless turns.
const MAX_FAILS_PER_GAP = 1; // 1 follow-up, then soft-skip
const HARD_TURN_CEILING = 14; // safety ceiling for the longest conversation
type GapState = Record<string, { asks: number; fails: number }>;

function readGapState(profile: unknown): GapState {
  const g = (profile as { _gapState?: GapState } | null)?._gapState;
  return g && typeof g === "object" ? g : {};
}

// The eight profile dimensions the chat tries to fill, in priority order.
// Each maps a stable `id` (shared with the client for follow-up capping) to the
// instruction the AI uses to phrase its next question.
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

  // Common subject names → strongSubjects (avoids LLM call for simple subject answers)
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

  // Career priorities
  if (message === "High salary and fast growth") return { aspiration: { careerPriorities: ["high_salary"] } };
  if (message === "Stable job and job security") return { aspiration: { careerPriorities: ["job_security"] } };
  if (message === "Work I am passionate about") return { aspiration: { careerPriorities: ["passion"] } };
  if (message === "Government or public service job") return { aspiration: { careerPriorities: ["government"] } };

  if (message === "My family has a preference") return { constraints: { familyExpectations: ["family has career preference"] } };
  if (message === "I already have a career in mind") return null; // needs LLM to extract which career
  if (message === "Still figuring it out") return { interests: {} }; // signal captured, no cluster yet
  if (message === "A few options, not sure which") return null; // needs LLM

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
  // Ambiguous/flexible answers close the location gap without a specific preference.
  if (
    message === "Depends on the course" ||
    message === "I'm not sure yet" ||
    message === "Not sure yet" ||
    message === "Flexible"
  ) return { constraints: { locationPref: "india" } };

  // Goal variations the AI may generate
  if (message === "Study a degree further") return { aspiration: { goalOrientation: "higher_study" } };
  if (message === "Get a job quickly") return { aspiration: { goalOrientation: "job_soon" } };
  if (message === "Prepare for govt exams (PSC/UPSC)") return { aspiration: { goalOrientation: "government" } };
  if (message === "Start a business or an independent project") return { aspiration: { goalOrientation: "business" } };

  // Budget variations
  if (message === "Family can manage it") return { constraints: { budgetBand: "no_constraint" } };
  if (message === "Not sure about costs") return { constraints: { budgetBand: "medium" } };

  // Family-related answers — use sentinel "none" for supportive/no-constraint answers
  // so capturedFamilyExpectations closes the gap (empty array leaves it open).
  if (message === "They support my choice fully") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They want a specific career") return { constraints: { familyExpectations: ["family has career preference"] } };
  if (message === "Some preferences, not strict") return { constraints: { familyExpectations: ["some family preferences"] } };
  if (message === "Haven't discussed yet") return { constraints: { familyExpectations: ["none"] } };
  // AI-generated family choice variants
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
  // Standard labels enforced by STEP 4 instruction in ai.ts
  if (message === "They are fully supportive of my choice") return { constraints: { familyExpectations: ["none"] } };
  if (message === "They have some preferences") return { constraints: { familyExpectations: ["some_preference"] } };
  if (message === "They have strong career expectations") return { constraints: { familyExpectations: ["family_preference"] } };
  if (message === "We haven't discussed it yet") return { constraints: { familyExpectations: ["none"] } };

  return null;
}

// Maps a stated career name to the most relevant interest cluster.
// Used to close the interest gap automatically when a student names a specific
// career instead of picking a broad interest category.
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
  // True when the student answered this turn but it captured no new dimension —
  // i.e. the answer was vague. Drives the "rephrase with examples" follow-up.
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

      // For predefined choice clicks, map directly to a delta without an LLM call.
      // For typed "Other" answers, fall back to LLM extraction.
      let delta: ProfileDelta | null = null;
      let extractModel = "direct-choice";

      if (isChoice) {
        delta = directDeltaFromChoice(message);
      }
      if (!delta) {
        const result = await extractProfileDelta({ reply: message, stage, precedingQuestion });
        delta = result.delta;
        extractModel = result.model;
      }

      if (delta) {
        const { data: row } = await db
          .from("student_profiles")
          .select("profile")
          .eq("session_id", sessionId)
          .maybeSingle();
        const prevProfile = row?.profile as Partial<StudentProfile> | null;
        const merged = mergeProfile(prevProfile, delta);
        // Did this answer actually capture a new dimension? If not, the next
        // turn rephrases the same question with concrete examples.
        filledThisTurn = countCaptured(merged) > countCaptured(prevProfile);
        // Preserve the engine bookkeeping field that mergeProfile drops (it
        // returns a clean StudentProfile). Re-attach so gap state survives.
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
    // yet, infer the cluster from the career name and persist it. This ensures the
    // recommendation engine has interest data even when the student skipped broad
    // interest selection by naming a career directly.
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

    // Entrance exams relevant to this student's interest profile.
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

    const capturedFamilyExpectations =
      (ctxProfile?.constraints?.familyExpectations?.length ?? 0) > 0;

    // Prioritised gaps: subjects → interest → goal → priorities → budget →
    // location → family → work style. Subjects come first (feeds aptitude), then
    // interest, then the practical guidance dimensions. Work style is last — the
    // quiz already captures personality, so a chat turn on it is largely
    // redundant. One clear interest is enough (threshold: a single cluster ≥ 0.3).
    const captured = capturedDims(ctxProfile);
    const sc = ctxProfile?.aspiration?.statedCareer;

    // Each gap: a stable id (shared with the client for follow-up capping) and
    // the instruction the AI uses to phrase the question.
    const GAP_PROMPTS: Record<GapId, string> = {
      subjects: "which specific subjects they enjoy most or score best in — give 4 stream-appropriate subject names as choices",
      interest: sc
        ? `what specifically draws them to "${sc}" and what daily activities in that field excite them`
        : "what ACTIVITIES or TYPE OF DAILY WORK genuinely excites them — choices must describe real activities (e.g. 'Caring for patients', 'Building software', 'Running a business'), NOT bare field names",
      goal: "their goal after school — study further, get a job, govt exams (PSC/UPSC), or start a business",
      priorities: "what matters most to them in a career — high salary and growth, job stability and security, following their passion, or government/public service",
      budget: "whether study costs are a concern for their family",
      location: "whether they can move to another city or abroad to study",
      family: "whether their family has strong expectations about their career choice",
      workstyle: "how they prefer to work — with people, solo / focused, or outdoors / hands-on",
    };

    // Core gaps (subjects/interest/goal) feed the recommendation engine and are
    // the highest priority — but they are NOT exempt from the follow-up cap. A
    // student who simply won't answer "which subjects?" after a rephrased attempt
    // should not stall the whole conversation. The assessment quiz + stream act
    // as a backstop for un-captured core dimensions.
    const CORE_GAPS = new Set<GapId>(["subjects", "interest", "goal"]);

    // ── Server-side gap state ────────────────────────────────────────────────
    // gapState tracks how many times each gap has been asked and how many times
    // the student's answer failed to capture a dimension. This is the single
    // source of truth — the client no longer sends skipGaps.
    const gapState = readGapState(ctxProfile);
    // Update state for the gap that was JUST asked (the one the AI posed last
    // turn, which the student just answered). We know a capture-failure happened
    // when the student answered but filledThisTurn is false.
    if (answered) {
      const lastAsked = (history ?? [])
        .filter((h) => h.role === "assistant")
        .map((h) => h.content as string)
        .slice(-1)[0];
      // The assistant message we're about to record carries no gapId, but the
      // client echoes back via stage; instead, infer the asked gap from GAP_PROMPTS
      // by matching. Simpler + robust: track the LAST gap we returned last turn.
      // We persist gapState with a `lastGap` marker set when we emit a question.
      const lastGap = (ctxProfile as { _lastGap?: GapId } | null)?._lastGap;
      if (lastGap && GAP_IDS.includes(lastGap)) {
        const gs = (gapState[lastGap] ??= { asks: 0, fails: 0 });
        gs.asks += 1;
        if (!filledThisTurn) gs.fails += 1;
        void lastAsked; // (kept for future richer inference; not needed now)
      }
    }

    // A gap is ASKABLE if it's not yet captured AND has not exhausted its
    // follow-up budget (fails > MAX_FAILS_PER_GAP means "rephrased once, still
    // vague → soft-skip"). Core gaps get one extra attempt before soft-skip
    // because they feed the engine directly.
    const askableGaps = GAP_IDS.filter((id) => {
      if (captured[id]) return false;
      const gs = gapState[id];
      if (!gs) return true;
      const budget = CORE_GAPS.has(id) ? MAX_FAILS_PER_GAP + 1 : MAX_FAILS_PER_GAP;
      return gs.fails <= budget;
    });
    const topGapId: GapId | null = askableGaps[0] ?? null;
    const remainingGaps: string[] = askableGaps.map((id) => GAP_PROMPTS[id]);

    // ── Stop condition ────────────────────────────────────────────────────────
    // The chat ends when we have ENOUGH to recommend — not at a fixed count.
    // CORE (subjects + interest + goal) is strongly preferred but the chat can
    // still end if those gaps have been soft-skipped (student won't answer) and
    // the rest is covered. The assessment quiz backstops un-captured core dims.
    //   • core captured AND 5+ of 8 dimensions AND priorities+family covered → stop.
    //   • core captured AND priorities covered AND 8+ questions answered → stop.
    //   • no askable gaps remain (all captured or soft-skipped) → stop.
    //   • hard ceiling of 14 answered questions → stop no matter what.
    const capturedCount = countCaptured(ctxProfile);
    const coreCaptured = captured.subjects && captured.interest && captured.goal;
    const answeredCount = (history ?? []).filter((h) => h.role === "user").length;
    const done =
      (coreCaptured && captured.priorities && captured.family && capturedCount >= 5) ||
      (coreCaptured && captured.priorities && answeredCount >= 8) ||
      askableGaps.length === 0 ||
      answeredCount >= HARD_TURN_CEILING;

    // Persist the updated gap state + lastGap marker before deciding next step.
    // This must happen whether or not we stop, so a resumed session is consistent.
    if (answered) {
      const { data: profRow } = await db
        .from("student_profiles")
        .select("profile")
        .eq("session_id", sessionId)
        .maybeSingle();
      const cur = (profRow?.profile ?? {}) as Record<string, unknown>;
      cur._gapState = gapState;
      cur._lastGap = topGapId; // remember which gap the NEXT question targets
      await db.from("student_profiles")
        .update({ profile: cur, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId);
    }

    // When enough is captured, end the chat without burning an LLM call on a
    // question the student would never see. The client moves to the assessment.
    if (answered && done) {
      await db.from("sessions")
        .update({ status: "in_chat", updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return NextResponse.json({ done: true, stage });
    }

    // A follow-up = the student answered but captured nothing new, AND the same
    // gap is still askable (within its follow-up budget). Tell the AI to rephrase
    // the SAME gap with concrete examples instead of a fresh topic.
    const isFollowUp = answered && !filledThisTurn && topGapId !== null;

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
      // When set, the AI rephrases the same gap with concrete examples because
      // the student's previous answer was too vague to capture.
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

    // gapId lets the client cap follow-ups: if the same gapId comes back twice,
    // the student isn't answering it, so the client adds it to skipGaps.
    return NextResponse.json({ question: q.content, stage, choices: q.choices, gapId: topGapId, done: false });
  } catch (e) {
    console.error(e);
    return serverError("Chat failed");
  }
}
