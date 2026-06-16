import "server-only";
import { chat, extractJson, type ChatMessage } from "@/lib/groq";
import type { ProfileDelta } from "./profile-builder";
import type { RecommendationResult } from "@/types/recommendation";
import { INTEREST_CLUSTERS, APTITUDES, PERSONALITY_TRAITS } from "@/types/profile";

// ---------------------------------------------------------------------------
// AI role boundary (enforced here):
//   interviewer  -> asks the next natural question for a target stage
//   extractor    -> maps the student's reply to a STRICT ProfileDelta (JSON)
//   reviewer/explainer -> writes prose OVER engine facts; invents nothing
//
// The AI never scores, ranks, or names a career/course/fee/exam of its own.
// ---------------------------------------------------------------------------

const SYSTEM_BASE = `You are a warm, encouraging career counsellor for Plus Two students in Kerala, India.
Rules you MUST follow:
- Never recommend or name a specific career, course, college, fee, or exam yourself. A separate engine does that.
- Keep questions short, friendly, and one at a time. No long paragraphs.
- Respect the student's language (English or Malayalam) and reply in the same language.
- Never pressure the student. There are no wrong answers.`;

const STAGE_GOALS: Record<string, string> = {
  interests: "Find out what activities, subjects, or fields genuinely excite the student.",
  strengths: "Learn which subjects they are strong in and which they struggle with.",
  personality: "Understand whether they prefer analytical vs creative, structured vs flexible, working with people vs alone.",
  aspiration: "Understand if they want a job soon, higher studies, business, or government service.",
  constraints: "Understand budget comfort, location preference, and family expectations — gently.",
};

// --- interviewer ---------------------------------------------------------------
export async function nextQuestion(params: {
  stage: string;
  language: "en" | "ml";
  history: ChatMessage[];
}): Promise<{ content: string; model: string; promptTokens?: number; outputTokens?: number }> {
  const goal = STAGE_GOALS[params.stage] ?? "Continue understanding the student.";
  const messages: ChatMessage[] = [
    { role: "system", content: `${SYSTEM_BASE}\n\nCurrent goal: ${goal}\nLanguage: ${params.language}` },
    ...params.history,
    { role: "user", content: "Ask the next single question to move toward the goal. Keep it under 2 sentences." },
  ];
  return chat(messages, { temperature: 0.7 });
}

// --- extractor -----------------------------------------------------------------
// Returns a ProfileDelta. Caller MUST treat null as "extraction failed" and not
// corrupt the profile. (Validation against the controlled vocab happens here.)
export async function extractProfileDelta(studentReply: string): Promise<{
  delta: ProfileDelta | null;
  raw: string;
  model: string;
}> {
  const schemaHint = {
    interests: `object mapping any of [${INTEREST_CLUSTERS.join(", ")}] to 0..1`,
    aptitude: `object mapping any of [${APTITUDES.join(", ")}] to 0..100`,
    personality: `object mapping any of [${PERSONALITY_TRAITS.join(", ")}] to -1..1`,
    academic: `{ strongSubjects: string[], weakSubjects: string[] }`,
    aspiration: `{ goalOrientation: 'job_soon'|'higher_study'|'business'|'government' }`,
    constraints: `{ budgetBand: 'low'|'medium'|'high'|'no_constraint', locationPref: 'kerala'|'india'|'abroad', timeToIncomeNeed: 'urgent'|'flexible' }`,
  };
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `Extract structured signals from the student's reply. Output ONLY JSON matching this shape, ` +
        `omitting any field you cannot infer. Use ONLY the allowed keys. Do not guess wildly.\n` +
        JSON.stringify(schemaHint),
    },
    { role: "user", content: studentReply },
  ];
  const { data, raw, model } = await extractJson<ProfileDelta>(messages);
  return { delta: sanitizeDelta(data), raw, model };
}

// Defensive validation: keep only allowed keys / ranges. Bad extraction must
// never silently corrupt the profile that feeds the scoring engine.
function sanitizeDelta(data: ProfileDelta | null): ProfileDelta | null {
  if (!data || typeof data !== "object") return null;
  const out: ProfileDelta = {};
  if (data.interests) out.interests = pick(data.interests, INTEREST_CLUSTERS as readonly string[], 0, 1);
  if (data.aptitude) out.aptitude = pick(data.aptitude, APTITUDES as readonly string[], 0, 100);
  if (data.personality) out.personality = pick(data.personality, PERSONALITY_TRAITS as readonly string[], -1, 1);
  if (data.academic && typeof data.academic === "object") {
    out.academic = {
      strongSubjects: Array.isArray(data.academic.strongSubjects) ? data.academic.strongSubjects.slice(0, 8) : [],
      weakSubjects: Array.isArray(data.academic.weakSubjects) ? data.academic.weakSubjects.slice(0, 8) : [],
    };
  }
  if (data.aspiration) out.aspiration = data.aspiration;
  if (data.constraints) out.constraints = data.constraints;
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
export async function explainRecommendation(result: RecommendationResult, language: "en" | "ml"): Promise<string> {
  const facts = result.top.slice(0, 3).map((c) => ({
    career: c.name,
    fit: Math.round(c.fitScore * 100),
    confidence: Math.round(c.confidence * 100),
    reasons: c.factors.slice(0, 3).map((f) => f.label),
  }));
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `${SYSTEM_BASE}\n\nYou are explaining recommendations ALREADY decided by the engine. ` +
        `Use ONLY these facts. Do not add new careers, courses, or numbers. 4-6 warm sentences. Language: ${language}.`,
    },
    { role: "user", content: JSON.stringify({ facts, caveats: result.caveats }) },
  ];
  const { content } = await chat(messages, { temperature: 0.5 });
  return content;
}
