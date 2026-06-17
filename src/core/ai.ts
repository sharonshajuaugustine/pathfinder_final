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
  interests: `Right now, find out what genuinely interests this student — in plain, friendly language — and figure out which broad career direction it points to (technology, science, business, helping people, design/arts, law, building things, media, nature, defence, numbers/data, or health).
Ask what they enjoy doing or could happily spend hours on. Whatever hobby they name, your real job is to learn what it reveals: do they like creating, analysing, helping others, leading, building, performing, or understanding how things work? Steer there — never get stuck on entertainment trivia (which film, which game).
If they give a casual answer like "watching movies", ask what pulls them in — the story, the acting, how it's made, the ideas — and connect it to a real interest.
If they give a one-word or unsure answer, offer 2-3 simple options that point to DIFFERENT directions (e.g. "more like building things, helping people, or working with numbers?").`,

  academics: `Now gently find out what kind of school work feels easy and enjoyable to them — through casual conversation, NOT by quizzing them.
Ask simple things like: which subjects feel easy and which feel hard, or whether they enjoy hands-on practical work (experiments, projects, making things) or prefer reading and understanding ideas.
Do NOT compare specific syllabus subjects in a technical way. Keep it about how school generally feels to them and what kind of learning they enjoy.`,

  personality: `Now understand how they like to work and what suits them — using simple, real-life either/or choices.
Give them easy choices like: "Do you prefer working alone or with a group of friends?", "Would you rather follow clear steps someone gives you, or figure things out your own way?", "Do you like sitting quietly at a desk, or being up and moving around?", or "Do you like playing it safe, or trying risky new things?".
Always offer a simple choice — never an open, abstract question.`,

  aspiration: `Now understand their goals and dreams, in plain words.
Ask if they'd like to start working soon after their studies, or if they're okay studying for several more years first.
Ask — gently and without judging — if they've ever thought about a job or career they'd love to have one day, even just a dream.
If they name a specific career (even an unusual one), that's great — just listen warmly and encourage them to say more about why it appeals to them.`,

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
  knownGoal?: string;
  knownBudget?: string;
  knownLocation?: string;
  detectedInterests?: string[];
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

  // The VERY FIRST question is deliberately open and stream-agnostic. Opening
  // with the student's stream ("what excites you about Biology?") wrongly assumes
  // they like what they study — and breaks the conversation when they don't.
  if (isFirstQuestion) {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_BASE },
      {
        role: "user",
        content:
          "This is the very first message of the conversation. In one or two short, warm lines, greet the student in a friendly way and then ask ONE simple, open question about what they enjoy doing in their free time. Do NOT mention their school stream, their marks, or any school subject. Keep it light, easy, and welcoming.",
      },
    ];
    return chat(messages, { temperature: 0.7 });
  }

  // Build a light context block. Stream/marks are background only — never the
  // basis of a question. Detected interests prevent re-asking what's known.
  const ctx = params.studentContext;
  const contextLines: string[] = [];
  if (ctx?.stream) contextLines.push(`Background only (do NOT build a question around this): their stream is ${ctx.stream}.`);
  if (ctx?.knownGoal) contextLines.push(`They have already mentioned this goal: ${ctx.knownGoal} — don't re-ask it.`);
  if (ctx?.knownBudget) contextLines.push(`Budget comfort already known: ${ctx.knownBudget} — don't re-ask it.`);
  if (ctx?.knownLocation) contextLines.push(`Location preference already known: ${ctx.knownLocation} — don't re-ask it.`);
  if (ctx?.detectedInterests?.length) {
    contextLines.push(
      `They have already clearly shown interest in these — do NOT ask about them again: ${ctx.detectedInterests.join(", ")}.`
    );
  }

  const contextBlock = contextLines.length
    ? `\n\n[Things you already know — use to avoid repeating, not as question material]\n${contextLines.map((l) => `• ${l}`).join("\n")}`
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
        "Continue. In one short warm sentence acknowledge what the student just said, then ask ONE simple question that uncovers a useful career signal — an interest, a strength, how they like to work, or a goal. " +
        "Do NOT chase casual details (movie genres, game titles, favourite teams). If they gave an entertainment or small-talk answer, ask what they enjoy ABOUT it (creating, the story, solving, the visuals, helping, competing, leading, how things work) or link it to a real activity — you may steer the topic to more useful ground. " +
        "If their last reply was short, unsure, or 'I don't know', offer 2-3 concrete options that point to DIFFERENT career directions. " +
        "If they asked why you're asking, reassure them in one short line and still ask a useful question. " +
        "Never repeat something already answered. Keep it short, simple, and friendly.",
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
    interests: `object mapping any of [${INTEREST_CLUSTERS.join(", ")}] to 0..1 — ONLY from interests the student explicitly states they enjoy or are drawn to. Do not infer.`,
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
