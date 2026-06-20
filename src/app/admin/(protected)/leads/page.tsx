import Link from "next/link";
import { getLeads } from "@/lib/admin-data";
import {
  fmtDate, fmtStream, fmtFunnel, fmtPct, statusPill, completenessBar, STREAM_LABELS,
} from "@/app/admin/_components";

interface Props {
  searchParams: { stream?: string; district?: string; from?: string; to?: string; search?: string; page?: string };
}

const STREAMS = Object.entries(STREAM_LABELS);
const PAGE_SIZE = 50;

export default async function LeadsPage({ searchParams }: Props) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const filters = {
    stream:   searchParams.stream   || undefined,
    district: searchParams.district || undefined,
    from:     searchParams.from     || undefined,
    to:       searchParams.to       || undefined,
    search:   searchParams.search   || undefined,
    page,
  };
  const { rows: leads, total } = await getLeads(filters, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== "page" && Boolean(v));

  function paginationHref(p: number) {
    const sp = new URLSearchParams();
    if (filters.stream)   sp.set("stream",   filters.stream);
    if (filters.district) sp.set("district", filters.district);
    if (filters.from)     sp.set("from",     filters.from);
    if (filters.to)       sp.set("to",       filters.to);
    if (filters.search)   sp.set("search",   filters.search);
    sp.set("page", String(p));
    return `/admin/leads?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} result{total !== 1 ? "s" : ""}
          {hasFilters ? " (filtered)" : ""}
          {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
        </p>
      </div>

      {/* ── Filter form ── */}
      <form method="GET" action="/admin/leads" className="flex flex-wrap items-end gap-3">
        {/* Name / phone search */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Name / Phone</label>
          <input
            name="search"
            type="text"
            defaultValue={filters.search ?? ""}
            placeholder="Search name or phone…"
            className="rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

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
        {hasFilters && (
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
                <Th className="hidden sm:table-cell">Phone</Th>
                <Th>Stream</Th>
                <Th className="hidden md:table-cell">District</Th>
                <Th className="hidden md:table-cell">Marks</Th>
                <Th className="hidden lg:table-cell">Funnel</Th>
                <Th>Session</Th>
                <Th className="hidden lg:table-cell">Completeness</Th>
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
                    <p className="text-xs text-muted-foreground sm:hidden">{r.phone}</p>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">{r.phone}</td>
                  <td className="px-4 py-3">{fmtStream(r.stream)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{r.district}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{fmtPct(r.percentage)}</td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{fmtFunnel(r.funnel_status)}</td>
                  <td className="px-4 py-3">{statusPill(r.sessionStatus)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{completenessBar(r.completeness)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <Link
            href={paginationHref(page - 1)}
            aria-disabled={page <= 1}
            className={`rounded-md border px-4 py-1.5 text-sm ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"
            }`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={paginationHref(page + 1)}
            aria-disabled={page >= totalPages}
            className={`rounded-md border px-4 py-1.5 text-sm ${
              page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted"
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2 font-medium ${className ?? ""}`}>{children}</th>;
}
