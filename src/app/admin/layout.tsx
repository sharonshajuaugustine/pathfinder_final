import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin — PathFinder" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="sticky top-0 z-10 border-b bg-background px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-6">
          <span className="text-sm font-semibold">PathFinder Admin</span>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Overview
          </Link>
          <Link
            href="/admin/leads"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Leads
          </Link>
          <Link
            href="/admin/analytics"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Analytics
          </Link>
          <a
            href="/api/admin/export"
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Export CSV
          </a>
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </div>
  );
}
