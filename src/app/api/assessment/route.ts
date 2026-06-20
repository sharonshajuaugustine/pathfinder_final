import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { ASSESSMENT_ITEMS, APTITUDE_ITEM_IDS } from "@/core/assessment-bank";
import { computeAssessmentDelta } from "@/core/assessment-scorer";
import { mergeProfile, computeCompleteness } from "@/core/profile-builder";
import { extractJson, type ChatMessage } from "@/lib/groq";
import type { AssessmentItemPublic, AssessmentDimension } from "@/types/assessment";
import type { StudentProfile, InterestCluster } from "@/types/profile";
import { APTITUDES } from "@/types/profile";

const INTEREST_ITEMS_TO_SHOW = 5;

const STREAM_LABELS: Record<string, string> = {
  science_bio: "Science (Biology)",
  science_maths: "Science (Maths)",
  science_cs: "Science (Computer Science)",
  commerce: "Commerce",
  humanities: "Humanities / Arts",
};

// Score an interest question's relevance to the student's captured clusters.
function interestRelevanceScore(tags: InterestCluster[], capturedClusters: Set<InterestCluster>): number {
  const overlap = tags.filter((t) => capturedClusters.has(t)).length;
  return overlap * 10 + tags.length;
}

type AiItem = { id: string; dimension: string; questionText: string; choices: { id: string; text: string }[] };

async function generateAiAssessmentItems(profile: Partial<StudentProfile> | null): Promise<AiItem[]> {
  const stream = profile?.academic?.stream;
  const streamLabel = stream ? (STREAM_LABELS[stream] ?? stream) : "Plus Two";
  const subjects = profile?.academic?.strongSubjects ?? [];
  const interests = Object.entries(profile?.interests ?? {})
    .filter(([, v]) => (v ?? 0) >= 0.2)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
    .slice(0, 2)
    .map(([k]) => k);
  const goal = profile?.aspiration?.goalOrientation ?? "";
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
        `- Goal after Plus Two: ${goalLabels[goal] || goal || "not specified"}\n\n` +
        `Rules:\n` +
        `- Generate 5 aptitude questions, one per dimension: numerical, logical, verbal, spatial, scientific\n` +
        `- Generate 5 personality/interest questions focused on their interests (${interests.join(", ") || "general"}) and stream\n` +
        `- Personalise to their profile — a biology+medicine student gets medical scenarios, not IT scenarios\n` +
        `- Use real-world, relatable scenarios (not abstract symbols)\n` +
        `- Each question has exactly 4 choices: a, b, c, d\n` +
        `- For aptitude questions: 'a' should be the best/correct answer\n` +
        `- For interest/personality questions: choices should reflect different work styles or preferences\n\n` +
        `Return this exact JSON (no markdown, no extra keys):\n` +
        `{ "items": [ { "id": "ai_1", "dimension": "numerical", "questionText": "...", "choices": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }, { "id": "c", "text": "..." }, { "id": "d", "text": "..." }] }, ... ] }`,
    },
  ];

  const { data } = await extractJson<{ items: AiItem[] }>(messages, { temperature: 0.7 });
  const items = data?.items;
  if (!Array.isArray(items) || items.length < 8) throw new Error("AI returned too few items");

  // Ensure the first 5 are aptitude-dimension items
  return items.slice(0, 10).map((item, i) => ({
    ...item,
    id: `ai_${i + 1}`,
  }));
}

function staticFallback(profile: Partial<StudentProfile> | null): AssessmentItemPublic[] {
  const aptItems = ASSESSMENT_ITEMS.filter((i) => APTITUDE_ITEM_IDS.has(i.id));
  const interestPool = ASSESSMENT_ITEMS.filter((i) => !APTITUDE_ITEM_IDS.has(i.id));

  let selectedInterest = interestPool.slice(0, INTEREST_ITEMS_TO_SHOW);
  if (profile) {
    const capturedClusters = new Set<InterestCluster>(
      Object.entries(profile.interests ?? {})
        .filter(([, v]) => (v ?? 0) >= 0.2)
        .map(([k]) => k as InterestCluster)
    );
    if (capturedClusters.size > 0) {
      selectedInterest = interestPool
        .map((item) => ({ item, score: interestRelevanceScore(item.tags ?? [], capturedClusters) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, INTEREST_ITEMS_TO_SHOW)
        .map(({ item }) => item);
    }
  }

  return [...aptItems, ...selectedInterest].map((item) => ({
    id: item.id,
    dimension: item.dimension,
    questionText: item.questionText,
    choices: item.choices.map((c) => ({ id: c.id, text: c.text })),
  }));
}

// GET /api/assessment?session=<uuid>
// Returns 10 AI-personalised questions. Caches generated items in the profile
// to avoid regenerating on page refresh. Falls back to the static bank if AI fails.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");

  if (!sessionId) {
    return NextResponse.json({ items: staticFallback(null), total: 10 });
  }

  const db = getServiceClient();

  try {
    const { data: row } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();

    const profileRaw = row?.profile as Record<string, unknown> | null;
    const studentProfile = profileRaw as Partial<StudentProfile> | null;

    // Return cached AI items if already generated for this session.
    const cached = profileRaw?._aiAssessmentItems as AiItem[] | undefined;
    if (Array.isArray(cached) && cached.length >= 8) {
      const items: AssessmentItemPublic[] = cached.map((item) => ({
        id: item.id,
        dimension: item.dimension as AssessmentDimension,
        questionText: item.questionText,
        choices: item.choices.map((c) => ({ id: c.id, text: c.text })),
      }));
      return NextResponse.json({ items, total: items.length });
    }

    // Generate and cache new AI items.
    const aiItems = await generateAiAssessmentItems(studentProfile);
    await db.from("student_profiles").upsert(
      {
        session_id: sessionId,
        profile: { ...(profileRaw ?? {}), _aiAssessmentItems: aiItems },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    const items: AssessmentItemPublic[] = aiItems.map((item) => ({
      id: item.id,
      dimension: item.dimension as AssessmentDimension,
      questionText: item.questionText,
      choices: item.choices.map((c) => ({ id: c.id, text: c.text })),
    }));
    return NextResponse.json({ items, total: items.length });
  } catch (e) {
    console.error("[assessment] AI generation failed, using static fallback", e);
    try {
      const { data: row } = await db
        .from("student_profiles")
        .select("profile")
        .eq("session_id", sessionId)
        .maybeSingle();
      return NextResponse.json({ items: staticFallback(row?.profile as Partial<StudentProfile> | null), total: 10 });
    } catch {
      return NextResponse.json({ items: staticFallback(null), total: 10 });
    }
  }
}

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  itemId: z.string().min(1).max(40),
  choiceId: z.enum(["a", "b", "c", "d"]),
});

// POST /api/assessment — save one MCQ response, recompute aggregate, update profile.
// Handles both static bank items and AI-generated items (id starts with "ai_").
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid assessment payload", parsed.error.flatten());

  const { sessionId, itemId, choiceId } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "assessment", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();

  // AI-generated item path — look up dimension from cached profile items.
  if (itemId.startsWith("ai_")) {
    try {
      const { data: profRow } = await db
        .from("student_profiles")
        .select("profile")
        .eq("session_id", sessionId)
        .maybeSingle();
      const aiItems = (profRow?.profile as Record<string, unknown> | null)?._aiAssessmentItems as AiItem[] | undefined;
      const aiItem = aiItems?.find((i) => i.id === itemId);
      if (!aiItem) return badRequest("Unknown assessment item");

      await db.from("assessment_responses").delete().eq("session_id", sessionId).eq("item_id", itemId);
      await db.from("assessment_responses").insert({
        session_id: sessionId,
        item_id: itemId,
        dimension: aiItem.dimension,
        answer: choiceId,
        score: null,
      });
      await db
        .from("sessions")
        .update({ status: "assessment", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("status", "in_chat");
      return NextResponse.json({ ok: true, dimension: aiItem.dimension, score: null });
    } catch (e) {
      console.error(e);
      return serverError("Could not save assessment response");
    }
  }

  // Static bank item path.
  const item = ASSESSMENT_ITEMS.find((i) => i.id === itemId);
  if (!item) return badRequest("Unknown item");
  const choice = item.choices.find((c) => c.id === choiceId);
  if (!choice) return badRequest("Unknown choice");

  const isAptitude = APTITUDES.includes(item.dimension as (typeof APTITUDES)[number]);
  const score = isAptitude
    ? (choice.signals.find((s) => s.score !== undefined)?.score ?? 0)
    : null;

  try {
    await db.from("assessment_responses").delete().eq("session_id", sessionId).eq("item_id", itemId);
    await db.from("assessment_responses").insert({
      session_id: sessionId,
      item_id: itemId,
      dimension: item.dimension,
      answer: choiceId,
      score: score !== null ? score : null,
    });

    const { data: allResponses } = await db
      .from("assessment_responses")
      .select("item_id, answer")
      .eq("session_id", sessionId);

    const delta = computeAssessmentDelta(allResponses ?? []);
    const { data: row } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    const merged = mergeProfile(row?.profile as Partial<StudentProfile> | null, delta);
    await db.from("student_profiles").upsert(
      {
        session_id: sessionId,
        profile: merged,
        completeness_pct: computeCompleteness(merged),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    await db
      .from("sessions")
      .update({ status: "assessment", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "in_chat");

    return NextResponse.json({ ok: true, dimension: item.dimension, score });
  } catch (e) {
    console.error(e);
    return serverError("Could not save assessment response");
  }
}
