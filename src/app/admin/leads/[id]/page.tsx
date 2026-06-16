import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadDetail } from "@/lib/admin-data";
import { fmtDate, fmtTime, fmtStream, fmtFunnel, fmtPct, statusPill, completenessBar } from "@/app/admin/_components";

interface Props { params: { id: string } }

export default async function LeadDetailPage({ params }: Props) {
  const data = await getLeadDetail(params.id);
  if (!data) notFound();

  const { lead, session, profile, conversations, assessments, recommendation } = data;
  const p = profile?.profile as Record<string, unknown> | null ?? null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/admin/leads" className="text-sm text-muted-foreground hover:text-foreground">
          ← Leads
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">{lead.name}</h1>
        {statusPill(session?.status ?? null)}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-1">
          {/* Lead info */}
          <Section title="Lead info">
            <Field label="Phone" value={lead.phone} mono />
            {lead.email && <Field label="Email" value={lead.email} />}
            <Field label="Age" value={`${lead.age} yrs${lead.is_minor ? " (minor)" : ""}`} />
            <Field label="District" value={lead.district} />
            <Field label="Stream" value={fmtStream(lead.stream)} />
            <Field label="Marks" value={fmtPct(lead.percentage)} />
            <Field label="Language" value={lead.preferred_language === "ml" ? "Malayalam" : "English"} />
            <Field label="Funnel" value={fmtFunnel(lead.funnel_status)} />
            <Field label="Joined" value={`${fmtDate(lead.created_at)} ${fmtTime(lead.created_at)}`} />
          </Section>

          {/* Session */}
          {session && (
            <Section title="Session">
              <Field label="Status" value={session.status.replace(/_/g, " ")} />
              <Field label="Started" value={fmtDate(session.created_at)} />
              <Field label="Updated" value={fmtDate(session.updated_at)} />
              {profile && (
                <div className="pt-1">
                  <p className="mb-1 text-xs text-muted-foreground">Completeness</p>
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

        {/* ── Right column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile signals */}
          {p && (
            <Section title="Profile signals">
              <ProfileView profile={p} />
            </Section>
          )}

          {/* Recommendation */}
          {recommendation && (
            <Section title={`Recommendation — KB v${recommendation.kb_version}`}>
              <RecommendationView rec={recommendation} />
            </Section>
          )}

          {/* Assessment responses */}
          {assessments.length > 0 && (
            <Section title={`Assessment (${assessments.length} responses)`}>
              <AssessmentView responses={assessments} />
            </Section>
          )}

          {/* Conversation */}
          {conversations.length > 0 && (
            <Section title={`Conversation (${conversations.length} turns)`}>
              <ConversationView messages={conversations} />
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
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
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

// ── Profile signals ───────────────────────────────────────────────────────────

function ProfileView({ profile: p }: { profile: Record<string, unknown> }) {
  const academic = (p.academic ?? {}) as Record<string, unknown>;
  const interests = (p.interests ?? {}) as Record<string, number>;
  const aptitude = (p.aptitude ?? {}) as Record<string, number>;
  const personality = (p.personality ?? {}) as Record<string, number>;
  const aspiration = (p.aspiration ?? {}) as Record<string, unknown>;
  const constraints = (p.constraints ?? {}) as Record<string, unknown>;

  const topInterests = Object.entries(interests)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const strongSubjects = Array.isArray(academic.strongSubjects) ? (academic.strongSubjects as string[]) : [];
  const weakSubjects = Array.isArray(academic.weakSubjects) ? (academic.weakSubjects as string[]) : [];
  const hasAcademic = strongSubjects.length > 0 || weakSubjects.length > 0;

  const aptitudeKeys = ["numerical", "logical", "verbal", "spatial", "scientific"];
  const personalityKeys = ["analytical", "structured", "social", "practical", "risk_taking"];
  const aptitudePairs = aptitudeKeys.filter((k) => aptitude[k] != null).map((k) => ({ k, v: aptitude[k] }));
  const personalityPairs = personalityKeys.filter((k) => personality[k] != null).map((k) => ({ k, v: personality[k] }));

  const goalOrientation = typeof aspiration.goalOrientation === "string" ? aspiration.goalOrientation : null;
  const budgetBand = typeof constraints.budgetBand === "string" ? constraints.budgetBand : null;
  const locationPref = typeof constraints.locationPref === "string" ? constraints.locationPref : null;
  const timeToIncomeNeed = typeof constraints.timeToIncomeNeed === "string" ? constraints.timeToIncomeNeed : null;

  return (
    <div className="space-y-5">
      {/* Academic */}
      {hasAcademic && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Academic</p>
          {strongSubjects.length > 0 && (
            <p className="text-xs">
              <span className="text-muted-foreground">Strong: </span>
              {strongSubjects.join(", ")}
            </p>
          )}
          {weakSubjects.length > 0 && (
            <p className="text-xs">
              <span className="text-muted-foreground">Weak: </span>
              {weakSubjects.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Interests */}
      {topInterests.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Interests
          </p>
          <div className="space-y-1.5">
            {topInterests.map(([k, v]) => (
              <ScoreBar key={k} label={k.replace(/_/g, " ")} value={v} max={1} />
            ))}
          </div>
        </div>
      )}

      {/* Aptitude */}
      {aptitudePairs.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Aptitude
          </p>
          <div className="space-y-1.5">
            {aptitudePairs.map(({ k, v }) => (
              <ScoreBar key={k} label={k} value={v} max={100} />
            ))}
          </div>
        </div>
      )}

      {/* Personality */}
      {personalityPairs.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Personality
          </p>
          <div className="space-y-1.5">
            {personalityPairs.map(({ k, v }) => (
              <ScoreBar
                key={k}
                label={k.replace(/_/g, " ")}
                value={v}
                max={1}
                signed
              />
            ))}
          </div>
        </div>
      )}

      {/* Goal & constraints */}
      {(goalOrientation ?? budgetBand ?? locationPref ?? timeToIncomeNeed) && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Goals & constraints
          </p>
          <div className="flex flex-wrap gap-2">
            {goalOrientation && <Tag label={goalOrientation.replace(/_/g, " ")} />}
            {budgetBand && <Tag label={`Budget: ${budgetBand}`} />}
            {locationPref && <Tag label={`Location: ${locationPref}`} />}
            {timeToIncomeNeed && <Tag label={`Income: ${timeToIncomeNeed}`} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
  signed = false,
}: {
  label: string;
  value: number;
  max: number;
  signed?: boolean;
}) {
  const normalised = signed
    ? (value + 1) / 2 // -1..1 → 0..1
    : Math.min(value / max, 1);
  const pct = Math.round(normalised * 100);
  const displayValue = max === 100 ? Math.round(value) : value.toFixed(2);

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs capitalize text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-muted-foreground">{displayValue}</span>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
      {label}
    </span>
  );
}

// ── Recommendation ────────────────────────────────────────────────────────────

function RecommendationView({ rec }: { rec: { results: unknown; overall_confidence: number | null; explanation: string | null; created_at: string } }) {
  const results = (Array.isArray(rec.results) ? rec.results : []) as Array<{
    id: string;
    name: string;
    fitScore: number;
    confidence: number;
    factors?: Array<{ label: string; contribution: number }>;
  }>;
  const top3 = results.slice(0, 3);

  return (
    <div className="space-y-3">
      {rec.overall_confidence != null && (
        <p className="text-xs text-muted-foreground">
          Overall confidence:{" "}
          <span className="font-semibold text-foreground">
            {Math.round(rec.overall_confidence * 100)}%
          </span>
          {" · "}{fmtDate(rec.created_at)}
        </p>
      )}

      {top3.map((career, i) => (
        <div key={career.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="mr-2 text-xs font-bold text-muted-foreground">#{i + 1}</span>
              <span className="font-semibold">{career.name}</span>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <div>Fit: <span className="font-semibold text-foreground">{Math.round(career.fitScore * 100)}%</span></div>
              <div>Conf: <span className="font-semibold text-foreground">{Math.round(career.confidence * 100)}%</span></div>
            </div>
          </div>
          {career.factors && career.factors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {career.factors.slice(0, 3).map((f) => (
                <span key={f.label} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {f.label} ({(f.contribution * 100).toFixed(0)}%)
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {rec.explanation && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">AI explanation</p>
          <p className="mt-1 text-sm leading-relaxed">{rec.explanation}</p>
        </div>
      )}
    </div>
  );
}

// ── Assessment ────────────────────────────────────────────────────────────────

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

// ── Conversation ──────────────────────────────────────────────────────────────

function ConversationView({ messages }: {
  messages: Array<{ role: string; stage: string | null; content: string; created_at: string }>;
}) {
  return (
    <div className="space-y-3">
      {messages
        .filter((m) => m.role !== "system")
        .map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background"
                }`}
              >
                {m.stage && (
                  <p className={`mb-1 text-xs font-medium ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {m.stage}
                  </p>
                )}
                <p className="leading-relaxed">{m.content}</p>
                <p className={`mt-1 text-xs ${isUser ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {fmtTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
    </div>
  );
}
