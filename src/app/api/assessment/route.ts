import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { ASSESSMENT_ITEMS, APTITUDE_ITEM_IDS } from "@/core/assessment-bank";
import { computeAssessmentDelta } from "@/core/assessment-scorer";
import { mergeProfile, computeCompleteness } from "@/core/profile-builder";
import type { AssessmentItemPublic } from "@/types/assessment";
import type { StudentProfile, InterestCluster } from "@/types/profile";
import { APTITUDES } from "@/types/profile";

const INTEREST_ITEMS_TO_SHOW = 5;

// Score an interest question's relevance to the student's captured clusters.
// Higher score = more relevant = show this question.
function interestRelevanceScore(
  tags: InterestCluster[],
  capturedClusters: Set<InterestCluster>
): number {
  // Questions whose tags overlap with the student's captured clusters score higher.
  const overlap = tags.filter((t) => capturedClusters.has(t)).length;
  // Break ties by total tag count (more specific questions rank lower when unmatched).
  return overlap * 10 + tags.length;
}

// GET /api/assessment?session=<uuid> — returns 5 aptitude + 5 relevant interest questions.
// Falls back to default order when no session is provided.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");

  const aptItems = ASSESSMENT_ITEMS.filter((i) => APTITUDE_ITEM_IDS.has(i.id));
  const interestPool = ASSESSMENT_ITEMS.filter((i) => !APTITUDE_ITEM_IDS.has(i.id));

  let selectedInterest = interestPool.slice(0, INTEREST_ITEMS_TO_SHOW);

  if (sessionId) {
    try {
      const db = getServiceClient();
      const { data: row } = await db
        .from("student_profiles")
        .select("profile")
        .eq("session_id", sessionId)
        .maybeSingle();

      if (row?.profile) {
        const profile = row.profile as Partial<StudentProfile>;
        const capturedClusters = new Set<InterestCluster>(
          Object.entries(profile.interests ?? {})
            .filter(([, v]) => (v ?? 0) >= 0.2)
            .map(([k]) => k as InterestCluster)
        );

        if (capturedClusters.size > 0) {
          selectedInterest = interestPool
            .map((item) => ({
              item,
              score: interestRelevanceScore(item.tags ?? [], capturedClusters),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, INTEREST_ITEMS_TO_SHOW)
            .map(({ item }) => item);
        }
      }
    } catch {
      // Non-critical: fall back to default order
    }
  }

  const items: AssessmentItemPublic[] = [...aptItems, ...selectedInterest].map((item) => ({
    id: item.id,
    dimension: item.dimension,
    questionText: item.questionText,
    choices: item.choices.map((c) => ({ id: c.id, text: c.text })),
  }));

  return NextResponse.json({ items, total: items.length });
}

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  itemId: z.string().min(1).max(40),
  choiceId: z.enum(["a", "b", "c", "d"]),
});

// POST /api/assessment — save one MCQ response, recompute aggregate, update profile.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid assessment payload", parsed.error.flatten());

  const { sessionId, itemId, choiceId } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "assessment", [sessionId, ipHash]);
  if (limited) return limited;

  const item = ASSESSMENT_ITEMS.find((i) => i.id === itemId);
  if (!item) return badRequest("Unknown item");
  const choice = item.choices.find((c) => c.id === choiceId);
  if (!choice) return badRequest("Unknown choice");

  const isAptitude = APTITUDES.includes(item.dimension as (typeof APTITUDES)[number]);
  const score = isAptitude
    ? (choice.signals.find((s) => s.score !== undefined)?.score ?? 0)
    : null;

  const db = getServiceClient();
  try {
    await db.from("assessment_responses")
      .delete()
      .eq("session_id", sessionId)
      .eq("item_id", itemId);

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

    await db.from("sessions")
      .update({ status: "assessment", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "in_chat");

    return NextResponse.json({ ok: true, dimension: item.dimension, score });
  } catch (e) {
    console.error(e);
    return serverError("Could not save assessment response");
  }
}
