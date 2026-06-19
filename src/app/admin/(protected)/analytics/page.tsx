import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalytics } from "@/lib/admin-data";
import { fmtStream } from "@/app/admin/_components";

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  const {
    topInterests, topGoals, topRecs,
    streamTrends, districtTrends,
    assessmentRate, recRate,
    totalProfiles, totalWithRec,
    maxInterestCount,
  } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregated insights across {totalProfiles} student profiles
        </p>
      </div>

      {/* ── Completion rates ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Profiles collected"     value={totalProfiles} />
        <StatCard title="Recommendations given"  value={totalWithRec} />
        <StatCard title="Assessment completion"  value={`${assessmentRate}%`} />
        <StatCard title="Recommendation rate"    value={`${recRate}%`} />
      </div>

      {/* ── Interests + Goals ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Most common interests / clusters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Top interest clusters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topInterests.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            {topInterests.map(({ key, label, count }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-foreground sm:w-44">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((count / maxInterestCount) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Career goals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Most common career goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topGoals.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            {topGoals.map(({ key, label, count }) => {
              const maxGoal = topGoals[0]?.count ?? 1;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-foreground sm:w-44">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${Math.round((count / maxGoal) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Top recommendations ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Most common recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          {topRecs.length === 0 && (
            <p className="text-sm text-muted-foreground">No recommendations generated yet.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {topRecs.map(({ name, count }, i) => {
              const maxRec = topRecs[0]?.count ?? 1;
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground">
                    #{i + 1}
                  </span>
                  <span className="w-32 shrink-0 truncate text-xs sm:w-52">{name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.round((count / maxRec) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Stream + District trends ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Stream-wise career trends */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Stream-wise career trends</CardTitle>
          </CardHeader>
          <CardContent>
            {streamTrends.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Stream</th>
                  <th className="pb-2 font-medium">Top career</th>
                  <th className="pb-2 text-right font-medium">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {streamTrends.map(({ stream, streamLabel, topCareer, total }) => (
                  <tr key={stream}>
                    <td className="py-2 font-medium">{streamLabel}</td>
                    <td className="py-2 text-muted-foreground">{topCareer}</td>
                    <td className="py-2 text-right text-muted-foreground">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>

        {/* District-wise career trends */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">District-wise career trends</CardTitle>
          </CardHeader>
          <CardContent>
            {districtTrends.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">District</th>
                  <th className="pb-2 font-medium">Top career</th>
                  <th className="pb-2 text-right font-medium">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {districtTrends.map(({ district, topCareer, total }) => (
                  <tr key={district}>
                    <td className="py-2 font-medium">{district}</td>
                    <td className="py-2 text-muted-foreground">{topCareer}</td>
                    <td className="py-2 text-right text-muted-foreground">{total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// keep fmtStream imported so the module doesn't warn — used implicitly via getAnalytics labels
void fmtStream;
