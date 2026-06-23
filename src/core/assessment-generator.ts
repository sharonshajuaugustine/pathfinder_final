import "server-only";
import { extractJson, type ChatMessage } from "@/lib/groq";
import type { StudentProfile } from "@/types/profile";
import type { AssessmentItemPublic, AssessmentDimension } from "@/types/assessment";

const STREAM_LABELS: Record<string, string> = {
  science_bio: "Science (Biology)",
  science_maths: "Science (Maths)",
  science_cs: "Science (Computer Science)",
  commerce: "Commerce",
  humanities: "Humanities / Arts",
};

// Bump when the question-generation prompt changes so previously cached items
// (stored per session) are regenerated instead of served stale.
export const ASSESSMENT_GEN_VERSION = 2;

export type AiItem = {
  id: string;
  dimension: string;
  questionText: string;
  // correctId is server-only for aptitude items — stripped before sending to client.
  correctId?: string;
  // interestCluster is server-only metadata on personality items — stripped before
  // sending to the client so it can't influence the student's choice.
  choices: { id: string; text: string; interestCluster?: string }[];
};

export async function generateAiAssessmentItems(profile: Partial<StudentProfile> | null): Promise<AiItem[]> {
  const stream = profile?.academic?.stream;
  const streamLabel = stream ? (STREAM_LABELS[stream] ?? stream) : "Plus Two";
  const subjects = profile?.academic?.strongSubjects ?? [];
  const interests = Object.entries(profile?.interests ?? {})
    .filter(([, v]) => (v ?? 0) >= 0.2)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 3)
    .map(([k]) => k);
  const goal = profile?.aspiration?.goalOrientation ?? "";
  const priorities = profile?.aspiration?.careerPriorities ?? [];
  const goalLabels: Record<string, string> = {
    higher_study: "pursue a degree",
    job_soon: "get a job quickly",
    business: "start a business",
    government: "prepare for govt exams",
  };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You generate personalised MCQ assessment questions for a career guidance app used by Plus Two students (age 16–18) in Kerala, India. " +
        "Use simple, everyday English a 16-year-old easily understands — short sentences, no jargon or complicated words. " +
        "Return only valid JSON — no extra text.",
    },
    {
      role: "user",
      content:
        `Generate exactly 10 multiple-choice questions to assess this Kerala Plus Two student.\n\n` +
        `Student profile:\n` +
        `- Stream: ${streamLabel}\n` +
        `- Strong subjects: ${subjects.length ? subjects.join(", ") : "not specified"}\n` +
        `- Primary interests: ${interests.length ? interests.join(", ") : "not specified"}\n` +
        `- Goal after Plus Two: ${goalLabels[goal] || goal || "not specified"}\n` +
        (priorities.length ? `- Career priorities: ${priorities.join(", ")}\n` : ``) +
        `\n` +
        `LANGUAGE: Use simple, everyday English for a 16-year-old. Short sentences, common words, no jargon.\n\n` +
        `SECTION 1 — Aptitude (ai_1 through ai_5): these test real ability and are SCORED.\n` +
        `- One question per dimension: numerical, logical, verbal, spatial, scientific\n` +
        `- CRITICAL: each question must be fully solvable from the words alone. Never refer to a\n` +
        `  picture, diagram, chart, map, or "the figure above" — there are no images.\n` +
        `- Exactly ONE choice is correct; the other three must be clearly wrong. Include "correctId".\n` +
        `- Keep numbers small and the wording simple. Guidance per dimension:\n` +
        `  • numerical — a real calculation (percentage, ratio, average, simple money/marks problem).\n` +
        `  • logical — a self-contained reasoning or number/letter sequence puzzle.\n` +
        `  • verbal — meaning of a word, odd-one-out, or analogy, with the needed words in the question.\n` +
        `  • spatial — describe the shape fully in words (paper folding, cube faces, rotation) so it\n` +
        `    can be answered without seeing anything.\n` +
        `  • scientific — apply one basic science fact from their stream to a simple everyday situation.\n` +
        `- Personalise the wording/context to their stream and subjects, but the correct answer must\n` +
        `  depend only on the maths/logic/science — not on opinion.\n` +
        `- Place the correct answer in any position (a, b, c, or d) — vary it across questions.\n` +
        `- Aptitude choice format: { "id": "a", "text": "..." }  (no interestCluster)\n\n` +
        `SECTION 2 — Career preference (ai_6 through ai_10): NOT scored — these refine interests.\n` +
        `- Each of the 5 questions must use a DIFFERENT, specific framing. Do NOT reuse the same\n` +
        `  wording. Vary it, for example: "Which project would you happily spend a weekend on?",\n` +
        `  "Which problem would you most enjoy solving?", "Which class would you never skip?",\n` +
        `  "Which task would feel easiest to stick with for hours?". Write your own — keep it fresh.\n` +
        `- Each choice is a COMPLETE, concrete day-to-day activity (about 4–9 words) — something you\n` +
        `  DO, not a job title. All 4 choices must answer the same question and be clearly different.\n` +
        `- Make the activities vivid and tied to the student's stream and the interests they showed,\n` +
        `  but also include 1–2 options from other fields so we can discover new directions.\n` +
        `- dimension MUST be exactly "interest_personality" for all 5\n` +
        `- Each choice MUST include "interestCluster" — one of these 12 IDs ONLY:\n` +
        `  health_medicine, technology_coding, business_money, science_research,\n` +
        `  design_visual, helping_teaching, law_justice, building_engineering,\n` +
        `  media_communication, nature_agriculture, defence_adventure, numbers_analysis\n` +
        `- Vary the clusters across the 5 questions; include clusters from their interests but also alternatives\n` +
        `- Preference choice format: { "id": "a", "text": "...", "interestCluster": "health_medicine" }\n\n` +
        `Return this exact JSON shape (no markdown, no extra keys). Use your OWN question text, not these words:\n` +
        `{ "items": [\n` +
        `  { "id": "ai_1", "dimension": "numerical", "questionText": "<your numerical question>", "correctId": "b", "choices": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }, { "id": "c", "text": "..." }, { "id": "d", "text": "..." }] },\n` +
        `  { "id": "ai_6", "dimension": "interest_personality", "questionText": "<your own varied question>", "choices": [{ "id": "a", "text": "...", "interestCluster": "health_medicine" }, { "id": "b", "text": "...", "interestCluster": "technology_coding" }, { "id": "c", "text": "...", "interestCluster": "science_research" }, { "id": "d", "text": "...", "interestCluster": "business_money" }] }\n` +
        `] }`,
    },
  ];

  const { data } = await extractJson<{ items: AiItem[] }>(messages, { temperature: 0.7 });
  const items = data?.items;
  if (!Array.isArray(items) || items.length < 8) throw new Error("AI returned too few items");

  return items.slice(0, 10).map((item, i) => ({ ...item, id: `ai_${i + 1}` }));
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function toPublicItems(aiItems: AiItem[]): AssessmentItemPublic[] {
  return aiItems.map((item) => ({
    id: item.id,
    dimension: item.dimension as AssessmentDimension,
    questionText: item.questionText,
    choices: shuffleArray(item.choices).map((c) => ({ id: c.id, text: c.text })),
  }));
}

