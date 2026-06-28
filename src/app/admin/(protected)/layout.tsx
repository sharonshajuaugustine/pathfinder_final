import Link from "next/link";
import type { Metadata } from "next";
import { CoyotCIcon } from "@/components/coyot-logo";
import { getCounsellor } from "@/lib/auth";
import AdminLogout from "../_logout";
import AdminExport from "../_export";

export const metadata: Metadata = { title: "Admin — PathFinder" };

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCounsellor();

  return (
    <div className="min-h-screen bg-muted/30">
      <nav className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 border-r pr-3 mr-1 sm:pr-4 sm:mr-2 hover:opacity-75 transition-opacity">
            <CoyotCIcon size={18} />
            <span className="text-sm font-semibold">PathFinder</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">Admin</span>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            <Link href="/admin" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Overview
            </Link>
            <Link href="/admin/leads" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Leads
            </Link>
            <Link href="/admin/analytics" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Analytics
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <AdminExport className="hidden sm:inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90" />
            {me && (
              <div className="flex items-center gap-2 sm:border-l sm:pl-3">
                <span className="hidden md:inline text-xs text-muted-foreground">{me.email}</span>
                <AdminLogout />
              </div>
            )}
          </div>
        </div>
        <div className="flex sm:hidden border-t px-4 py-1.5 gap-1 bg-white">
          <Link href="/admin" className="flex-1 rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Overview
          </Link>
          <Link href="/admin/leads" className="flex-1 rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Leads
          </Link>
          <Link href="/admin/analytics" className="flex-1 rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Analytics
          </Link>
          <AdminExport className="flex-1 rounded-md px-2 py-1.5 text-center text-xs text-muted-foreground hover:bg-muted hover:text-foreground" />
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
    </div>
  );
}
