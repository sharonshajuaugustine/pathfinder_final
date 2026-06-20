import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStats, getLeads } from "@/lib/admin-data";
import { fmtDate, fmtStream, fmtFunnel, statusPill, completenessBar } from "@/app/admin/_components";

export default async function AdminOverview() {
  const [stats, recentResult] = await Promise.all([
    getStats(),
    getLeads({}, 10),
  ]);
  const recent = recentResult.rows;

  const completionRate =
    stats.totalLeads > 0
      ? Math.round((stats.completedSessions / stats.totalLeads) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live student funnel data</p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Leads" value={stats.totalLeads} />
        <StatCard title="Total Sessions" value={stats.totalSessions} />
        <StatCard title="Recommendations" value={stats.totalRecommendations} />
        <StatCard title="Completion Rate" value={`${completionRate}%`} />
      </div>

      {/* ── Recent leads ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent leads</h2>
          <Link href="/admin/leads" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <LeadsTable rows={recent} />
        </div>
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

function LeadsTable({ rows }: { rows: import("@/lib/admin-data").LeadRow[] }) {
  if (!rows.length) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">No leads yet.</p>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <Th>Name</Th>
          <Th>Stream</Th>
          <Th>District</Th>
          <Th>Status</Th>
          <Th>Completeness</Th>
          <Th>Date</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
            <td className="px-4 py-3">
              <Link
                href={`/admin/leads/${r.id}`}
                className="font-medium text-primary hover:underline"
              >
                {r.name}
              </Link>
              <div className="text-xs text-muted-foreground">{fmtFunnel(r.funnel_status)}</div>
            </td>
            <td className="px-4 py-3">{fmtStream(r.stream)}</td>
            <td className="px-4 py-3">{r.district}</td>
            <td className="px-4 py-3">{statusPill(r.sessionStatus)}</td>
            <td className="px-4 py-3">{completenessBar(r.completeness)}</td>
            <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-medium">{children}</th>;
}
