import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — PathFinder" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-6">
          <div className="flex items-center gap-2 border-r pr-4 mr-2">
            <div className="h-5 w-5 rounded bg-primary" />
            <span className="text-sm font-semibold">PathFinder</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
          <Link
            href="/admin"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Overview
          </Link>
          <Link
            href="/admin/leads"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Leads
          </Link>
          <Link
            href="/admin/analytics"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Analytics
          </Link>
          <a
            href="/api/admin/export"
            className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Export CSV
          </a>
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </div>
  );
}
