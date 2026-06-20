import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadDetail } from "@/lib/admin-data";
import {
  fmtDate, fmtTime, fmtStream, fmtFunnel, fmtPct,
  fmtInterest, fmtGoal,
  statusPill, completenessBar,
  BUDGET_LABELS, LOCATION_LABELS,
} from "@/app/admin/_components";

interface Props { params: { id: string } }

type StoredCourse = {
  courseId: string;
  name: string;
  routeType: string;
  eligibility: string;
  feeBand?: string;
};
type CareerRec = {
  careerId?: string;
  name: string;
  domain: string;
  fitScore: number;
  confidence: number;
  courses: StoredCourse[];
};

export default async function LeadDetailPage({ params }: Props) {
  const data = await getLeadDetail(params.id);
  if (!data) notFound();

  const { lead, session, profile, recommendation } = data;
  const l = lead as Record<string, unknown>;
  const p = profile?.profile as Record<string, unknown> | null ?? null;

  const academic    = (p?.academic    ?? {}) as Record<string, unknown>;
  const interests   = (p?.interests   ?? {}) as Record<string, number>;
  const aptitude    = (p?.aptitude    ?? {}) as Record<string, number>;
  const personality = (p?.personality ?? {}) as Record<string, number>;
  const aspiration  = (p?.aspiration  ?? {}) as Record<string, unknown>;
  const constraints = (p?.constraints ?? {}) as Record<string, unknown>;

  const strongSubjects = Array.isArray(academic.strongSubjects) ? (academic.strongSubjects as string[]) : [];

  const sortedInterests = Object.entries(interests)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const aptitudeKeys    = ["numerical", "logical", "verbal", "spatial", "scientific"];
  const personalityKeys = ["analytical", "structured", "social", "practical", "risk_taking"];
  const aptitudePairs    = aptitudeKeys.filter((k) => aptitude[k] != null).map((k) => ({ k, v: aptitude[k] }));
  const personalityPairs = personalityKeys.filter((k) => personality[k] != null).map((k) => ({ k, v: personality[k] }));

  const goalOrientation  = typeof aspiration.goalOrientation  === "string" ? aspiration.goalOrientation  : null;
  const budgetBand       = typeof constraints.budgetBand      === "string" ? constraints.budgetBand      : null;
  const locationPref     = typeof constraints.locationPref    === "string" ? constraints.locationPref    : null;
  const timeToIncomeNeed = typeof constraints.timeToIncomeNeed=== "string" ? constraints.timeToIncomeNeed: null;

  const recResults: CareerRec[] = Array.isArray(recommendation?.results)
    ? (recommendation.results as CareerRec[])
    : [];

  const displayName = (l.name as string) && l.name !== "Unknown" ? l.name as string : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/leads" className="text-sm text-muted-foreground hover:text-foreground">
          ← Leads
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">{displayName ?? `+${l.phone as string}`}</h1>
        {statusPill(session?.status ?? null)}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">

        {/* ══ Left column ══════════════════════════════════════════════════════ */}
        <div className="space-y-4 lg:col-span-1">

          {/* Basic details */}
          <Section title="Basic details">
            {displayName && <Field label="Name"     value={displayName} />}
            <Field label="Phone"    value={l.phone as string} mono />
            {Boolean(l.email)  && <Field label="Email"    value={l.email  as string} />}
            {l.age != null && (
              <Field label="Age" value={`${l.age} yrs${l.is_minor ? " (minor)" : ""}`} />
            )}
            {Boolean(l.district) && <Field label="District"  value={l.district  as string} />}
            {Boolean(l.preferred_language) && (
              <Field label="Language" value={(l.preferred_language as string) === "ml" ? "Malayalam" : "English"} />
            )}
            {Boolean(l.funnel_status) && (
              <Field label="Funnel" value={fmtFunnel(l.funnel_status as string)} />
            )}
            <Field label="Joined" value={`${fmtDate(l.created_at as string)} ${fmtTime(l.created_at as string)}`} />
          </Section>

          {/* Academic */}
          <Section title="Academic details">
            <Field label="Stream" value={fmtStream(l.stream as string)} />
            {l.percentage != null && <Field label="Marks" value={fmtPct(l.percentage as number | null)} />}
            {strongSubjects.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Strong subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {strongSubjects.map((s) => (
                    <span key={s} className="rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 capitalize">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Goals & preferences */}
          {(goalOrientation ?? budgetBand ?? locationPref ?? timeToIncomeNeed) && (
            <Section title="Goals & preferences">
              {goalOrientation && <Field label="Goal" value={fmtGoal(goalOrientation)} />}
              {budgetBand && <Field label="Budget" value={BUDGET_LABELS[budgetBand] ?? budgetBand} />}
              {locationPref && <Field label="Location" value={LOCATION_LABELS[locationPref] ?? locationPref} />}
              {timeToIncomeNeed && (
                <Field label="Income need" value={timeToIncomeNeed === "urgent" ? "Urgent" : "Flexible"} />
              )}
            </Section>
          )}

          {/* Session */}
          {session && (
            <Section title="Session">
              <Field label="Status"  value={session.status.replace(/_/g, " ")} />
              <Field label="Started" value={fmtDate(session.created_at)} />
              <Field label="Updated" value={fmtDate(session.updated_at)} />
              {profile && (
                <div className="pt-1">
                  <p className="mb-1 text-xs text-muted-foreground">Profile completeness</p>
                  {completenessBar(profile.completeness_pct)}
                </div>
              )}
            </Section>
          )}
        </div>

        {/* ══ Right column ═════════════════════════════════════════════════════ */}
        <div className="space-y-4 lg:col-span-2">

          {/* Recommendation */}
          {recResults.length > 0 && (
            <Section title="Career recommendations">
              <div className="space-y-4">
                {recResults.map((career, i) => (
                  <div key={career.careerId ?? i} className="rounded-lg border bg-muted/20 p-4">
                    {/* Career header */}
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                          <span className="font-semibold">{career.name}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground capitalize">
                            {career.domain?.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold">{Math.round(career.fitScore * 100)}%</p>
                        <p className="text-[10px] text-muted-foreground">fit · {Math.round(career.confidence * 100)}% confidence</p>
                      </div>
                    </div>

                    {/* Courses */}
                    {career.courses.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Courses</p>
                        <div className="space-y-1">
                          {career.courses.map((c) => (
                            <div key={c.courseId} className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2">
                              <span className="text-xs font-medium">{c.name}</span>
                              <div className="flex shrink-0 items-center gap-2">
                                {c.feeBand && (
                                  <span className="text-[10px] text-muted-foreground">{c.feeBand}</span>
                                )}
                                <EligibilityBadge status={c.eligibility} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Interests */}
          {sortedInterests.length > 0 && (
            <Section title="Interest profile">
              <div className="space-y-2">
                {sortedInterests.map(([k, v]) => (
                  <ScoreBar key={k} label={fmtInterest(k)} value={v} max={1} />
                ))}
              </div>
            </Section>
          )}

          {/* Aptitude */}
          {aptitudePairs.length > 0 && (
            <Section title="Aptitude scores">
              <div className="space-y-2">
                {aptitudePairs.map(({ k, v }) => (
                  <ScoreBar key={k} label={k} value={v} max={100} />
                ))}
              </div>
            </Section>
          )}

          {/* Personality */}
          {personalityPairs.length > 0 && (
            <Section title="Personality">
              <div className="space-y-2">
                {personalityPairs.map(({ k, v }) => (
                  <PersonalityBar key={k} traitKey={k} value={v} />
                ))}
              </div>
            </Section>
          )}

          {/* Empty state */}
          {recResults.length === 0 && sortedInterests.length === 0 && aptitudePairs.length === 0 && (
            <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
              Profile not yet complete — recommendation pending.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`break-all font-medium sm:text-right ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</span>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round(Math.min(value / max, 1) * 100);
  const display = max === 100 ? `${Math.round(value)}/100` : `${(value * 100).toFixed(0)}%`;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs capitalize text-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{display}</span>
    </div>
  );
}

const PERSONALITY_POLES: Record<string, [string, string]> = {
  analytical:  ["Analytical",  "Intuitive"],
  structured:  ["Structured",  "Flexible"],
  social:      ["Social",      "Independent"],
  practical:   ["Practical",   "Theoretical"],
  risk_taking: ["Risk-taking", "Cautious"],
};

function PersonalityBar({ traitKey, value }: { traitKey: string; value: number }) {
  const [posLabel, negLabel] = PERSONALITY_POLES[traitKey] ?? [traitKey, ""];
  const absPct = Math.round(Math.abs(value) * 100);
  const isPositive = value >= 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-foreground">{isPositive ? posLabel : negLabel}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${isPositive ? "bg-blue-500" : "bg-orange-400"}`}
          style={{ width: `${absPct}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{absPct}%</span>
    </div>
  );
}

function EligibilityBadge({ status }: { status: string }) {
  const cls = status === "eligible"
    ? "bg-green-100 text-green-800"
    : status === "conditional"
    ? "bg-yellow-100 text-yellow-800"
    : "bg-red-100 text-red-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}
