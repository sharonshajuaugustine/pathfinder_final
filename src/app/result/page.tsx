"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Star, CheckCircle2, DollarSign, BookOpen } from "lucide-react";
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

  useEffect(() => {
    if (localStorage.getItem(`feedback-${sessionId}`)) setSubmitted(true);
  }, [sessionId]);

  async function handleSubmit() {
    if (!reaction) return;
    setLoading(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, reaction, message: message.trim() || undefined }),
      });
      localStorage.setItem(`feedback-${sessionId}`, "1");
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
  { bar: "bg-amber-400", accent: "border-l-amber-400", num: "text-amber-600", label: "Best Match" },
  { bar: "bg-primary",   accent: "border-l-primary",   num: "text-primary",   label: "Strong Match" },
  { bar: "bg-slate-400", accent: "border-l-slate-400", num: "text-slate-500",  label: "Good Match" },
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

        {(data.top ?? []).length > 0 && (
          <p className="mb-4 text-sm text-muted-foreground">
            Based on your interests, strengths, and goals — here are the courses that fit you best.
          </p>
        )}

        {/* AI explanation */}
        {data.explanation && (
          <div className="mb-6 rounded-xl border bg-white px-5 py-4 text-sm leading-relaxed text-foreground shadow-sm">
            {data.explanation}
          </div>
        )}

        <div className="space-y-4">
          {(() => {
            const map = new Map<string, {
              course: NonNullable<typeof data.top[0]["courses"][0]>;
              careers: string[];
              bestFitScore: number;
              eligibilityNotes: string[];
              description?: string;
            }>();

            for (const c of (data.top ?? [])) {
              const primary = (c.courses ?? [])[0];
              if (!primary) continue;
              if (!map.has(primary.courseId)) {
                map.set(primary.courseId, {
                  course: primary,
                  careers: [],
                  bestFitScore: 0,
                  eligibilityNotes: primary.eligibilityNotes ?? [],
                  description: c.shortDescription,
                });
              }
              const entry = map.get(primary.courseId)!;
              if (!entry.careers.includes(c.name)) entry.careers.push(c.name);
              if (c.fitScore > entry.bestFitScore) entry.bestFitScore = c.fitScore;
            }

            const groups = Array.from(map.values()).sort((a, b) => b.bestFitScore - a.bestFitScore);

            return groups.map(({ course, careers, bestFitScore, eligibilityNotes, description }, i) => {
              const rank = RANK_STYLES[i] ?? RANK_STYLES[2];
              const pct = Math.round(bestFitScore * 100);

              const elig = course.eligibility === "eligible"
                ? { pill: "bg-green-50 text-green-700", icon: "text-green-600", label: "Eligible" }
                : course.eligibility === "conditional"
                ? { pill: "bg-amber-50 text-amber-700", icon: "text-amber-600", label: "Conditional" }
                : { pill: "bg-red-50 text-red-700", icon: "text-red-600", label: "Check eligibility" };

              return (
                <div
                  key={course.courseId}
                  className={cn(
                    "rounded-2xl bg-white shadow-sm border border-border/50 overflow-hidden border-l-4",
                    rank.accent
                  )}
                >
                  <div className="p-5 sm:p-6">
                    {/* Rank label + decorative number */}
                    <div className="flex items-start justify-between">
                      <span className={cn("text-xs font-bold uppercase tracking-widest", rank.num)}>
                        {rank.label}
                      </span>
                      <span className={cn("text-5xl font-black leading-none select-none opacity-[0.07]", rank.num)}>
                        {i + 1}
                      </span>
                    </div>

                    {/* Course name */}
                    <h2 className="mt-2 text-xl sm:text-2xl font-bold leading-snug text-foreground">
                      {course.name}
                    </h2>

                    {/* Career path */}
                    <p className={cn("mt-1 text-sm font-semibold", rank.num)}>
                      → {careers.join("  ·  ")}
                    </p>

                    {/* Description */}
                    {description && (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    )}

                    {/* Match bar */}
                    <div className="mt-5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Your match</span>
                        <span className="text-sm font-bold text-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", rank.bar)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Eligibility notes */}
                    {eligibilityNotes.length > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {eligibilityNotes.join(" · ")}
                      </p>
                    )}

                    {/* Info pills */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", elig.pill)}>
                        <CheckCircle2 className={cn("h-3.5 w-3.5", elig.icon)} />
                        {elig.label}
                      </span>
                      {course.feeBand && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                          <DollarSign className="h-3.5 w-3.5" />
                          {course.feeBand.charAt(0).toUpperCase() + course.feeBand.slice(1)} fee
                        </span>
                      )}
                      {(course.exams ?? []).length > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700">
                          <BookOpen className="h-3.5 w-3.5" />
                          {(course.exams ?? []).map((ex) => ex.name).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
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
