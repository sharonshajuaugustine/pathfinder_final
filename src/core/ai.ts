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

const SYSTEM_BASE = `You are an expert career counsellor specialising in Plus Two students in Kerala, India.
Your job is to conduct a structured career counselling interview — not a casual chat.

Rules you MUST follow:
- Ask ONE focused question at a time. Never list multiple questions in one message.
- Keep each question under 2 sentences.
- If the student's last reply was vague, generic, or non-committal ("I don't know", "maybe", "anything", "I like everything"), do NOT move on — ask a clarifying question: give them a concrete choice or a real-life example to react to.
- Never repeat a topic that has already been clearly answered in the conversation history.
- Never name or suggest a specific career, course, college, fee, or entrance exam. A separate engine handles that.
- Use the student's stream, marks, and detected interests to make your questions specific and relevant.
- Be warm, encouraging, and patient. There are no wrong answers.
- Do not use internal jargon like "profile", "signals", "dimension", "stage", or "assessment" in your questions.
- Reply in the same language the student uses (English or Malayalam).`;

const STAGE_GOALS: Record<string, string> = {
  interests: `Your goal: Discover what genuinely excites this student.
Ask about activities they love in and outside school, subjects they enjoy, or what kind of work feels energising to them.
If they give a generic answer like "I like science" or "I like all subjects", push deeper: ask which specific part of science, or which type of activity they enjoy most.
Try to understand if they are drawn to: creating or designing things, solving logical puzzles, helping or caring for people, leading or managing others, performing or communicating publicly, researching and investigating, building physical systems, working with numbers and data, working with nature or outdoors, or competitive and adventurous work.
Do not ask about subject strengths or weaknesses in this stage — focus only on what excites or interests them.`,

  academics: `Your goal: Understand their academic strengths and weaknesses in specific subjects.
Ask which Plus Two subjects they find easiest and most enjoyable, and which subjects they find difficult or boring.
Ask whether they prefer theoretical study (reading, understanding concepts, memorising) or practical and hands-on work (experiments, projects, building things).
Use their stream to make questions specific — if they're in Science Biology, ask about Biology vs Chemistry vs Physics. If Commerce, ask about Accounts vs Business Studies vs Economics.
Also ask about their learning style: do they understand new concepts quickly, or do they need to go over material multiple times?
Do not ask again about general interests — this stage is specifically about subject strengths and how they study.`,

  personality: `Your goal: Understand how this student naturally works and what kind of environment suits them best.
Probe for specific preferences:
- Working alone vs in a team (if team, small group or large group?)
- Structured routine with clear defined tasks vs flexible, open-ended creative work
- Leading and organising others vs focused, deep individual work
- Indoor office or desk work vs fieldwork, travel, or outdoor settings
- Playing it safe for stability vs taking risks for bigger rewards
Use concrete real-world scenarios to avoid vague answers. For example: "If you were given a big project at work, would you prefer clear step-by-step instructions, or freedom to figure out your own approach?"`,

  aspiration: `Your goal: Understand their career goals and life aspirations clearly.
Ask whether they want to start earning as soon as possible (within 3-4 years of Plus Two) or are willing to study for 5-7 more years before working.
Ask whether they are drawn towards: a government job, a private sector job, starting their own business, or going for higher studies such as a Masters or PhD.
Ask if they have any career in mind at all — even vaguely or as a dream — without validating or discouraging it.
Ask what success looks like to them in 10 years: is it salary, job security, making a difference, status, freedom to work independently, or something else?
Do not ask about budget or family pressure yet — focus only on aspirations and ambitions.`,

  constraints: `Your goal: Understand their practical constraints and real-world limitations — gently and without pressure.
Ask about their rough budget comfort for further education — do not ask for an exact number; use rough bands like "very limited", "can manage moderate fees", or "fees are not a major concern".
Ask whether they can move outside Kerala for studies, whether studying outside India is a possibility, or if they need to stay close to home.
Ask if their family has any specific expectations or strong opinions about which career path they should take.
Ask whether there is any financial pressure on them to start earning as early as possible.
Be sensitive — if they seem uncomfortable about money or family topics, note what you have heard and gently move on.`,

  reflection: `Your goal: Surface any final uncertainty, strong feelings, or important context the student has not mentioned yet.
This is the last stage of the interview — make it feel like a warm and friendly wrap-up.
Ask if there is any career path or field they are completely certain they do NOT want, and why.
Ask if there is a career they have always imagined or dreamed about but feel uncertain about pursuing.
Ask what their biggest worry or concern is about choosing a career right now.
End with: "Before we finish, is there anything important about you — your situation, your family, or your dreams — that you'd like me to know?"`,
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
  const goal =
    STAGE_GOALS[params.stage] ??
    "Continue understanding the student's interests, strengths, goals, and constraints.";

  // Build a context block so the AI personalises its question and avoids repeating.
  const ctx = params.studentContext;
  const contextLines: string[] = [];
  if (ctx?.stream) contextLines.push(`Student's Plus Two stream: ${ctx.stream}`);
  if (ctx?.percentage != null) contextLines.push(`Their Plus Two marks: ${ctx.percentage}%`);
  if (ctx?.knownGoal) contextLines.push(`Career aspiration already mentioned: ${ctx.knownGoal}`);
  if (ctx?.knownBudget) contextLines.push(`Budget comfort already detected: ${ctx.knownBudget}`);
  if (ctx?.knownLocation) contextLines.push(`Location preference already detected: ${ctx.knownLocation}`);
  if (ctx?.detectedInterests?.length) {
    contextLines.push(
      `Interests already clearly established — do NOT ask about these again: ${ctx.detectedInterests.join(", ")}`
    );
  }

  const contextBlock = contextLines.length
    ? `\n\n[Student background — use this to personalise your question; do not re-ask what is already known]\n${contextLines.map((l) => `• ${l}`).join("\n")}`
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
        "Ask your next career counselling question. One question only, under 2 sentences. If the student's last reply was vague or very short, ask a clarifying question — give them a concrete scenario, a specific choice, or a real example to react to.",
    },
  ];
  return chat(messages, { temperature: 0.7 });
}

// --- extractor -----------------------------------------------------------------
// Returns a ProfileDelta. Caller MUST treat null as "extraction failed" and not
// corrupt the profile. Validation against controlled vocabulary happens here.
export async function extractProfileDelta(studentReply: string): Promise<{
  delta: ProfileDelta | null;
  raw: string;
  model: string;
}> {
  const schemaHint = {
    interests: `object mapping any of [${INTEREST_CLUSTERS.join(", ")}] to 0..1 — extract from what the student says they enjoy, are curious about, or feel drawn towards`,
    aptitude: `object mapping any of [${APTITUDES.join(", ")}] to 0..100 — only extract from explicit statements about being strong or weak in a subject or skill type`,
    personality: `object mapping any of [${PERSONALITY_TRAITS.join(
      ", "
    )}] to -1..1 (positive = trait strongly present, negative = opposite pole) — extract from how they describe their work preferences, learning style, or natural behaviour`,
    academic: `{ strongSubjects: string[], weakSubjects: string[] } — subjects they explicitly say they are good at or struggle with`,
    aspiration: `{ goalOrientation: 'job_soon'|'higher_study'|'business'|'government', riskAppetite: 0..1 (0=strongly risk-averse, 1=very risk-seeking), ambitionLevel: 0..1 (0=modest/content, 1=highly ambitious) }`,
    constraints: `{ budgetBand: 'low'|'medium'|'high'|'no_constraint', locationPref: 'kerala'|'india'|'abroad', timeToIncomeNeed: 'urgent'|'flexible', familyExpectations: string[] (career fields family expects, e.g. ["medicine", "engineering"]) }`,
  };
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You are extracting structured career counselling signals from a student's reply. ` +
        `Output ONLY valid JSON matching the schema below. Omit any field not clearly stated or strongly implied in this specific reply. ` +
        `Use ONLY the allowed keys and value types. Be conservative — do not guess or fill fields that are not mentioned.\n\n` +
        JSON.stringify(schemaHint),
    },
    { role: "user", content: studentReply },
  ];
  const { data, raw, model } = await extractJson<ProfileDelta>(messages);
  return { delta: sanitizeDelta(data), raw, model };
}

// Defensive validation: strip invalid keys and clamp out-of-range values.
// This is the firewall between AI output and the scoring engine.
function sanitizeDelta(data: ProfileDelta | null): ProfileDelta | null {
  if (!data || typeof data !== "object") return null;
  const out: ProfileDelta = {};

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

  if (data.aspiration && typeof data.aspiration === "object") {
    const asp: ProfileDelta["aspiration"] = {};
    if (data.aspiration.goalOrientation) asp.goalOrientation = data.aspiration.goalOrientation;
    if (typeof data.aspiration.riskAppetite === "number") {
      asp.riskAppetite = Math.min(1, Math.max(0, data.aspiration.riskAppetite));
    }
    if (typeof data.aspiration.ambitionLevel === "number") {
      asp.ambitionLevel = Math.min(1, Math.max(0, data.aspiration.ambitionLevel));
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
export async function explainRecommendation(
  result: RecommendationResult,
  language: "en" | "ml"
): Promise<string> {
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
        `${SYSTEM_BASE}\n\nYou are now explaining recommendations ALREADY decided by a scoring engine. ` +
        `Use ONLY the facts provided below. Do not add new careers, courses, fees, or numbers not given to you. ` +
        `Write 4–6 warm, clear sentences. Language: ${language}.`,
    },
    { role: "user", content: JSON.stringify({ facts, caveats: result.caveats }) },
  ];
  const { content } = await chat(messages, { temperature: 0.5 });
  return content;
}
