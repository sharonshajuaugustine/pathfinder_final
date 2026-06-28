"use client";

import { useState } from "react";
import Link from "next/link";
import { CoyotCIcon } from "@/components/coyot-logo";

export default function AdminLogin() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setBusy(false);
        return;
      }
      window.location.href = "/admin";
    } catch {
      setError("Connection error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <CoyotCIcon size={22} />
            <span className="text-sm font-semibold tracking-tight">Coyot PathFinder</span>
          </Link>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Login card */}
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-2">
            <CoyotCIcon size={18} />
            <span className="text-sm font-semibold">Coyot PathFinder</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>

          <h1 className="mb-1 text-xl font-bold">Sign in</h1>
          <p className="mb-6 text-sm text-muted-foreground">Staff access only.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                disabled={busy}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                disabled={busy}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
