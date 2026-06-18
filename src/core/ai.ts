import "server-only";
import { chat, extractJson, type ChatMessage } from "@/lib/groq";
import type { ProfileDelta } from "./profile-builder";
import type { RecommendationResult } from "@/types/recommendation";
import { INTEREST_CLUSTERS, APTITUDES, PERSONALITY_TRAITS } from "@/types/profile";

// ---------------------------------------------------------------------------
// AI role boundary (enforced here):
//   interviewer  -> asks the next career-counselling question for a target stage
//   extractor    -> maps the student's reply to a STRICT ProfileDelta (JSON)
//   explainer    -> writes prose OVER engine facts; invents nothing
//
// The AI never scores, ranks, or names a career/course/fee/exam of its own.
// ---------------------------------------------------------------------------

const SYSTEM_BASE = `You are a friendly career counsellor chatting with a Plus Two student in Kerala, India (age 16–18). Your tone is warm, simple, and encouraging — like a helpful older sibling who works in education. Your ONLY job is to ask short, clear questions so that a career recommendation engine can choose the best path for this student. You do NOT recommend careers yourself — the engine does that at the end.

HARD RULES — follow every single one, every turn:
1. Ask exactly ONE question per turn. Never two. End your message with a question mark.
2. Each question must be 35 words or fewer. Use simple everyday words.
3. Acknowledge the student's last answer in one short sentence (15 words max), then ask your question — nothing more.
4. Never ask a topic already answered. Check the conversation history before asking anything.
5. If the student gives a vague, one-word, or "I don't know" answer, give them 3–4 concrete options to pick from.
6. Use Kerala and Indian examples wherever they help (KEAM, NEET, JEE, CLAT, PSC, CUET, etc.).
7. Never ask abstract or adult-coaching-style questions ("Where do you see yourself in 10 years?", "What is your passion?", "What drives you?").
8. Never mention specific colleges, course fees, or rankings.
9. Never recommend or hint at a specific career inside the chat.
10. Every question must collect one clear signal for the recommendation engine. Small talk and entertainment questions are wasted turns.

The signals you are collecting for the recommendation engine:
• Favourite subjects (Maths, Biology, Physics, Chemistry, CS, Commerce, English, History…)
• Weak or hard subjects
• Interest areas: coding/IT, medicine/health, business/finance, design/arts, teaching/social, law/justice, government/PSC, media/journalism, agriculture/environment/nature, defence, science/research
• Work style: people-facing vs solo, desk/indoor vs outdoor/field, creative/open vs structured/step-by-step, analytical vs practical/hands-on
• Goal after degree: job soon, higher study (Masters/PhD), government exam (PSC/UPSC), own business
• Entrance exam willingness: NEET, JEE, KEAM, CLAT, CUET — or prefer a path without a big entrance exam
• Budget for higher education: comfortable, manageable, needs scholarship
• Location preference: stay in Kerala, anywhere in India, open to abroad
• Family expectations about career choice
• Careers the student already likes or definitely does not want`;

const STAGE_GOALS: Record<string, string> = {
  interests: `STAGE — Interests & Career Ideas
Collect the student's interest areas and any career they already have in mind.

Signals to collect (ask about the first one still missing):
1. Have they already named a career or field they want? If YES → capture it, then ask what draws them to it.
2. Which broad field interests them most? Give simple options: coding/IT, health/medicine, business, design/arts, teaching/social work, law/justice, government service, media/journalism, agriculture/nature/environment, science/research, defence.
3. Which school subject do they enjoy most?

Good question examples for this stage:
• "Which of these sounds most interesting: working with computers, helping sick people, designing things, running a business, teaching, law, government service, nature/farming, or something else?"
• "Is there a career or job you've already thought about, even if you're not sure?"
• "Which subject do you enjoy most — Maths, Biology, Computer Science, Commerce, English, or something else?"

Once you have 1–2 clear interest signals, that is enough for this stage.`,

  academics: `STAGE — Academic Strengths & Preferences
Collect which subjects are easy, which are hard, and whether they prefer practical or theory-based learning.

Signals to collect (ask about the first one still missing):
1. Which subject feels easiest or most natural for them?
2. Is there a subject they find really hard or struggle with?
3. Do they prefer hands-on/practical work (experiments, projects, building) or theory (reading, concepts, writing)?

Good question examples:
• "Which subject feels most natural for you — Maths, Biology, Physics, Chemistry, Computer Science, English, Economics, or something else?"
• "Is there any subject you find really tough or that you don't enjoy?"
• "Do you prefer hands-on work like experiments and projects, or reading and understanding ideas and theory?"

Do not ask about their percentage or grades directly — keep it conversational.`,

  personality: `STAGE — Work Style
Find out how the student prefers to work. Use simple either/or questions — one at a time.

Signals to collect (ask about the first one still missing):
1. People-facing (with clients, patients, students, teams) OR solo focused work (coding, writing, research)?
2. Desk/indoor work OR outdoor/field work?
3. Creative and open-ended OR structured and step-by-step?
4. Analytical (numbers, logic, data) OR practical/hands-on (building, making, caring for people)?

Good question examples:
• "Do you prefer working with people every day — like a doctor, teacher, or salesperson — or do you like focused solo work like coding, writing, or research?"
• "Would you enjoy sitting at a desk most of the day, or do you prefer moving around or working outdoors?"
• "Do you prefer following clear step-by-step instructions, or figuring out problems your own way?"
• "Are you more drawn to working with data and numbers, or doing something hands-on like building, making, or caring for people?"

Get 2 clear work-style signals, then move on.`,

  aspiration: `STAGE — Goals & Exam Willingness
Find out what the student wants to do after their degree, and whether they are willing to prepare for competitive entrance exams.

Signals to collect (ask about the first one still missing):
1. Goal after degree: find a job quickly, study further (Masters/PhD), prepare for government exams (PSC/UPSC), or start own business?
2. Are they willing to prepare for a major entrance exam — NEET, JEE, KEAM, CLAT, CUET — or do they prefer a career path that doesn't require one?

Good question examples:
• "After finishing your degree, what do you most want to do — find a job quickly, study further, prepare for government exams like PSC or UPSC, or start your own business?"
• "Are you willing to prepare for entrance exams like NEET, JEE, KEAM, or CLAT? Or would you prefer a path that doesn't need a big entrance exam?"

NEVER ask "Where do you see yourself in 10 years?" — it is too abstract. Keep it practical and concrete.`,

  constraints: `STAGE — Practical Constraints
Understand the student's real-world limits. Ask gently — some topics can feel sensitive.

Signals to collect (ask about the first one still missing):
1. Budget for higher education: is their family comfortable paying, can they manage, or would they need a scholarship?
2. Location: are they happy to study in Kerala only, anywhere in India, or open to abroad?
3. Family expectations: does the family strongly want or not want a particular career?

Good question examples:
• "Is paying for a 4-year degree something your family is comfortable with, manageable with some effort, or would you need a scholarship or loan?"
• "Where are you happy to study — Kerala only, anywhere in India, or are you open to going abroad too?"
• "Does your family have a strong opinion about which career you choose — like really wanting you to become a doctor, engineer, or government officer?"

Be kind and non-judgmental. If they don't want to answer something, move on.`,

  reflection: `STAGE — Final Wrap-up
Short and warm — 1 to 2 questions only. Do not introduce new topics.

Signals to collect:
1. Is there a career or field they are sure they would NOT want, even if they were good at it?
2. Is there anything important about themselves or their situation they haven't mentioned yet?

Good question examples:
• "Is there any type of work or career you already know you wouldn't enjoy — even if you were skilled at it?"
• "Is there anything important about yourself, your family situation, or your hopes that you haven't mentioned yet?"

Keep it very short. Reassure them that their personalised suggestions will come next.`,
};

export interface StudentContext {
  stream?: string;
  percentage?: number;
  // Career the student explicitly said they want (e.g. "doctor", "software engineer").
  // When set, the AI must NOT ask "what do you want to be?" — it already knows.
  statedCareer?: string;
  knownGoal?: string;
  knownBudget?: string;
  knownLocation?: string;
  detectedInterests?: string[];
  // True when at least one personality/work-style signal has been captured.
  // Prevents the AI from asking another alone/team or desk/active question.
  hasPersonalityData?: boolean;
  // Profile sections still empty — the AI uses this to focus its next question.
  remainingGaps?: string[];
}

// --- interviewer ---------------------------------------------------------------
export async function nextQuestion(params: {
  stage: string;
  language: "en" | "ml";
  history: ChatMessage[];
  studentContext?: StudentContext;
}): Promise<{ content: string; model: string; promptTokens?: number; outputTokens?: number }> {
  const isFirstQuestion = params.history.length === 0;

  const goal =
    STAGE_GOALS[params.stage] ??
    "Continue understanding the student's interests, strengths, goals, and constraints.";

  // The VERY FIRST question is career-anchored: ask whether they already have a
  // field/course/career in mind, or are still deciding. This immediately splits
  // students into "has an idea" (capture & verify it) vs "unsure" (help them
  // discover) — far more useful than opening with free-time hobbies, and it does
  // NOT assume they like their stream subjects.
  if (isFirstQuestion) {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_BASE },
      {
        role: "user",
        content:
          "This is the very first message. Greet the student in one warm sentence (under 15 words), then ask ONE question: " +
          "do they already have some idea of what they'd like to study or become after school, or are they still figuring it out? " +
          "Make it clear both answers are fine. Do NOT mention stream, marks, subjects, or entrance exams. " +
          "Total response must be under 50 words.",
      },
    ];
    return chat(messages, { temperature: 0.7 });
  }

  // Build context block: what the AI already knows, and what gaps remain.
  // Stream/marks are background only — never the basis of a question.
  const ctx = params.studentContext;
  const contextLines: string[] = [];

  // Most critical first — statedCareer stops the AI from re-asking career choice
  if (ctx?.statedCareer) {
    contextLines.push(
      `ALREADY KNOWN — they said they want to become: "${ctx.statedCareer}". ` +
      `Do NOT ask "what do you want to be?" or "do you have a career in mind?" — you know this. ` +
      `Explore it: what draws them to it, what they picture doing day-to-day, ` +
      `the strengths it needs, or gently widen to closely related fields.`
    );
  }
  if (ctx?.stream) {
    contextLines.push(`Background only (do NOT build a question around this): their stream is ${ctx.stream}.`);
  }
  if (ctx?.knownGoal) {
    contextLines.push(`Goal orientation already captured (${ctx.knownGoal}) — don't re-ask job-soon vs higher-study.`);
  }
  if (ctx?.knownBudget) {
    contextLines.push(`Budget comfort already captured (${ctx.knownBudget}) — don't re-ask it.`);
  }
  if (ctx?.knownLocation) {
    contextLines.push(`Location preference already captured (${ctx.knownLocation}) — don't re-ask it.`);
  }
  if (ctx?.detectedInterests?.length) {
    contextLines.push(
      `Interest areas already recorded — do NOT ask about these again: ${ctx.detectedInterests.join(", ")}.`
    );
  }
  if (ctx?.hasPersonalityData) {
    contextLines.push(
      `Work-style preferences already captured — do NOT ask another alone/team, ` +
      `structured/creative, or desk/active question.`
    );
  }
  if (ctx?.remainingGaps?.length) {
    contextLines.push(
      `GAPS — these profile areas are still empty. Your next question should fill ONE of these (most important first):\n` +
      ctx.remainingGaps.map((g, i) => `  ${i + 1}. ${g}`).join("\n")
    );
  }

  const contextBlock = contextLines.length
    ? `\n\n[What you already know — read before forming your next question]\n${contextLines.map((l) => `• ${l}`).join("\n")}`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_BASE}${contextBlock}\n\n${goal}`,
    },
    ...params.history,
    {
      role: "user",
      content:
        "Produce your next response now. Follow every step below:\n\n" +
        "STEP 1 — Check history: Read the conversation above. List (mentally) every signal already captured and every question already asked. " +
        "Do NOT repeat anything already answered.\n\n" +
        "STEP 2 — Pick your target: " +
        "If the GAPS list has items → your target is gap #1 only. " +
        "If there are no gaps → your target is the next uncovered point in the stage goal.\n\n" +
        "STEP 3 — Write your response (two parts, nothing else):\n" +
        "  Part A — Acknowledgement: one sentence, 15 words max, references the student's very last reply. " +
        "Vary wording each turn — never repeat the same phrase.\n" +
        "  Part B — Question: ONE question, 35 words max, simple language, ends with '?'. Must target gap #1 or the next stage signal. " +
        "If their last reply was short, vague, or 'I don't know' → give 3–4 concrete multiple-choice options " +
        "(e.g. 'Is it more like... Maths, Biology, CS, or Commerce?'). " +
        "Use Kerala/India examples where relevant (KEAM, NEET, PSC, etc.).\n\n" +
        "GUARDRAILS:\n" +
        "• Never ask two questions in one turn.\n" +
        "• Never recommend or name a specific career, college, or fee.\n" +
        "• Never ask about entertainment sub-types (movie genres, game titles, sports teams).\n" +
        "• Never ask psychological or deeply personal questions.\n" +
        "• If statedCareer is already known, do NOT ask 'what do you want to be' — fill a gap or explore the named career instead.",
    },
  ];
  return chat(messages, { temperature: 0.7 });
}

// --- extractor -----------------------------------------------------------------
// Returns a ProfileDelta. Caller MUST treat null as "extraction failed" and not
// corrupt the profile. Validation against controlled vocabulary happens here.

// Pure filler / confirmation replies carry no standalone structured signal —
// their meaning lives entirely in the question they answer. Extracting from them
// makes the model HALLUCINATE a full profile (verified: "observing" produced
// fake aptitude scores + strong subjects). We skip extraction for these and let
// the interviewer follow up instead.
const FILLER_REPLIES = new Set([
  "yes", "no", "yeah", "yep", "yup", "nope", "ok", "okay", "k", "sure", "fine",
  "maybe", "idk", "dunno", "nothing", "none", "hmm", "hm", "good", "nice", "cool",
  "i dont know", "i don't know", "i dont knw", "not sure", "no idea", "whatever",
  "anything", "everything", "all", "yes ofcourse", "yes of course", "of course",
]);

// Strip punctuation/digits but keep letters of ANY script (so Malayalam replies
// survive). Avoids unicode property escapes for older compile targets.
function normalizeReply(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`()\[\]{}\-_/\\|@#$%^&*+=~<>0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Decide whether a reply is substantive enough to extract from. A reply must
// either be a full sentence (>= 4 words) OR contain a real word (>= 4 chars)
// that isn't a vague directional filler. The firewall against single-word
// hallucination (e.g. "observing" producing a fake aptitude profile).
function isExtractable(reply: string): boolean {
  const norm = normalizeReply(reply);
  if (!norm) return false;
  if (FILLER_REPLIES.has(norm)) return false;
  const wordCount = norm.split(" ").filter(Boolean).length;
  if (wordCount >= 4) return true;
  // Short replies (1-3 words): extractable only if they contain a real word
  // (4+ non-space chars, any script) that is not a vague directional word like
  // "observing" / "overall" / "indoor" — those only mean something with the
  // question they answer.
  return /\S{4,}/.test(norm) && !VAGUE_SHORT_WORDS.has(norm);
}

// Short directional answers that are meaningless without their question.
const VAGUE_SHORT_WORDS = new Set([
  "observing", "observe", "overall", "indoor", "indoors", "outdoor", "outdoors",
  "alone", "team", "group", "lab", "field", "theory", "practical", "both", "either",
  "university", "college", "first one", "second one", "the first", "the second",
  "this one", "that one", "left", "right", "a", "b", "c", "d", "option a", "option b",
]);

export async function extractProfileDelta(params: {
  reply: string;
  stage?: string;
  precedingQuestion?: string;
}): Promise<{
  delta: ProfileDelta | null;
  raw: string;
  model: string;
}> {
  const { reply, stage, precedingQuestion } = params;

  // Gate: never extract from contentless replies — prevents hallucination.
  if (!isExtractable(reply)) {
    return { delta: null, raw: "", model: "skipped-low-content" };
  }

  const isReflection = stage === "reflection";

  const schemaHint = {
    interests: `object mapping any of [${INTEREST_CLUSTERS.join(", ")}] to 0..1.
PRIMARY RULE: only set from interests the student EXPLICITLY states they enjoy or are drawn to.
EXCEPTION — stated career inference: if the student says they WANT to BE or BECOME a specific career, you MAY set the PRIMARY interest cluster for that career at 0.7 (even if they didn't say "I enjoy X"). Use ONLY these mappings:
  doctor / nurse / dentist / surgeon / hospital / medical / MBBS → health_medicine
  software / programmer / coder / developer / computer science / IT / game developer / app developer / AI → technology_coding
  lawyer / advocate / judge / legal / law → law_justice
  teacher / educator / professor / coaching → helping_teaching
  civil engineer / mechanical engineer / architect / construction / structural → building_engineering
  scientist / researcher / physicist / chemist / biologist / marine biologist / microbiologist / biotechnologist → science_research
  journalist / media / director / writer / content creator / actor / filmmaker → media_communication
  business / entrepreneur / startup / CA / finance → business_money
  army / navy / air force / police / defence / pilot → defence_adventure
  farmer / botanist / ecologist / wildlife / veterinarian → nature_agriculture
  designer / artist / animator / graphic / UX → design_visual
  accountant / banker / economist / actuary / data analyst / statistician → numbers_analysis
Do this ONLY for explicit "I want to be/become X" statements. For vague mentions, do NOT infer.`,
    aptitude: `object mapping any of [${APTITUDES.join(", ")}] to 0..100 — ONLY if the student literally says they are good or bad at a named subject/skill. Otherwise omit entirely.`,
    personality: `object mapping any of [${PERSONALITY_TRAITS.join(
      ", "
    )}] to -1..1 — ONLY from how they describe their own working style or preferences. Do not invent.`,
    academic: `{ strongSubjects: string[], weakSubjects: string[] } — ONLY subjects the student literally names as easy/hard. If they name no subject, return empty arrays.`,
    aspiration: `{ goalOrientation: 'job_soon'|'higher_study'|'business'|'government', riskAppetite: 0..1, ambitionLevel: 0..1, statedCareer: string }
  goalOrientation: "want a degree / study more / BTech / Masters / willing to take NEET or JEE" → higher_study; "earn quickly / job soon / no big exam / diploma" → job_soon; "own company / business / startup" → business; "government job / PSC / UPSC / civil services" → government.
  Entrance exam willingness: "willing to take NEET/JEE/KEAM/CLAT" → also set ambitionLevel: 0.8 and goalOrientation: higher_study. "prefer no entrance exam / don't want big exams" → set timeToIncomeNeed: 'urgent' in constraints.
  statedCareer: the EXACT job the student says they WANT to become or dream of (e.g. "game developer", "veterinarian", "pilot"). Set ONLY for a career they want — NEVER for one they reject or dislike.`,
    constraints: `{ budgetBand: 'low'|'medium'|'high'|'no_constraint', locationPref: 'kerala'|'india'|'abroad', timeToIncomeNeed: 'urgent'|'flexible', familyExpectations: string[] }
  budgetBand: "comfortable / no problem / family can pay easily" → no_constraint; "manageable / can manage with effort" → medium; "tight / need scholarship / loan" → low; "money not an issue / willing to spend" → high.
  locationPref: "Kerala only / stay near home / won't move" → kerala; "anywhere in India / open to other states" → india; "open to abroad / foreign / international" → abroad.
  familyExpectations: list specific careers or fields the family wants or forbids — e.g. ["family wants doctor", "family says no arts"]. Only include if explicitly stated.`,
  };

  const contextBlock = precedingQuestion
    ? `\n\nThe student was answering this question:\n"${precedingQuestion}"\nInterpret their reply in the context of THIS question.`
    : "";

  // In the reflection stage the counsellor asks what the student does NOT want.
  // So any field/career they name here is a REJECTION — it must never be recorded
  // as an interest or as a wanted career. This kills the negation bug where
  // "I don't want computer science" wrongly produced technology_coding: 1.0.
  const rejectionRule = isReflection
    ? `\n\nIMPORTANT — REJECTION CONTEXT: The student is being asked what they do NOT want. Any career, field, or subject they name here is something they DISLIKE or want to AVOID. Do NOT record it as an interest. Do NOT record it as statedCareer. For a clearly disliked interest area, you may set its interest value to 0. Only capture genuinely new POSITIVE information (e.g. a family expectation, or a dream career they say they DO want).`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You extract structured career-counselling signals from a Kerala Plus Two student's reply. ` +
        `Output ONLY valid JSON matching the schema. Omit every field not clearly and explicitly stated in THIS reply. ` +
        `Be extremely conservative: if the student did not literally say something, do NOT include it. Never guess aptitude numbers, subjects, budget, or location from vague wording. ` +
        `An empty object {} is the correct answer when nothing concrete was stated.\n\n` +
        JSON.stringify(schemaHint) +
        contextBlock +
        rejectionRule,
    },
    { role: "user", content: reply },
  ];
  const { data, raw, model } = await extractJson<ProfileDelta>(messages);
  return { delta: sanitizeDelta(data, { isReflection }), raw, model };
}

// Defensive validation: strip invalid keys and clamp out-of-range values.
// This is the firewall between AI output and the scoring engine.
//
// In the reflection stage the student is naming things they do NOT want. To
// guarantee a rejection can never become a positive signal — even if the model
// ignores the prompt — we hard-drop interests/aptitude/academic/personality from
// reflection deltas and keep only aspiration (a stated dream career) + constraints.
function sanitizeDelta(
  data: ProfileDelta | null,
  opts: { isReflection?: boolean } = {}
): ProfileDelta | null {
  if (!data || typeof data !== "object") return null;
  const out: ProfileDelta = {};
  const allowSignals = !opts.isReflection;

  if (allowSignals) {
    if (data.interests) out.interests = pick(data.interests, INTEREST_CLUSTERS as readonly string[], 0, 1);
    if (data.aptitude) out.aptitude = pick(data.aptitude, APTITUDES as readonly string[], 0, 100);
    if (data.personality) out.personality = pick(data.personality, PERSONALITY_TRAITS as readonly string[], -1, 1);

    if (data.academic && typeof data.academic === "object") {
      out.academic = {
        strongSubjects: Array.isArray(data.academic.strongSubjects)
          ? data.academic.strongSubjects.slice(0, 8)
          : [],
        weakSubjects: Array.isArray(data.academic.weakSubjects)
          ? data.academic.weakSubjects.slice(0, 8)
          : [],
      };
    }
  }

  if (data.aspiration && typeof data.aspiration === "object") {
    const asp: ProfileDelta["aspiration"] = {};
    if (data.aspiration.goalOrientation) asp.goalOrientation = data.aspiration.goalOrientation;
    if (typeof data.aspiration.riskAppetite === "number") {
      asp.riskAppetite = Math.min(1, Math.max(0, data.aspiration.riskAppetite));
    }
    if (typeof data.aspiration.ambitionLevel === "number") {
      asp.ambitionLevel = Math.min(1, Math.max(0, data.aspiration.ambitionLevel));
    }
    // statedCareer: a clean, short free-text career name the student WANTS.
    if (typeof data.aspiration.statedCareer === "string") {
      const sc = data.aspiration.statedCareer.trim().replace(/\s+/g, " ");
      if (sc.length >= 2 && sc.length <= 60 && !/\b(not|no|don'?t|dislike|hate|avoid)\b/i.test(sc)) {
        asp.statedCareer = sc;
      }
    }
    if (Object.keys(asp).length) out.aspiration = asp;
  }

  if (data.constraints && typeof data.constraints === "object") {
    const con: ProfileDelta["constraints"] = {};
    if (data.constraints.budgetBand) con.budgetBand = data.constraints.budgetBand;
    if (data.constraints.locationPref) con.locationPref = data.constraints.locationPref;
    if (data.constraints.timeToIncomeNeed) con.timeToIncomeNeed = data.constraints.timeToIncomeNeed;
    if (Array.isArray(data.constraints.familyExpectations)) {
      con.familyExpectations = data.constraints.familyExpectations
        .slice(0, 5)
        .filter((s): s is string => typeof s === "string");
    }
    if (Object.keys(con).length) out.constraints = con;
  }

  return Object.keys(out).length ? out : null;
}

function pick(obj: Record<string, unknown>, allowed: readonly string[], min: number, max: number) {
  const r: Record<string, number> = {};
  for (const k of allowed) {
    const v = obj[k];
    if (typeof v === "number" && !Number.isNaN(v)) r[k] = Math.min(max, Math.max(min, v));
  }
  return r;
}

// --- reviewer / explainer ------------------------------------------------------
// Writes a short explanation OVER the engine's already-decided result.
//
// `statedCareerGap` is set when the student named a specific career that is NOT
// in our catalog. The explainer then acknowledges it honestly, points to the
// closest path we DO cover, and tells them what to research — instead of
// silently presenting the nearest match as if it were their stated goal.
export async function explainRecommendation(
  result: RecommendationResult,
  language: "en" | "ml",
  statedCareerGap?: { statedCareer: string; closest: string }
): Promise<string> {
  const facts = result.top.slice(0, 3).map((c) => ({
    career: c.name,
    fit: Math.round(c.fitScore * 100),
    confidence: Math.round(c.confidence * 100),
    reasons: c.factors.slice(0, 3).map((f) => f.label),
  }));

  const gapInstruction = statedCareerGap
    ? `\n\nIMPORTANT: The student told us they want to become a "${statedCareerGap.statedCareer}". This specific career is NOT in our recommendation list. You MUST: (1) warmly acknowledge their interest in "${statedCareerGap.statedCareer}" by name; (2) gently explain we couldn't generate a full guided path for it here, but that "${statedCareerGap.closest}" (from the list) is the closest related path and a strong stepping stone; (3) encourage them to also research "${statedCareerGap.statedCareer}" specifically with a teacher or counsellor. Be honest and supportive — never pretend the listed careers are exactly what they asked for.`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `${SYSTEM_BASE}\n\nYou are now explaining recommendations ALREADY decided by a scoring engine. ` +
        `Use ONLY the facts provided below. Do not add new careers, courses, fees, or numbers not given to you. ` +
        `Write 4–6 warm, clear sentences in simple language. Language: ${language}.` +
        gapInstruction,
    },
    { role: "user", content: JSON.stringify({ facts, caveats: result.caveats }) },
  ];
  const { content } = await chat(messages, { temperature: 0.5 });
  return content;
}
