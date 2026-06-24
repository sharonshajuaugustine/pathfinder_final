"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Star, CheckCircle2, DollarSign, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecommendationResult } from "@/types/recommendation";

type Reaction = "love" | "good" | "okay" | "poor";

const REACTIONS: { id: Reaction; emoji: string; label: string }[] = [
  { id: "love", emoji: "😍", label: "Loved it" },
  { id: "good", emoji: "😊", label: "Helpful" },
  { id: "okay", emoji: "😐", label: "It's okay" },
  { id: "poor", emoji: "😕", label: "Not helpful" },
];

function FeedbackWidget({ sessionId }: { sessionId: string }) {
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
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
      <div className="mt-4 clay-card px-5 py-6 text-center" style={{ background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", border: "1px solid rgba(74,222,128,0.2)" }}>
        <p className="text-2xl mb-2">🙏</p>
        <p className="text-sm font-bold" style={{ color: "#166534" }}>Thank you for your feedback!</p>
        <p className="mt-1 text-xs" style={{ color: "#15803D" }}>It helps us improve PathFinder for students like you.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 clay-card px-5 py-6">
      <p className="text-sm font-bold text-center" style={{ color: "#111827" }}>How was your experience?</p>
      <p className="mt-0.5 text-xs text-center" style={{ color: "#9CA3AF" }}>Your feedback helps us improve PathFinder</p>
      <div className="mt-4 flex items-center justify-center gap-3 sm:gap-4">
        {REACTIONS.map((r) => (
          <button key={r.id} onClick={() => { setReaction(r.id); setTimeout(() => textRef.current?.focus(), 50); }}
            className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-center transition-all focus:outline-none"
            style={{
              borderRadius: 16, border: reaction === r.id ? "1.5px solid #1E6FFF" : "1.5px solid rgba(30,111,255,0.1)",
              background: reaction === r.id ? "linear-gradient(135deg, #EEF4FF, #D9E9FF)" : "#F4F6FB",
              transform: reaction === r.id ? "scale(1.06)" : "scale(1)",
              minWidth: 60,
            }}
          >
            <span className="text-2xl leading-none">{r.emoji}</span>
            <span className="text-[10px] font-semibold" style={{ color: reaction === r.id ? "#1E6FFF" : "#9CA3AF" }}>{r.label}</span>
          </button>
        ))}
      </div>
      <div className={cn("overflow-hidden transition-all duration-200", reaction ? "max-h-48 opacity-100 mt-4" : "max-h-0 opacity-0")}>
        <textarea ref={textRef} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything we should improve? (optional)" maxLength={1000} rows={3}
          className="w-full resize-none px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:ring-0"
          style={{ borderRadius: 14, border: "1.5px solid rgba(30,111,255,0.15)", background: "#F4F6FB", color: "#111827" }}
          onFocus={(e) => { e.target.style.borderColor = "#1E6FFF"; e.target.style.background = "#fff"; }}
          onBlur={(e) => { e.target.style.borderColor = "rgba(30,111,255,0.15)"; e.target.style.background = "#F4F6FB"; }}
        />
        <button onClick={handleSubmit} disabled={!reaction || loading}
          className={cn("mt-2 w-full clay-btn text-sm", !reaction || loading ? "opacity-40 cursor-not-allowed" : "")}
          style={{ height: 44 }}>
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
  if (c >= 0.75) return { label: "High confidence", bg: "rgba(74,222,128,0.12)", color: "#166534", border: "rgba(74,222,128,0.25)" };
  if (c >= 0.5)  return { label: "Good confidence", bg: "rgba(245,158,11,0.1)",  color: "#92400E", border: "rgba(245,158,11,0.2)" };
  return               { label: "Moderate confidence", bg: "rgba(249,115,22,0.1)", color: "#9A3412", border: "rgba(249,115,22,0.2)" };
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
        <p className="text-base font-bold" style={{ color: "#111827" }}>No session found.</p>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Please complete the conversation first.</p>
        <Link href="/" className="inline-block text-sm" style={{ color: "#1E6FFF" }}>← Start over</Link>
      </div>
    </Center>
  );
  if (error) return <Center><p style={{ color: "#EF4444" }}>{error}</p></Center>;
  if (!data) return (
    <Center>
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "#9CA3AF" }}>Building your career report…</p>
      </div>
    </Center>
  );

  const conf = confidenceLevel(data.overallConfidence);

  return (
    <div className="min-h-screen" style={{ background: "#F8F3EC" }}>
      {/* Nav */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(248,243,236,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,111,255,0.07)" }}>
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.4), 0 6px 16px rgba(30,111,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12, fontFamily: "var(--font-heading)" }}>P</span>
            </div>
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827", fontFamily: "var(--font-heading)" }}>PathFinder</span>
          </Link>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>Step 3 of 3</span>
        </div>
      </header>

      {/* Journey breadcrumb */}
      <div className="px-6 py-3" style={{ borderBottom: "1px solid rgba(30,111,255,0.06)", background: "rgba(255,255,255,0.5)" }}>
        <div className="mx-auto max-w-3xl flex items-center gap-2 text-xs">
          <span style={{ color: "#9CA3AF" }}>Your details</span>
          <div className="h-px flex-1" style={{ background: "#1E6FFF" }} />
          <span style={{ color: "#9CA3AF" }}>Conversation</span>
          <div className="h-px flex-1" style={{ background: "#1E6FFF" }} />
          <span className="font-bold" style={{ color: "#1E6FFF" }}>Your report</span>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black" style={{ color: "#111827" }}>Your career report is ready</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold" style={{ background: conf.bg, color: conf.color, border: `1px solid ${conf.border}` }}>
              {conf.label} · {Math.round(data.overallConfidence * 100)}%
            </span>
            <span className="text-xs" style={{ color: "#9CA3AF" }}>KB v{data.kbVersion}</span>
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

        {(data.caveats ?? []).length > 0 && (
          <div className="mt-6 rounded-2xl px-5 py-4 text-sm" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="font-bold" style={{ color: "#92400E" }}>Please keep in mind</p>
            <ul className="ml-4 mt-2 list-disc space-y-1" style={{ color: "#B45309" }}>
              {(data.caveats ?? []).map((cv, i) => <li key={i}>{cv}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-8 clay-card p-5 text-center">
          <p className="text-sm font-bold" style={{ color: "#111827" }}>What to do next?</p>
          <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>Share this report with your parents, teachers, or school counsellor. Use it as a starting point for deeper research and conversations — not as a final decision.</p>
          <Link href="/" className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border px-5 text-sm font-semibold transition-colors" style={{ borderColor: "rgba(30,111,255,0.2)", color: "#6B7280" }}>← Back to home</Link>
        </div>

        {sessionId && <FeedbackWidget sessionId={sessionId} />}
        <div className="mt-10 pb-8" />
      </main>
    </div>
  );
}

function Center({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={cn("flex h-screen items-center justify-center px-6 text-center", className)} style={{ background: "#F8F3EC", color: "#9CA3AF" }}>
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
