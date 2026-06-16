import "server-only";
import { getServiceClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  stream: string;
  district: string;
  percentage: number | null;
  funnel_status: string;
  created_at: string;
  session_id: string;
  sessionStatus: string | null;
  completeness: number;
};

export type AdminFilters = {
  stream?: string;
  district?: string;
  from?: string;
  to?: string;
};

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getStats() {
  const db = getServiceClient();
  const [leads, sessions, recs, completed] = await Promise.all([
    db.from("leads").select("*", { count: "exact", head: true }),
    db.from("sessions").select("*", { count: "exact", head: true }),
    db.from("recommendations").select("*", { count: "exact", head: true }),
    db.from("sessions").select("*", { count: "exact", head: true }).eq("status", "completed"),
  ]);
  return {
    totalLeads: leads.count ?? 0,
    totalSessions: sessions.count ?? 0,
    totalRecommendations: recs.count ?? 0,
    completedSessions: completed.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Leads list (with optional filters)
// ---------------------------------------------------------------------------

export async function getLeads(filters: AdminFilters, limit = 100): Promise<LeadRow[]> {
  const db = getServiceClient();

  let query = db
    .from("leads")
    .select("id, name, phone, stream, district, percentage, funnel_status, created_at, session_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.stream) query = query.eq("stream", filters.stream);
  if (filters.district) query = query.ilike("district", `%${filters.district}%`);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59Z`);

  const { data: leads } = await query;
  if (!leads?.length) return [];

  const sessionIds: string[] = leads.map((l: { session_id: string }) => l.session_id);

  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    db.from("sessions").select("id, status").in("id", sessionIds),
    db.from("student_profiles").select("session_id, completeness_pct").in("session_id", sessionIds),
  ]);

  const sessionMap: Record<string, string> = Object.fromEntries(
    (sessions ?? []).map((s: { id: string; status: string }) => [s.id, s.status])
  );
  const profileMap: Record<string, number> = Object.fromEntries(
    (profiles ?? []).map((p: { session_id: string; completeness_pct: number }) => [
      p.session_id,
      p.completeness_pct,
    ])
  );

  return leads.map((l: {
    id: string; name: string; phone: string; stream: string; district: string;
    percentage: number | null; funnel_status: string; created_at: string; session_id: string;
  }) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    stream: l.stream,
    district: l.district,
    percentage: l.percentage,
    funnel_status: l.funnel_status,
    created_at: l.created_at,
    session_id: l.session_id,
    sessionStatus: sessionMap[l.session_id] ?? null,
    completeness: profileMap[l.session_id] ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Single lead detail (all related data)
// ---------------------------------------------------------------------------

export async function getLeadDetail(leadId: string) {
  const db = getServiceClient();

  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return null;

  const sessionId = (lead as { session_id: string }).session_id;

  const [session, profile, conversations, assessments, recommendation] = await Promise.all([
    db.from("sessions").select("id, status, created_at, updated_at").eq("id", sessionId).maybeSingle(),
    db.from("student_profiles")
      .select("completeness_pct, profile, conflict_flags, updated_at")
      .eq("session_id", sessionId)
      .maybeSingle(),
    db.from("conversations")
      .select("role, stage, content, model, prompt_tokens, output_tokens, created_at")
      .eq("session_id", sessionId)
      .order("created_at"),
    db.from("assessment_responses")
      .select("item_id, dimension, answer, score, created_at")
      .eq("session_id", sessionId)
      .order("created_at"),
    db.from("recommendations")
      .select("kb_version, results, overall_confidence, explanation, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    lead,
    session: session.data,
    profile: profile.data,
    conversations: conversations.data ?? [],
    assessments: assessments.data ?? [],
    recommendation: recommendation.data,
  };
}
