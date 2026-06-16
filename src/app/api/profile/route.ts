import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { mergeProfile, computeCompleteness, emptyProfile } from "@/core/profile-builder";
import { detectConflicts } from "@/core/conflict-detection";
import type { StudentProfile } from "@/types/profile";

// Accepts a partial ProfileDelta from trusted client UI inputs (chips/sliders).
const bodySchema = z.object({
  sessionId: z.string().uuid(),
  delta: z.record(z.any()), // shape validated by mergeProfile's typed merge
});

// GET /api/profile?sessionId=... — read current profile state.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return badRequest("sessionId required");
  try {
    const { data } = await getServiceClient()
      .from("student_profiles")
      .select("profile, completeness_pct, confidence, conflict_flags")
      .eq("session_id", sessionId)
      .single();
    return NextResponse.json(data ?? { profile: emptyProfile(), completeness_pct: 0 });
  } catch (e) {
    console.error(e);
    return serverError("Could not read profile");
  }
}

// POST /api/profile — merge a delta from UI inputs into the stored profile.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid profile payload", parsed.error.flatten());

  const { sessionId, delta } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "profile", [sessionId, ipHash]);
  if (limited) return limited;

  try {
    const db = getServiceClient();
    const { data: row } = await db.from("student_profiles").select("profile").eq("session_id", sessionId).single();
    const base = (row?.profile as StudentProfile) ?? emptyProfile();
    const merged = mergeProfile(base, delta);
    const conflicts = detectConflicts(merged);

    await db
      .from("student_profiles")
      .update({
        profile: merged,
        stream: merged.academic.stream ?? null,
        percentage: merged.academic.percentage ?? null,
        completeness_pct: computeCompleteness(merged),
        conflict_flags: conflicts,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    return NextResponse.json({ completeness: computeCompleteness(merged), conflicts });
  } catch (e) {
    console.error(e);
    return serverError("Could not update profile");
  }
}
