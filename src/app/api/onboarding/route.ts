import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/types/onboarding";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { audit } from "@/lib/audit";
import { normalizeProfile, computeCompleteness } from "@/core/profile-builder";

// POST /api/onboarding — validate + persist PII (server-only, service role).
// name, age, stream, and percentage were collected in the start quiz and are
// read here from student_profiles rather than submitted by the form again.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const limited = await enforceRateLimit(limiters.write, "onboarding", [ipHash]);
  if (limited) return limited;

  const json = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid onboarding data", parsed.error.flatten());

  const d = parsed.data;
  const db = getServiceClient();

  try {
    // Fetch name, age, stream, and percentage captured during the start quiz.
    const { data: profRow } = await db
      .from("student_profiles")
      .select("profile, stream, percentage")
      .eq("session_id", d.sessionId)
      .maybeSingle();

    const profJson = profRow?.profile as Record<string, unknown> | null;
    const name = (profJson?._name as string | undefined)?.trim() || "Unknown";
    const age = (profJson?._age as number | undefined) ?? 0;
    const stream = profRow?.stream ?? ((profJson?.academic as { stream?: string } | undefined)?.stream) ?? null;
    const percentage = profRow?.percentage ?? ((profJson?.academic as { percentage?: number } | undefined)?.percentage) ?? null;

    // Persist PII in `leads`.
    const { data: lead, error: leadErr } = await db
      .from("leads")
      .insert({
        session_id: d.sessionId,
        name,
        phone: d.phone,
        email: d.email,
        age: age > 0 ? age : null,
        is_minor: age > 0 ? age < 18 : null,
        district: d.district,
        stream: stream ?? null,
        percentage: percentage ?? null,
        preferred_language: d.preferredLanguage,
        consent_given: d.consentGiven,
        consent_at: new Date().toISOString(),
        ...(d.gender ? { gender: d.gender } : {}),
      })
      .select("id")
      .single();
    if (leadErr) throw leadErr;

    // Link session + advance status.
    await db
      .from("sessions")
      .update({ lead_id: lead.id, status: "onboarded", language: d.preferredLanguage, updated_at: new Date().toISOString() })
      .eq("id", d.sessionId);

    // Seed the profile with mirrored academic hard-filter fields (no-op if already set).
    if (stream) {
      const seedProfile = { academic: { stream, percentage, strongSubjects: [], weakSubjects: [] } };
      await db.from("student_profiles").upsert(
        {
          session_id: d.sessionId,
          stream,
          percentage: percentage ?? null,
          profile: seedProfile,
          completeness_pct: computeCompleteness(normalizeProfile(seedProfile)),
        },
        { onConflict: "session_id" }
      );
    }

    await audit({ actorType: "student", action: "onboarding.submit", entity: "leads", entityId: lead.id, ipHash });
    return NextResponse.json({ leadId: lead.id });
  } catch (e) {
    console.error(e);
    return serverError("Could not save onboarding details");
  }
}
