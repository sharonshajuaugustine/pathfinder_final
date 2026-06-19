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

// ── Types matching the stored CareerRecommendation JSON ──────────────────────
type StoredCourse = {
  courseId: string;
  name: string;
  routeType: string;
  eligibility: string;
  eligibilityNotes: string[];
  exams: Array<{ examId: string; name: string; requirement: string; difficulty?: string }>;
  feeBand?: string;
};
type StoredSkill = { stage: string; skillName: string; resourceType?: string };
type StoredAlt   = { careerId: string; name: string; reason: string };
type StoredFactor= { dimension: string; label: string; contribution: number };
type CareerRec   = {
  careerId?: string;
  name: string;
  domain: string;
  fitScore: number;
  confidence: number;
  factors: StoredFactor[];
  courses: StoredCourse[];
  skills: StoredSkill[];
  alternatives: StoredAlt[];
};

export default async function LeadDetailPage({ params }: Props) {
  const data = await getLeadDetail(params.id);
  if (!data) notFound();

  const { lead, session, profile, assessments, recommendation } = data;
  const p = profile?.profile as Record<string, unknown> | null ?? null;

  // Parse profile sub-sections once
  const academic    = (p?.academic    ?? {}) as Record<string, unknown>;
  const interests   = (p?.interests   ?? {}) as Record<string, number>;
  const aptitude    = (p?.aptitude    ?? {}) as Record<string, number>;
  const personality = (p?.personality ?? {}) as Record<string, number>;
  const aspiration  = (p?.aspiration  ?? {}) as Record<string, unknown>;
  const constraints = (p?.constraints ?? {}) as Record<string, unknown>;

  const strongSubjects = Array.isArray(academic.strongSubjects) ? (academic.strongSubjects as string[]) : [];
  const weakSubjects   = Array.isArray(academic.weakSubjects)   ? (academic.weakSubjects   as string[]) : [];

  const sortedInterests = Object.entries(interests)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const aptitudeKeys    = ["numerical", "logical", "verbal", "spatial", "scientific"];
  const personalityKeys = ["analytical", "structured", "social", "practical", "risk_taking"];
  const aptitudePairs    = aptitudeKeys.filter((k) => aptitude[k] != null).map((k) => ({ k, v: aptitude[k] }));
  const personalityPairs = personalityKeys.filter((k) => personality[k] != null).map((k) => ({ k, v: personality[k] }));

  const goalOrientation  = typeof aspiration.goalOrientation  === "string" ? aspiration.goalOrientation  : null;
  const riskAppetite     = typeof aspiration.riskAppetite     === "number" ? aspiration.riskAppetite     : null;
  const budgetBand       = typeof constraints.budgetBand      === "string" ? constraints.budgetBand      : null;
  const locationPref     = typeof constraints.locationPref    === "string" ? constraints.locationPref    : null;
  const timeToIncomeNeed = typeof constraints.timeToIncomeNeed=== "string" ? constraints.timeToIncomeNeed: null;
  const relocationWilling= typeof constraints.relocationWilling==="boolean"? constraints.relocationWilling: null;

  // Parse recommendation results
  const recResults: CareerRec[] = Array.isArray(recommendation?.results)
    ? (recommendation.results as CareerRec[])
    : [];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/admin/leads" className="text-sm text-muted-foreground hover:text-foreground">
          ← Leads
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">{(lead as Record<string, unknown>).name as string}</h1>
        {statusPill(session?.status ?? null)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* ══ Left column ══════════════════════════════════════════════════════ */}
        <div className="space-y-5 lg:col-span-1">

          {/* Basic details */}
          <Section title="Basic details">
            <Field label="Phone"    value={(lead as Record<string, unknown>).phone as string} mono />
            {(lead as Record<string, unknown>).email != null && (
              <Field label="Email"  value={(lead as Record<string, unknown>).email as string} />
            )}
            <Field label="Age"      value={`${(lead as Record<string, unknown>).age} yrs${(lead as Record<string, unknown>).is_minor ? " (minor)" : ""}`} />
            <Field label="District" value={(lead as Record<string, unknown>).district as string} />
            <Field label="Language" value={(lead as Record<string, unknown>).preferred_language === "ml" ? "Malayalam" : "English"} />
            <Field label="Funnel"   value={fmtFunnel((lead as Record<string, unknown>).funnel_status as string)} />
            <Field label="Joined"   value={`${fmtDate((lead as Record<string, unknown>).created_at as string)} ${fmtTime((lead as Record<string, unknown>).created_at as string)}`} />
          </Section>

          {/* Academic details */}
          <Section title="Academic details">
            <Field label="Stream"     value={fmtStream((lead as Record<string, unknown>).stream as string)} />
            <Field label="Marks"      value={fmtPct((lead as Record<string, unknown>).percentage as number | null)} />
            {strongSubjects.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Favourite subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {strongSubjects.map((s) => <Chip key={s} label={s} color="green" />)}
                </div>
              </div>
            )}
            {weakSubjects.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Weak subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {weakSubjects.map((s) => <Chip key={s} label={s} color="red" />)}
                </div>
              </div>
            )}
          </Section>

          {/* Career goals & work preferences */}
          {(goalOrientation ?? budgetBand ?? locationPref ?? timeToIncomeNeed) && (
            <Section title="Career goals & work preferences">
              {goalOrientation && (
                <Field label="Goal" value={fmtGoal(goalOrientation)} />
              )}
              {riskAppetite != null && (
                <Field label="Risk appetite" value={riskAppetite >= 0.6 ? "High" : riskAppetite >= 0.4 ? "Moderate" : "Low"} />
              )}
              {budgetBand && (
                <Field label="Budget" value={BUDGET_LABELS[budgetBand] ?? budgetBand} />
              )}
              {locationPref && (
                <Field label="Location" value={LOCATION_LABELS[locationPref] ?? locationPref} />
              )}
              {timeToIncomeNeed && (
                <Field label="Income need" value={timeToIncomeNeed === "urgent" ? "Urgent (ASAP)" : "Flexible"} />
              )}
              {relocationWilling != null && (
                <Field label="Relocation" value={relocationWilling ? "Willing to relocate" : "Prefers local"} />
              )}
            </Section>
          )}

          {/* Session status */}
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

          {/* Conflict flags */}
          {profile?.conflict_flags && Array.isArray(profile.conflict_flags) && profile.conflict_flags.length > 0 && (
            <Section title="Conflict flags">
              <div className="space-y-2">
                {(profile.conflict_flags as Array<{ type: string; detail: string; severity: string }>).map((f, i) => (
                  <div key={i} className="rounded border-l-2 border-orange-400 bg-orange-50 px-3 py-2">
                    <p className="text-xs font-medium text-orange-800">{f.type}</p>
                    <p className="text-xs text-orange-700">{f.detail}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ══ Right column ═════════════════════════════════════════════════════ */}
        <div className="space-y-5 lg:col-span-2">

          {/* Interests */}
          {sortedInterests.length > 0 && (
            <Section title="Interests">
              <div className="space-y-2">
                {sortedInterests.map(([k, v]) => (
                  <ScoreBar
                    key={k}
                    label={fmtInterest(k)}
                    value={v}
                    max={1}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Aptitude scores */}
          {aptitudePairs.length > 0 && (
            <Section title="Aptitude scores">
              <div className="space-y-2">
                {aptitudePairs.map(({ k, v }) => (
                  <ScoreBar key={k} label={k} value={v} max={100} />
                ))}
              </div>
            </Section>
          )}

          {/* Personality summary */}
          {personalityPairs.length > 0 && (
            <Section title="Personality summary">
              <div className="space-y-2">
                {personalityPairs.map(({ k, v }) => (
                  <PersonalityBar key={k} traitKey={k} value={v} />
                ))}
              </div>
            </Section>
          )}

          {/* Recommendation results */}
          {recResults.length > 0 && (
            <Section title={`Recommendation results — KB v${recommendation?.kb_version ?? "?"}`}>
              <RecommendationView results={recResults} />
            </Section>
          )}

          {/* Assessment responses */}
          {assessments.length > 0 && (
            <Section title={`Assessment responses (${assessments.length})`}>
              <AssessmentView responses={assessments} />
            </Section>
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
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: "green" | "red" | "gray" }) {
  const cls = color === "green"
    ? "bg-green-50 text-green-700 border-green-200"
    : color === "red"
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round(Math.min(value / max, 1) * 100);
  const display = max === 100 ? Math.round(value) : (value * 100).toFixed(0) + "%";
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs capitalize text-foreground sm:w-40">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {display}
      </span>
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
  const label = isPositive ? posLabel : negLabel;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-foreground sm:w-40">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${isPositive ? "bg-blue-500" : "bg-orange-400"}`}
          style={{ width: `${absPct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {absPct}%
      </span>
    </div>
  );
}

// ── Recommendation view ───────────────────────────────────────────────────────

function RecommendationView({ results }: { results: CareerRec[] }) {
  return (
    <div className="space-y-6">
      {results.map((career, i) => (
        <CareerCard key={career.careerId ?? i} career={career} rank={i + 1} />
      ))}
    </div>
  );
}

function CareerCard({ career, rank }: { career: CareerRec; rank: number }) {
  // Group skills by stage
  const foundation   = career.skills.filter((s) => s.stage === "foundation");
  const intermediate = career.skills.filter((s) => s.stage === "intermediate");
  const advanced     = career.skills.filter((s) => s.stage === "advanced");

  // Deduplicate entrance exams across all courses
  const examMap = new Map<string, StoredCourse["exams"][0]>();
  for (const course of career.courses) {
    for (const exam of course.exams ?? []) {
      if (!examMap.has(exam.examId)) examMap.set(exam.examId, exam);
    }
  }
  const exams = Array.from(examMap.values());

  return (
    <div className="rounded-lg border bg-background p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
            <h3 className="font-semibold">{career.name}</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground capitalize">
              {career.domain?.replace(/_/g, " ")}
            </span>
          </div>
          {career.factors.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {career.factors.slice(0, 3).map((f) => (
                <span key={f.label} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {f.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold">{Math.round(career.fitScore * 100)}%</p>
          <p className="text-xs text-muted-foreground">fit</p>
          <p className="mt-0.5 text-sm font-semibold">{Math.round(career.confidence * 100)}%</p>
          <p className="text-xs text-muted-foreground">confidence</p>
        </div>
      </div>

      {/* Course options */}
      {career.courses.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Course options
          </p>
          <div className="space-y-1.5">
            {career.courses.map((c) => (
              <div key={c.courseId} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{c.name}</p>
                  {c.eligibilityNotes.length > 0 && (
                    <p className="text-xs text-muted-foreground">{c.eligibilityNotes[0]}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <EligibilityBadge status={c.eligibility} />
                  <span className="rounded bg-background px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                    {c.routeType.replace(/-/g, " ")}
                  </span>
                  {c.feeBand && (
                    <span className="text-xs text-muted-foreground">Fee: {c.feeBand}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entrance exams */}
      {exams.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Entrance exams
          </p>
          <div className="flex flex-wrap gap-2">
            {exams.map((e) => (
              <div key={e.examId} className="rounded-md border px-2.5 py-1.5 text-xs">
                <p className="font-medium">{e.name}</p>
                <p className="text-muted-foreground capitalize">
                  {e.requirement.replace(/-/g, " ")}
                  {e.difficulty ? ` · ${e.difficulty}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills roadmap */}
      {career.skills.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Skill roadmap
          </p>
          <div className="space-y-2">
            {foundation.length > 0 && (
              <SkillGroup stage="Foundation" skills={foundation} color="blue" />
            )}
            {intermediate.length > 0 && (
              <SkillGroup stage="Intermediate" skills={intermediate} color="violet" />
            )}
            {advanced.length > 0 && (
              <SkillGroup stage="Advanced" skills={advanced} color="emerald" />
            )}
          </div>
        </div>
      )}

      {/* Alternative career suggestions */}
      {career.alternatives.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Alternative careers
          </p>
          <div className="space-y-1.5">
            {career.alternatives.map((alt) => (
              <div key={alt.careerId} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2">
                <span className="text-xs font-medium">{alt.name}</span>
                {alt.reason && (
                  <span className="text-xs text-muted-foreground">— {alt.reason}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
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
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

function SkillGroup({
  stage, skills, color,
}: {
  stage: string;
  skills: StoredSkill[];
  color: "blue" | "violet" | "emerald";
}) {
  const borderCls = color === "blue" ? "border-blue-300" : color === "violet" ? "border-violet-300" : "border-emerald-300";
  const labelCls  = color === "blue" ? "text-blue-700"   : color === "violet" ? "text-violet-700"   : "text-emerald-700";
  return (
    <div className={`rounded-md border-l-2 pl-3 ${borderCls}`}>
      <p className={`mb-1 text-xs font-semibold ${labelCls}`}>{stage}</p>
      <ul className="space-y-0.5">
        {skills.map((s, i) => (
          <li key={i} className="flex items-baseline gap-1.5 text-xs text-foreground">
            <span>•</span>
            <span>{s.skillName}</span>
            {s.resourceType && (
              <span className="text-muted-foreground capitalize">({s.resourceType})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Assessment responses ──────────────────────────────────────────────────────

function AssessmentView({ responses }: {
  responses: Array<{ item_id: string; dimension: string; answer: string; score: number | null }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Question</th>
            <th className="pb-2 font-medium">Dimension</th>
            <th className="pb-2 font-medium">Answer</th>
            <th className="pb-2 font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {responses.map((r, i) => (
            <tr key={i}>
              <td className="py-1.5 font-mono">{r.item_id}</td>
              <td className="py-1.5 capitalize text-muted-foreground">{r.dimension}</td>
              <td className="py-1.5 font-mono uppercase">{r.answer}</td>
              <td className="py-1.5">
                {r.score != null ? (
                  <span className={r.score >= 50 ? "text-green-700" : r.score === 0 ? "text-red-600" : "text-muted-foreground"}>
                    {r.score}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
