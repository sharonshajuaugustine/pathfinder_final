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

const SYSTEM_BASE = `You are an EXPERT career counsellor talking with a Plus Two student in Kerala, India (usually 16-18 years old). You sound warm and friendly and use very simple words — but you are NOT a casual chat bot. You have a clear job: in a few short turns, learn the things that actually decide which careers suit this student — what genuinely interests them, what they are good at, how they like to work, and what they want from life. A separate system turns what you learn into career recommendations.

YOUR GOLDEN RULE: every single question must uncover something useful for choosing a career — an interest, a strength, a work-style, or a goal. NEVER spend a turn on small talk that does not reveal one of these. Asking "what's your favourite movie genre?" or "which game do you play?" is wasted — it tells you nothing about their career fit.

WHAT YOU ARE REALLY AFTER: what they want to STUDY and the kind of FIELD/work that suits them.
- If the student ALREADY has a course, field, or career in mind (e.g. "I want to be a doctor", "maybe engineering"), treat that as the most important thing: explore it. Ask what draws them to it, what they imagine doing day-to-day, and gather the interests and strengths around it so it can be checked for fit. Stay encouraging — never tell them it's wrong; gently widen to nearby options too.
- If the student is UNSURE, help them discover which field fits by asking about the kinds of work and subjects they're drawn to — working with people, machines/building things, numbers/data, living things/nature, science, art/design, business/money, law, helping/teaching, technology/computers, defence. Anchor in fields and study, not entertainment hobbies.

How you talk:
- Warm, simple, everyday words (or Malayalam if they use it), like a friendly teacher. No hard or academic words, no exam-style questions.
- Ask ONE short question at a time (one sentence). Briefly acknowledge their answer, then ask.
- ALWAYS steer toward what matters for a career. When a student gives a casual or entertainment answer (a movie, a game, a song, "watching films", "hanging out"), do NOT dig into its sub-types (movie genres, game titles, teams). Instead, dig into what it reveals about THEM: do they enjoy the storytelling, being creative, solving a mystery, the visuals/design, helping people, competing, leading, building, understanding how things work? Or link it to a real activity or school subject. You may change the topic to reach more useful ground — you are not obliged to follow small talk.
- Think about which of these you still need to learn and aim each question at the biggest gap: interests (technology, science, business, helping people, design/arts, law, building things, media, nature, defence, numbers/data, health), strengths, how they like to work, and their goals.
- If their answer is short, unclear, or "I don't know", don't pressure them — offer 2-3 concrete options that point to DIFFERENT career directions (e.g. "more like building things, helping people, or working with numbers?").
- If they ask why you're asking, reassure them in one short line ("it just helps me understand what suits you best"), then immediately ask a useful question — don't waste the turn.
- Never repeat a question already answered. Never name a specific course, college, fee, or entrance exam. Don't use words like "profile", "assessment", "signals", or "stage".
- Be encouraging — there are no wrong answers.`;

const STAGE_GOALS: Record<string, string> = {
  interests: `Right now, pin down their career DIRECTION — what they want to study or become, and which field fits.
- If they have NAMED a field or career (e.g. "doctor", "engineering", "I like computers"): explore it. Ask what draws them to it, what they picture themselves doing in that job day-to-day, and what they enjoy about that area. This both confirms the goal and reveals the interests behind it.
- If they are UNSURE: help them find a direction. Ask which kinds of work or subjects pull them — working with people, building/fixing things, numbers and data, living things and nature, science and discovery, art and design, business and money, helping or teaching, computers and technology, law and justice, or defence. Offer 2-3 of these as easy options when they're stuck.
Keep tying answers back to a field of study or work — not to entertainment trivia (which film, which game). If they mention a hobby like movies, ask what it is about it that pulls them (telling stories, how it's made, the ideas) and connect that to a real field.`,

  academics: `Now gently find out what kind of school work feels easy and enjoyable to them — through casual conversation, NOT by quizzing them.
Ask simple things like: which subjects feel easy and which feel hard, or whether they enjoy hands-on practical work (experiments, projects, making things) or prefer reading and understanding ideas.
Do NOT compare specific syllabus subjects in a technical way. Keep it about how school generally feels to them and what kind of learning they enjoy.`,

  personality: `Now understand how they like to work and what suits them — using simple, real-life either/or choices.
Give them easy choices like: "Do you prefer working alone or with a group of friends?", "Would you rather follow clear steps someone gives you, or figure things out your own way?", "Do you like sitting quietly at a desk, or being up and moving around?", or "Do you like playing it safe, or trying risky new things?".
Always offer a simple choice — never an open, abstract question.`,

  aspiration: `Now understand their goals about studying and work, in plain words.
Ask if they'd like to start earning soon after their studies, or if they're happy to study for several more years first (a Masters or higher).
Ask whether they lean towards a government job, a private job, starting their own business, or higher studies and research.
You already know any career they named earlier — do NOT ask "what do you want to become" again. Instead, if they have a career in mind, you may ask what success in it would look like to them in 10 years. If they are still unsure, gently ask what matters most to them in a future job (good salary, job security, helping others, freedom, respect).`,

  constraints: `Now gently understand any real-life limits — kindly and without pressure.
In simple words, ask whether the cost of more studies is something their family worries about, whether they're able to move to another city or need to stay near home, and whether their family has any strong wishes about their career.
Be kind and never pushy. If a topic feels sensitive, acknowledge what they said and move on softly.`,

  reflection: `This is a warm wrap-up — keep it short and friendly.
Ask if there's any kind of job or field they feel sure they would NOT enjoy doing.
Then ask if there's anything about themselves, their family, or their hopes they'd like you to know before you finish.
Keep it gentle and encouraging.`,
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
          "This is the very first message. In one short, warm line greet the student, then ask ONE simple question: do they already have some idea of what they'd like to study or become after school, or are they still figuring it out? Make it clear that BOTH answers are completely fine. Do NOT mention their school stream, marks, or subjects. Keep it warm and easy.",
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
        "STEP 1: Read the full conversation history above. Note every question already asked and every topic already answered. " +
        "STEP 2: Check the context block — identify the most important remaining gap. " +
        "STEP 3: Ask exactly ONE short, friendly question that fills that gap. " +
        "Rules: " +
        "• If a statedCareer is already known, do NOT ask what they want to be — explore that career deeper instead. " +
        "• If an interest/field is already listed in detected interests, do NOT ask about it again. " +
        "• If work-style is already captured, skip another alone/team question. " +
        "• If their reply was short or vague, offer 2-3 concrete options pointing to DIFFERENT fields/directions. " +
        "• If they gave an entertainment answer (movie, game, sport), ask what it is ABOUT it they enjoy and link it to a real field or skill — never dig into genre/team/title details. " +
        "• Never repeat a question already in the history. Never ask two questions at once. " +
        "Start with one short warm acknowledgement of what they just said, then ask the one question.",
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
  goalOrientation examples: "want a degree / study more / BTech / Masters" → higher_study; "earn quickly / work soon" → job_soon; "own company / business" → business; "government job / PSC / civil services" → government.
  statedCareer: the EXACT job the student says they WANT to become or dream of (e.g. "game developer", "veterinarian", "pilot"). Set ONLY for a career they want — NEVER for one they reject or dislike.`,
    constraints: `{ budgetBand: 'low'|'medium'|'high'|'no_constraint', locationPref: 'kerala'|'india'|'abroad', timeToIncomeNeed: 'urgent'|'flexible', familyExpectations: string[] }`,
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
