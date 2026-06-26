import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { loadKnowledgeBase } from "@/lib/kb-loader";
import { normalizeProfile, mergeProfile, computeCompleteness } from "@/core/profile-builder";
import { pickNextQuestion, scoreBeliefs, estimateQuestionsRemaining } from "@/core/adaptive/engine";
import { ADAPTIVE_BY_ID, toPublicQuestion } from "@/core/adaptive/question-bank";
import { extractProfileDelta } from "@/core/ai";
import type { StudentProfile } from "@/types/profile";

// POST /api/adaptive — one step of the Akinator-style adaptive interview.
// Body: { sessionId, prevQuestionId?, optionId? }
//   • applies the previous answer to the profile (if given),
//   • picks the next most-informative question,
//   • returns it, or { done: true } when the interview is complete.
const bodySchema = z.object({
  sessionId: z.string().uuid(),
  prevQuestionId: z.string().max(40).optional(),
  optionId: z.string().max(4).optional(),
  optionIds: z.array(z.string().max(4)).max(10).optional(), // multi-select answers
  textAnswer: z.string().max(500).optional(),
});

// PATCH /api/adaptive — undo the last answered question.
// Body: { sessionId }
// Pops the last entry from _adaptiveAsked so the engine will re-ask it.
const patchSchema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid adaptive payload", parsed.error.flatten());

  const { sessionId, prevQuestionId, optionId, optionIds, textAnswer } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "adaptive", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();

  try {
    // Ensure the sessions row exists (FK parent of student_profiles).
    await db.from("sessions").upsert(
      { id: sessionId, status: "in_chat", updated_at: new Date().toISOString() },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const { data: row } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    const profileRaw = (row?.profile ?? {}) as Record<string, unknown>;
    const askedIds = Array.isArray(profileRaw._adaptiveAsked)
      ? (profileRaw._adaptiveAsked as string[])
      : [];

    // 1. Apply the previous answer (if any) to the profile + log it for admins.
    if (prevQuestionId && (optionId || optionIds?.length || textAnswer)) {
      const q = ADAPTIVE_BY_ID[prevQuestionId];
      let logContent = textAnswer ?? optionId ?? "";

      if (textAnswer && textAnswer.trim()) {
        // Free-text path: extract a ProfileDelta via Groq, then merge.
        const precedingQuestion = q?.text;
        const { delta } = await extractProfileDelta({ reply: textAnswer.trim(), precedingQuestion });
        if (delta) {
          const merged = mergeProfile(profileRaw as Partial<StudentProfile>, delta);
          const meta = Object.fromEntries(Object.entries(profileRaw).filter(([k]) => k.startsWith("_")));
          const mergedWithMeta = { ...merged, ...meta };
          await db.from("student_profiles").upsert(
            { session_id: sessionId, profile: mergedWithMeta, completeness_pct: computeCompleteness(merged), updated_at: new Date().toISOString() },
            { onConflict: "session_id" }
          );
          Object.assign(profileRaw, mergedWithMeta);
        }
        logContent = textAnswer.trim();
      } else if (q && (optionIds?.length || optionId)) {
        // MCQ path (single or multi-select): apply each selected option's delta in turn.
        const ids = optionIds?.length ? optionIds : optionId ? [optionId] : [];
        let current = profileRaw as Partial<StudentProfile>;
        for (const id of ids) {
          const delta = q.apply(id);
          if (delta) current = mergeProfile(current, delta);
        }
        const meta = Object.fromEntries(Object.entries(profileRaw).filter(([k]) => k.startsWith("_")));
        const mergedWithMeta = { ...current, ...meta };
        await db.from("student_profiles").upsert(
          { session_id: sessionId, profile: mergedWithMeta, completeness_pct: computeCompleteness(current), updated_at: new Date().toISOString() },
          { onConflict: "session_id" }
        );
        Object.assign(profileRaw, mergedWithMeta);
        logContent = ids.map((id) => q.options.find((o) => o.id === id)?.label ?? id).join(", ");
      }

      await db.from("conversations").insert({
        session_id: sessionId, role: "user", stage: "adaptive", content: logContent,
      });
    }

    // 2. Pick the next question from the (updated) profile.
    const kb = await loadKnowledgeBase();
    const profile = normalizeProfile(profileRaw as Partial<StudentProfile>);
    const next = pickNextQuestion(profile, kb, askedIds);

    if (!next) {
      await db.from("sessions")
        .update({ status: "assessment", updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return NextResponse.json({ done: true, asked: askedIds.length });
    }

    // 3. Mark it asked + log the question, then return it.
    const nextAsked = [...askedIds, next.id];
    await db.from("student_profiles").upsert(
      {
        session_id: sessionId,
        profile: { ...profileRaw, _adaptiveAsked: nextAsked },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );
    await db.from("conversations").insert({
      session_id: sessionId, role: "assistant", stage: "adaptive", content: next.text,
    });
    await db.from("sessions")
      .update({ status: "in_chat", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    // Compute top-3 beliefs for the live belief meter on the client.
    const updatedProfile = normalizeProfile({ ...profileRaw, _adaptiveAsked: nextAsked } as Partial<StudentProfile>);
    const beliefs = scoreBeliefs(updatedProfile, kb)
      .slice(0, 3)
      .map((b) => ({ name: b.career.name, score: Math.round(b.score * 100) }));

    const estimatedRemaining = estimateQuestionsRemaining(updatedProfile, kb, nextAsked);

    return NextResponse.json({ question: toPublicQuestion(next), asked: nextAsked.length, done: false, beliefs, estimatedRemaining });
  } catch (e) {
    console.error(e);
    return serverError("Adaptive step failed");
  }
}

export async function PATCH(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid undo payload");

  const { sessionId } = parsed.data;
  const db = getServiceClient();

  try {
    const { data: row } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();

    const profileRaw = (row?.profile ?? {}) as Record<string, unknown>;
    const askedIds = Array.isArray(profileRaw._adaptiveAsked)
      ? (profileRaw._adaptiveAsked as string[])
      : [];

    if (askedIds.length === 0) return NextResponse.json({ ok: true, removedId: null });

    // Pop the last question (the one currently shown, not yet answered).
    const removedId = askedIds[askedIds.length - 1];
    const trimmed = askedIds.slice(0, -1);

    await db.from("student_profiles").upsert(
      {
        session_id: sessionId,
        profile: { ...profileRaw, _adaptiveAsked: trimmed },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

    return NextResponse.json({ ok: true, removedId });
  } catch (e) {
    console.error(e);
    return serverError("Undo failed");
  }
}
