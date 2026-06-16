import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { ASSESSMENT_ITEMS } from "@/core/assessment-bank";
import { computeAssessmentDelta } from "@/core/assessment-scorer";
import { mergeProfile, computeCompleteness } from "@/core/profile-builder";
import type { AssessmentItemPublic } from "@/types/assessment";
import type { StudentProfile } from "@/types/profile";
import { APTITUDES } from "@/types/profile";

// GET /api/assessment — return the public question bank (no signals or answer key).
export async function GET() {
  const items: AssessmentItemPublic[] = ASSESSMENT_ITEMS.map((item) => ({
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
// The client sends {sessionId, itemId, choiceId}; scoring happens entirely server-side.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid assessment payload", parsed.error.flatten());

  const { sessionId, itemId, choiceId } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "assessment", [sessionId, ipHash]);
  if (limited) return limited;

  // Look up item + choice in the bank (server-side answer key).
  const item = ASSESSMENT_ITEMS.find((i) => i.id === itemId);
  if (!item) return badRequest("Unknown item");
  const choice = item.choices.find((c) => c.id === choiceId);
  if (!choice) return badRequest("Unknown choice");

  // Derive score for aptitude items (0 or 100); personality items have no score.
  const isAptitude = APTITUDES.includes(item.dimension as (typeof APTITUDES)[number]);
  const score = isAptitude
    ? (choice.signals.find((s) => s.score !== undefined)?.score ?? 0)
    : null;

  const db = getServiceClient();
  try {
    // Delete any prior answer for this item (re-attempt safety, idempotent).
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

    // Recompute the full aggregate delta from all responses so far.
    const { data: allResponses } = await db
      .from("assessment_responses")
      .select("item_id, answer")
      .eq("session_id", sessionId);

    const delta = computeAssessmentDelta(allResponses ?? []);

    // Merge into the student profile.
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

    // Advance session status to 'assessment' on first answer.
    await db.from("sessions")
      .update({ status: "assessment", updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "in_chat"); // only advance forward

    return NextResponse.json({ ok: true, dimension: item.dimension, score });
  } catch (e) {
    console.error(e);
    return serverError("Could not save assessment response");
  }
}
