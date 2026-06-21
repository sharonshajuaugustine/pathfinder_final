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

export type AiItem = {
  id: string;
  dimension: string;
  questionText: string;
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
      content: "You generate personalised MCQ assessment questions for a career guidance app. Return only valid JSON — no extra text.",
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
        `SECTION 1 — Aptitude (ai_1 through ai_5):\n` +
        `- One question per dimension: numerical, logical, verbal, spatial, scientific\n` +
        `- Use real-world scenarios personalised to their stream and subjects\n` +
        `- "a" must always be the correct/best answer\n` +
        `- Aptitude choice format: { "id": "a", "text": "..." }  (no interestCluster)\n\n` +
        `SECTION 2 — Career preference (ai_6 through ai_10):\n` +
        `- Each question presents 4 career-activity scenarios — the student picks what excites them most\n` +
        `- dimension MUST be exactly "interest_personality" for all 5\n` +
        `- Each choice MUST include "interestCluster" — one of these 12 IDs ONLY:\n` +
        `  health_medicine, technology_coding, business_money, science_research,\n` +
        `  design_visual, helping_teaching, law_justice, building_engineering,\n` +
        `  media_communication, nature_agriculture, defence_adventure, numbers_analysis\n` +
        `- Vary the clusters across the 5 questions; include clusters from their interests but also alternatives\n` +
        `- "a" should be the cluster most aligned with their detected interests (${interests[0] ?? "general"})\n` +
        `- Preference choice format: { "id": "a", "text": "...", "interestCluster": "health_medicine" }\n\n` +
        `Return this exact JSON (no markdown, no extra keys):\n` +
        `{ "items": [\n` +
        `  { "id": "ai_1", "dimension": "numerical", "questionText": "...", "choices": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }, { "id": "c", "text": "..." }, { "id": "d", "text": "..." }] },\n` +
        `  { "id": "ai_6", "dimension": "interest_personality", "questionText": "Which daily task excites you most?", "choices": [{ "id": "a", "text": "...", "interestCluster": "health_medicine" }, { "id": "b", "text": "...", "interestCluster": "technology_coding" }, { "id": "c", "text": "...", "interestCluster": "science_research" }, { "id": "d", "text": "...", "interestCluster": "business_money" }] }\n` +
        `] }`,
    },
  ];

  const { data } = await extractJson<{ items: AiItem[] }>(messages, { temperature: 0.7 });
  const items = data?.items;
  if (!Array.isArray(items) || items.length < 8) throw new Error("AI returned too few items");

  return items.slice(0, 10).map((item, i) => ({ ...item, id: `ai_${i + 1}` }));
}

export function toPublicItems(aiItems: AiItem[]): AssessmentItemPublic[] {
  return aiItems.map((item) => ({
    id: item.id,
    dimension: item.dimension as AssessmentDimension,
    questionText: item.questionText,
    choices: item.choices.map((c) => ({ id: c.id, text: c.text })),
  }));
}

