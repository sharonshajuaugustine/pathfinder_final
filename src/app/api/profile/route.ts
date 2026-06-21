import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { badRequest, serverError } from "@/lib/request";
import { emptyProfile } from "@/core/profile-builder";

// GET /api/profile?sessionId=... — read current profile state.
// _* keys are stripped before returning — they contain server-only metadata
// (correctId on assessment items, cached AI questions, gap state) that must
// never reach the client.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return badRequest("sessionId required");
  try {
    const { data } = await getServiceClient()
      .from("student_profiles")
      .select("profile, completeness_pct, confidence, conflict_flags")
      .eq("session_id", sessionId)
      .single();

    if (!data) return NextResponse.json({ profile: emptyProfile(), completeness_pct: 0 });

    const profile = data.profile as Record<string, unknown> | null;
    const sanitized = profile
      ? Object.fromEntries(Object.entries(profile).filter(([k]) => !k.startsWith("_")))
      : emptyProfile();

    return NextResponse.json({ ...data, profile: sanitized });
  } catch (e) {
    console.error(e);
    return serverError("Could not read profile");
  }
}
