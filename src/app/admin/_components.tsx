// Shared display helpers for admin pages.
// Pure functions — no hooks, safe to import in server components.

export const STREAM_LABELS: Record<string, string> = {
  science_bio: "Science (Bio)",
  science_maths: "Science (Maths)",
  science_cs: "Science (CS)",
  commerce: "Commerce",
  humanities: "Humanities",
};

export const FUNNEL_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  counselling_booked: "Booked",
  converted: "Converted",
  closed: "Closed",
};

const STATUS_CLASSES: Record<string, string> = {
  started: "bg-gray-100 text-gray-700",
  onboarded: "bg-blue-100 text-blue-700",
  in_chat: "bg-yellow-100 text-yellow-800",
  assessment: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  abandoned: "bg-red-100 text-red-700",
};

export function fmtStream(s: string) {
  return STREAM_LABELS[s] ?? s;
}

export function fmtFunnel(s: string) {
  return FUNNEL_LABELS[s] ?? s;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtPct(n: number | null | undefined) {
  return n != null ? `${n}%` : "—";
}

export function statusPill(status: string | null) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-700";
  const label = status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function completenessBar(pct: number) {
  const color = pct >= 75 ? "bg-green-500" : pct >= 40 ? "bg-yellow-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}
