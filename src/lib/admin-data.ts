import "server-only";
import { getServiceClient } from "@/lib/supabase/admin";
import {
  INTEREST_LABELS, GOAL_LABELS, STREAM_LABELS,
  fmtInterest, fmtGoal,
} from "@/lib/admin-labels";

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
    totalLeads:          leads.count ?? 0,
    totalSessions:       sessions.count ?? 0,
    totalRecommendations:recs.count ?? 0,
    completedSessions:   completed.count ?? 0,
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

  if (filters.stream)   query = query.eq("stream", filters.stream);
  if (filters.district) query = query.ilike("district", `%${filters.district}%`);
  if (filters.from)     query = query.gte("created_at", filters.from);
  if (filters.to)       query = query.lte("created_at", `${filters.to}T23:59:59Z`);

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
      p.session_id, p.completeness_pct,
    ])
  );

  return leads.map((l: {
    id: string; name: string; phone: string; stream: string; district: string;
    percentage: number | null; funnel_status: string; created_at: string; session_id: string;
  }) => ({
    id:            l.id,
    name:          l.name,
    phone:         l.phone,
    stream:        l.stream,
    district:      l.district,
    percentage:    l.percentage,
    funnel_status: l.funnel_status,
    created_at:    l.created_at,
    session_id:    l.session_id,
    sessionStatus: sessionMap[l.session_id] ?? null,
    completeness:  profileMap[l.session_id] ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Single lead detail (all related data except conversation history)
// ---------------------------------------------------------------------------

export async function getLeadDetail(leadId: string) {
  const db = getServiceClient();

  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return null;

  const sessionId = (lead as { session_id: string }).session_id;

  const [session, profile, assessments, recommendation] = await Promise.all([
    db.from("sessions")
      .select("id, status, created_at, updated_at")
      .eq("id", sessionId).maybeSingle(),
    db.from("student_profiles")
      .select("completeness_pct, profile, conflict_flags, updated_at")
      .eq("session_id", sessionId).maybeSingle(),
    db.from("assessment_responses")
      .select("item_id, dimension, answer, score, created_at")
      .eq("session_id", sessionId).order("created_at"),
    db.from("recommendations")
      .select("kb_version, results, overall_confidence, explanation, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle(),
  ]);

  return {
    lead,
    session:        session.data,
    profile:        profile.data,
    assessments:    assessments.data ?? [],
    recommendation: recommendation.data,
  };
}

// ---------------------------------------------------------------------------
// Analytics — aggregated from all student profiles + recommendations
// ---------------------------------------------------------------------------

export async function getAnalytics() {
  const db = getServiceClient();

  const [profilesRes, recsRes, leadsRes, sessionsRes, assessedRes] = await Promise.all([
    db.from("student_profiles").select("session_id, profile, completeness_pct"),
    db.from("recommendations").select("session_id, results, created_at")
      .order("created_at", { ascending: false }),
    db.from("leads").select("session_id, stream, district"),
    db.from("sessions").select("id, status"),
    db.from("assessment_responses").select("session_id"),
  ]);

  const profiles  = profilesRes.data  ?? [];
  const recs      = recsRes.data      ?? [];
  const leads     = leadsRes.data     ?? [];
  const sessions  = sessionsRes.data  ?? [];
  const assessed  = assessedRes.data  ?? [];

  // Latest recommendation per session
  type RecRow = { name: string; domain: string; fitScore: number; confidence: number };
  const recBySession = new Map<string, RecRow>();
  for (const r of recs) {
    if (recBySession.has(r.session_id)) continue;
    const results = Array.isArray(r.results) ? (r.results as RecRow[]) : [];
    if (results[0]) recBySession.set(r.session_id, results[0]);
  }

  // Interest counts (score > 0.2 threshold to filter noise)
  const interestCounts: Record<string, number> = {};
  for (const p of profiles) {
    const pr = p.profile as Record<string, unknown> | null;
    const interests = pr?.interests as Record<string, number> | undefined;
    if (!interests) continue;
    for (const [k, v] of Object.entries(interests)) {
      if (v >= 0.2) interestCounts[k] = (interestCounts[k] ?? 0) + 1;
    }
  }
  const topInterests = Object.entries(interestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, count]) => ({ key: k, label: fmtInterest(k), count }));

  // Career goal counts
  const goalCounts: Record<string, number> = {};
  for (const p of profiles) {
    const pr = p.profile as Record<string, unknown> | null;
    const goal = (pr?.aspiration as Record<string, unknown> | undefined)?.goalOrientation as string | undefined;
    if (goal) goalCounts[goal] = (goalCounts[goal] ?? 0) + 1;
  }
  const topGoals = Object.entries(goalCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, count]) => ({ key: k, label: fmtGoal(k), count }));

  // Top recommended careers
  const recCounts: Record<string, number> = {};
  Array.from(recBySession.values()).forEach((rec) => {
    recCounts[rec.name] = (recCounts[rec.name] ?? 0) + 1;
  });
  const topRecs = Object.entries(recCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Stream-wise top career
  const leadMap = new Map(leads.map((l) => [l.session_id, l]));
  const streamBuckets: Record<string, Record<string, number>> = {};
  for (const [sid, rec] of Array.from(recBySession)) {
    const lead = leadMap.get(sid);
    if (!lead?.stream) continue;
    if (!streamBuckets[lead.stream]) streamBuckets[lead.stream] = {};
    streamBuckets[lead.stream][rec.name] = (streamBuckets[lead.stream][rec.name] ?? 0) + 1;
  }
  const streamTrends = Object.entries(streamBuckets)
    .map(([stream, counts]) => {
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return {
        stream,
        streamLabel: STREAM_LABELS[stream] ?? stream,
        topCareer: sorted[0]?.[0] ?? "—",
        topCount:  sorted[0]?.[1] ?? 0,
        total:     Object.values(counts).reduce((a, b) => a + b, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  // District-wise top career
  const districtBuckets: Record<string, Record<string, number>> = {};
  for (const [sid, rec] of Array.from(recBySession)) {
    const lead = leadMap.get(sid);
    if (!lead?.district) continue;
    if (!districtBuckets[lead.district]) districtBuckets[lead.district] = {};
    districtBuckets[lead.district][rec.name] = (districtBuckets[lead.district][rec.name] ?? 0) + 1;
  }
  const districtTrends = Object.entries(districtBuckets)
    .map(([district, counts]) => {
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      return {
        district,
        topCareer: sorted[0]?.[0] ?? "—",
        topCount:  sorted[0]?.[1] ?? 0,
        total:     Object.values(counts).reduce((a, b) => a + b, 0),
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Completion rates
  const totalSessions       = sessions.length;
  const assessedSet         = new Set(assessed.map((a: { session_id: string }) => a.session_id));
  const assessmentRate      = totalSessions > 0 ? Math.round((assessedSet.size / totalSessions) * 100) : 0;
  const recRate             = totalSessions > 0 ? Math.round((recBySession.size / totalSessions) * 100) : 0;
  const maxInterestCount    = topInterests[0]?.count ?? 1;

  return {
    topInterests,
    topGoals,
    topRecs,
    streamTrends,
    districtTrends,
    assessmentRate,
    recRate,
    totalProfiles:    profiles.length,
    totalWithRec:     recBySession.size,
    maxInterestCount,
    allInterestKeys:  Object.keys(INTEREST_LABELS),
  };
}

// ---------------------------------------------------------------------------
// Export data — full enriched rows for CSV download
// ---------------------------------------------------------------------------

export async function getExportData() {
  const db = getServiceClient();

  const [leadsRes, profilesRes, recsRes] = await Promise.all([
    db.from("leads")
      .select("id, name, phone, email, age, district, stream, percentage, preferred_language, created_at, session_id")
      .order("created_at", { ascending: false }),
    db.from("student_profiles").select("session_id, profile"),
    db.from("recommendations")
      .select("session_id, results, overall_confidence, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const leads    = leadsRes.data    ?? [];
  const profiles = profilesRes.data ?? [];
  const recs     = recsRes.data     ?? [];

  const profileMap = new Map(
    profiles.map((p) => [p.session_id, p.profile as Record<string, unknown> | null])
  );
  const recMap = new Map<string, typeof recs[0]>();
  for (const r of recs) {
    if (!recMap.has(r.session_id)) recMap.set(r.session_id, r);
  }

  return leads.map((lead: {
    id: string; name: string; phone: string; email: string | null;
    age: number | null; district: string; stream: string;
    percentage: number | null; preferred_language: string;
    created_at: string; session_id: string;
  }) => {
    const profile = profileMap.get(lead.session_id);
    const rec     = recMap.get(lead.session_id);

    // Interests — sorted by score, threshold 0.1
    const interestMap = profile?.interests as Record<string, number> | undefined;
    const sortedInterests = interestMap
      ? Object.entries(interestMap)
          .filter(([, v]) => v >= 0.1)
          .sort((a, b) => b[1] - a[1])
      : [];
    const primaryInterest    = sortedInterests[0] ? fmtInterest(sortedInterests[0][0]) : "";
    const secondaryInterests = sortedInterests
      .slice(1, 3)
      .map(([k]) => fmtInterest(k))
      .join("; ");

    // Career goal
    const aspiration = profile?.aspiration as Record<string, unknown> | undefined;
    const careerGoal = aspiration?.goalOrientation
      ? fmtGoal(aspiration.goalOrientation as string)
      : "";

    // Work preferences
    const constraints   = profile?.constraints as Record<string, unknown> | undefined;
    const budgetBand    = constraints?.budgetBand    as string | undefined;
    const locationPref  = constraints?.locationPref  as string | undefined;
    const timeToIncome  = constraints?.timeToIncomeNeed as string | undefined;
    const workPref = [
      budgetBand   ? `Budget: ${budgetBand}`           : "",
      locationPref ? `Location: ${locationPref}`       : "",
      timeToIncome ? `Income need: ${timeToIncome}`    : "",
    ].filter(Boolean).join("; ");

    // Aptitude — top 3 with values
    const aptitudeMap = profile?.aptitude as Record<string, number> | undefined;
    const aptitudeSummary = aptitudeMap
      ? Object.entries(aptitudeMap)
          .filter(([, v]) => v != null)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => `${k}: ${Math.round(v)}/100`)
          .join("; ")
      : "";

    // Personality — only non-zero traits
    const personalityMap = profile?.personality as Record<string, number> | undefined;
    const TRAIT_LABELS: Record<string, [string, string]> = {
      analytical:  ["Analytical", "Intuitive"],
      structured:  ["Structured", "Flexible"],
      social:      ["Social",     "Independent"],
      practical:   ["Practical",  "Theoretical"],
      risk_taking: ["Risk-taking","Cautious"],
    };
    const personalitySummary = personalityMap
      ? Object.entries(personalityMap)
          .filter(([, v]) => v != null)
          .map(([k, v]) => {
            const [pos, neg] = TRAIT_LABELS[k] ?? [k, ""];
            return v >= 0 ? `${pos} (${v.toFixed(1)})` : `${neg} (${Math.abs(v).toFixed(1)})`;
          })
          .join("; ")
      : "";

    // Top recommendation
    const results = Array.isArray(rec?.results)
      ? (rec.results as Array<{ name: string; confidence: number }>)
      : [];
    const topRec = results[0];

    return {
      Name:               lead.name,
      Phone:              lead.phone,
      Email:              lead.email ?? "",
      Age:                lead.age != null ? String(lead.age) : "",
      District:           lead.district,
      Stream:             STREAM_LABELS[lead.stream] ?? lead.stream,
      Percentage:         lead.percentage != null ? `${lead.percentage}%` : "",
      "Preferred Language": lead.preferred_language === "ml" ? "Malayalam" : "English",
      "Top Recommendation": topRec?.name ?? "",
      "Confidence Score": topRec ? `${Math.round(topRec.confidence * 100)}%` : "",
      "Primary Interest":  primaryInterest,
      "Secondary Interests": secondaryInterests,
      "Career Goal":       careerGoal,
      "Work Preference":   workPref,
      "Aptitude Summary":  aptitudeSummary,
      "Personality Summary": personalitySummary,
      "Created Date":      new Date(lead.created_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      }),
    };
  });
}
