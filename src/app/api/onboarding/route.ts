import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/types/onboarding";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { audit } from "@/lib/audit";
import { normalizeProfile, computeCompleteness } from "@/core/profile-builder";

// POST /api/onboarding — validate + persist PII (server-only, service role).
// Creates the lead, links the session, and mirrors academic fields to the profile.
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
    // Persist PII in `leads`.
    const { data: lead, error: leadErr } = await db
      .from("leads")
      .insert({
        session_id: d.sessionId,
        name: d.name,
        phone: d.phone,
        email: d.email || null,
        age: d.age,
        is_minor: d.age < 18,
        district: d.district,
        stream: d.stream,
        percentage: d.percentage ?? null,
        preferred_language: d.preferredLanguage,
        consent_given: d.consentGiven,
        consent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (leadErr) throw leadErr;

    // Link session + advance status.
    await db
      .from("sessions")
      .update({ lead_id: lead.id, status: "onboarded", language: d.preferredLanguage, updated_at: new Date().toISOString() })
      .eq("id", d.sessionId);

    // Seed the profile with mirrored academic hard-filter fields.
    const seedProfile = { academic: { stream: d.stream, percentage: d.percentage, strongSubjects: [], weakSubjects: [] } };
    await db.from("student_profiles").upsert(
      {
        session_id: d.sessionId,
        stream: d.stream,
        percentage: d.percentage ?? null,
        profile: seedProfile,
        completeness_pct: computeCompleteness(normalizeProfile(seedProfile)),
      },
      { onConflict: "session_id" }
    );

    await audit({ actorType: "student", action: "onboarding.submit", entity: "leads", entityId: lead.id, ipHash });
    return NextResponse.json({ leadId: lead.id });
  } catch (e) {
    console.error(e);
    return serverError("Could not save onboarding details");
  }
}
