import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { onboardingSchema } from "@/types/onboarding";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { audit } from "@/lib/audit";

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
    // Fetch profile for name/age/stream/phone captured during the start quiz.
    const { data: profRow } = await db
      .from("student_profiles")
      .select("profile, stream, percentage")
      .eq("session_id", d.sessionId)
      .maybeSingle();

    const profJson = profRow?.profile as Record<string, unknown> | null;
    const name = (profJson?._name as string | undefined)?.trim() || "Unknown";
    const age = (profJson?._age as number | undefined) ?? null;
    const profilePhone = profJson?._phone as string | undefined;
    const stream = profRow?.stream ?? ((profJson?.academic as { stream?: string } | undefined)?.stream) ?? null;
    const percentage = profRow?.percentage ?? ((profJson?.academic as { percentage?: number } | undefined)?.percentage) ?? null;

    // Check if a partial lead already exists (created at Q0).
    const { data: existingLead } = await db
      .from("leads").select("id").eq("session_id", d.sessionId).maybeSingle();

    let leadId: string;

    if (existingLead) {
      // Lead already exists (created at Q0) — update with remaining fields.
      await db.from("leads").update({
        email: d.email,
        district: d.district,
        stream: stream ?? undefined,
        percentage: percentage ?? undefined,
        preferred_language: d.preferredLanguage,
        consent_given: d.consentGiven,
        consent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(d.gender ? { gender: d.gender } : {}),
      }).eq("session_id", d.sessionId);
      leadId = existingLead.id;
    } else {
      // No lead yet (fallback for old sessions) — insert full lead.
      const phone = d.phone ?? profilePhone ?? "";
      const { data: lead, error: leadErr } = await db
        .from("leads")
        .insert({
          session_id: d.sessionId,
          name,
          phone,
          email: d.email,
          age,
          is_minor: age != null ? age < 18 : null,
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
      leadId = lead.id;
    }

    const lead = { id: leadId };

    // Link session + advance status.
    await db
      .from("sessions")
      .update({ lead_id: lead.id, status: "onboarded", language: d.preferredLanguage, updated_at: new Date().toISOString() })
      .eq("id", d.sessionId);

    // Mirror stream/percentage to denormalized columns only — never touch `profile`
    // (it was built during chat + assessment and must not be overwritten here).
    if (stream) {
      await db
        .from("student_profiles")
        .update({ stream, percentage: percentage ?? null, updated_at: new Date().toISOString() })
        .eq("session_id", d.sessionId);
    }

    await audit({ actorType: "student", action: "onboarding.submit", entity: "leads", entityId: lead.id, ipHash });
    return NextResponse.json({ leadId: lead.id });
  } catch (e) {
    console.error(e);
    return serverError("Could not save onboarding details");
  }
}
