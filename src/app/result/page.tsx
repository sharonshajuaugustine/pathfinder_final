"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RecommendationResult } from "@/types/recommendation";

// ── Feedback widget ───────────────────────────────────────────────────────────

type Reaction = "love" | "good" | "okay" | "poor";

const REACTIONS: { id: Reaction; emoji: string; label: string }[] = [
  { id: "love", emoji: "😍", label: "Loved it" },
  { id: "good", emoji: "😊", label: "Helpful" },
  { id: "okay", emoji: "😐", label: "It's okay" },
  { id: "poor", emoji: "😕", label: "Not helpful" },
];

function FeedbackWidget({ sessionId }: { sessionId: string }) {
  const [reaction, setReaction]   = useState<Reaction | null>(null);
  const [message, setMessage]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    if (!reaction) return;
    setLoading(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, reaction, message: message.trim() || undefined }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="mt-4 rounded-2xl border bg-green-50 border-green-200 px-5 py-6 text-center">
        <p className="text-2xl mb-2">🙏</p>
        <p className="text-sm font-semibold text-green-800">Thank you for your feedback!</p>
        <p className="mt-1 text-xs text-green-700">It helps us improve PathFinder for students like you.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border bg-white px-5 py-6">
      <p className="text-sm font-semibold text-foreground text-center">How was your experience?</p>
      <p className="mt-0.5 text-xs text-muted-foreground text-center">Your feedback helps us improve PathFinder</p>

      {/* Reaction buttons */}
      <div className="mt-4 flex items-center justify-center gap-3 sm:gap-5">
        {REACTIONS.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setReaction(r.id);
              setTimeout(() => textRef.current?.focus(), 50);
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 transition-all",
              "border text-center min-w-[60px] sm:min-w-[72px]",
              reaction === r.id
                ? "border-primary bg-primary/5 shadow-sm scale-105"
                : "border-border hover:border-primary/40 hover:bg-muted/50"
            )}
          >
            <span className="text-2xl sm:text-3xl leading-none">{r.emoji}</span>
            <span className={cn(
              "text-[10px] sm:text-xs font-medium",
              reaction === r.id ? "text-primary" : "text-muted-foreground"
            )}>
              {r.label}
            </span>
          </button>
        ))}
      </div>

      {/* Text box — slides in after selecting a reaction */}
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        reaction ? "max-h-48 opacity-100 mt-4" : "max-h-0 opacity-0"
      )}>
        <textarea
          ref={textRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything we should improve? (optional)"
          maxLength={1000}
          rows={3}
          className="w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSubmit}
          disabled={!reaction || loading}
          className={cn(
            "mt-2 w-full rounded-lg py-2.5 text-sm font-medium transition-colors",
            reaction && !loading
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {loading ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </div>
  );
}

const RANK_STYLES = [
  { badge: "bg-amber-100 text-amber-800 border-amber-200", bar: "bg-amber-500", label: "#1 Best fit" },
  { badge: "bg-slate-100 text-slate-700 border-slate-200", bar: "bg-slate-400", label: "#2 Strong fit" },
  { badge: "bg-blue-50 text-blue-700 border-blue-200", bar: "bg-blue-500", label: "#3 Good fit" },
];

function confidenceLevel(c: number) {
  if (c >= 0.75)
    return { label: "High confidence", cls: "bg-green-50 text-green-800 border-green-200" };
  if (c >= 0.5)
    return { label: "Good confidence", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: "Moderate confidence", cls: "bg-orange-50 text-orange-800 border-orange-200" };
}

function ResultInner() {
  const sessionId = useSearchParams().get("session");
  const [data, setData] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch("/api/recommendation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Could not load recommendations."));
  }, [sessionId]);

  if (!sessionId) return (
    <Center>
      <div className="space-y-4 text-center">
        <p className="text-base font-medium text-foreground">No session found.</p>
        <p className="text-sm text-muted-foreground">Please complete the conversation first.</p>
        <Link href="/" className="inline-block text-sm text-primary hover:underline">← Start over</Link>
      </div>
    </Center>
  );
  if (error) return <Center className="text-destructive">{error}</Center>;
  if (!data) {
    return (
      <Center>
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Building your career report…</p>
        </div>
      </Center>
    );
  }

  const conf = confidenceLevel(data.overallConfidence);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary" />
            <span className="text-sm font-semibold">PathFinder</span>
          </Link>
          <span className="text-xs text-muted-foreground">Step 3 of 3</span>
        </div>
      </header>

      {/* Journey progress */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-6 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Your details</span>
            <div className="h-px flex-1 bg-primary" />
            <span className="text-muted-foreground">Conversation</span>
            <div className="h-px flex-1 bg-primary" />
            <span className="font-semibold text-primary">Your report</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Report header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Your career report is ready</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${conf.cls}`}
            >
              {conf.label} · {Math.round(data.overallConfidence * 100)}%
            </span>
            <span className="text-xs text-muted-foreground">KB v{data.kbVersion}</span>
          </div>
        </div>

        {/* Short summary — one line max; full detail is in the cards below */}
        {(data.top ?? []).length > 0 && (
          <p className="mb-6 text-sm text-muted-foreground">
            Based on your interests, aptitude, and goals, here are your top career matches.
          </p>
        )}

        {/* Career cards */}
        <div className="space-y-5">
          {(data.top ?? []).map((c, i) => {
            const rank = RANK_STYLES[i] ?? RANK_STYLES[2];
            return (
              <div key={c.careerId} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                {/* Card header */}
                <div className="flex items-start justify-between border-b bg-muted/20 px-5 py-4">
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${rank.badge}`}
                    >
                      {rank.label}
                    </span>
                    <h2 className="mt-1.5 text-lg font-bold">{c.name}</h2>
                    <p className="text-xs capitalize text-muted-foreground">
                      {c.domain.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{Math.round(c.fitScore * 100)}%</p>
                    <p className="text-[11px] text-muted-foreground">fit score</p>
                  </div>
                </div>

                {/* Fit score bar */}
                <div className="px-5 pt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${rank.bar}`}
                      style={{ width: `${Math.round(c.fitScore * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Card body */}
                <div className="space-y-4 px-5 py-4 text-sm">
                  {(c.courses ?? []).length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Course routes
                      </p>
                      <div className="space-y-1.5">
                        {(c.courses ?? []).map((co) => (
                          <div key={co.courseId} className="rounded-lg border bg-muted/30 px-3 py-2">
                            <p className="font-medium text-foreground">{co.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {co.routeType} · {co.eligibility}
                              {(co.exams ?? []).length > 0 && (
                                <> · Exams: {(co.exams ?? []).map((ex) => ex.name).join(", ")}</>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(c.factors ?? []).length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Why this fits you
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(c.factors ?? []).map((f, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                          >
                            <span className="text-primary">✓</span> {f.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(c.skills ?? []).length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Skill roadmap
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(c.skills ?? []).map((s, si) => (
                          <span key={si} className="flex items-center gap-1.5">
                            <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium">
                              {s.skillName}
                              <span className="ml-1 text-muted-foreground">({s.stage})</span>
                            </span>
                            {si < (c.skills ?? []).length - 1 && (
                              <span className="text-muted-foreground">→</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(c.alternatives ?? []).length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        You might also consider
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(c.alternatives ?? []).map((a) => (
                          <span
                            key={a.careerId}
                            className="rounded-full border bg-white px-3 py-1 text-xs text-muted-foreground"
                          >
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Caveats */}
        {(data.caveats ?? []).length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm">
            <p className="font-semibold text-amber-900">Please keep in mind</p>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-amber-800">
              {(data.caveats ?? []).map((cv, i) => (
                <li key={i}>{cv}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Next steps */}
        <div className="mt-8 rounded-2xl border bg-white p-5 text-center">
          <p className="text-sm font-medium text-foreground">What to do next?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Share this report with your parents, teachers, or school counsellor. Use it as a starting
            point for deeper research and conversations — not as a final decision.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            ← Back to home
          </Link>
        </div>

        {/* Feedback */}
        {sessionId && <FeedbackWidget sessionId={sessionId} />}

        <div className="mt-10 pb-8" />
      </main>
    </div>
  );
}

function Center({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "flex h-screen items-center justify-center px-6 text-center text-muted-foreground",
        className
      )}
    >
      {children}
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<Center>Loading…</Center>}>
      <ResultInner />
    </Suspense>
  );
}
