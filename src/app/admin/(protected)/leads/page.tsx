import Link from "next/link";
import { getLeads } from "@/lib/admin-data";
import {
  fmtDate, fmtStream, fmtFunnel, fmtPct, statusPill, completenessBar, STREAM_LABELS,
} from "@/app/admin/_components";

interface Props {
  searchParams: { stream?: string; district?: string; from?: string; to?: string };
}

const STREAMS = Object.entries(STREAM_LABELS);

export default async function LeadsPage({ searchParams }: Props) {
  const filters = {
    stream: searchParams.stream || undefined,
    district: searchParams.district || undefined,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
  };
  const leads = await getLeads(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {leads.length} result{leads.length !== 1 ? "s" : ""}
          {Object.values(filters).some(Boolean) ? " (filtered)" : ""}
        </p>
      </div>

      {/* ── Filter form ── */}
      <form method="GET" action="/admin/leads" className="flex flex-wrap items-end gap-3">
        {/* Stream */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Stream</label>
          <select
            name="stream"
            defaultValue={filters.stream ?? ""}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All streams</option>
            {STREAMS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        {/* District */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">District</label>
          <input
            name="district"
            type="text"
            defaultValue={filters.district ?? ""}
            placeholder="e.g. Ernakulam"
            className="rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Date from */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Date to */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        {Object.values(filters).some(Boolean) && (
          <Link
            href="/admin/leads"
            className="rounded-md border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Clear
          </Link>
        )}
      </form>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border bg-background">
        {leads.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No leads match your filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Stream</Th>
                <Th>District</Th>
                <Th>Marks</Th>
                <Th>Funnel</Th>
                <Th>Session</Th>
                <Th>Completeness</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/leads/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.phone}</td>
                  <td className="px-4 py-3">{fmtStream(r.stream)}</td>
                  <td className="px-4 py-3">{r.district}</td>
                  <td className="px-4 py-3">{fmtPct(r.percentage)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtFunnel(r.funnel_status)}</td>
                  <td className="px-4 py-3">{statusPill(r.sessionStatus)}</td>
                  <td className="px-4 py-3">{completenessBar(r.completeness)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-medium">{children}</th>;
}
