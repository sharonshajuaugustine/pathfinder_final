"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, DollarSign, BookOpen } from "lucide-react";
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
      <div className="clay-card px-5 py-6 text-center" style={{ background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", border: "1px solid rgba(74,222,128,0.2)" }}>
        <p className="text-2xl mb-2">🙏</p>
        <p className="text-sm font-bold" style={{ color: "#166534" }}>Thank you for your feedback!</p>
        <p className="mt-1 text-xs" style={{ color: "#15803D" }}>It helps us improve PathFinder for students like you.</p>
      </div>
    );
  }

  return (
    <div className="clay-card px-5 py-6">
      <p className="text-sm font-bold text-center" style={{ color: "#111827" }}>How was your experience?</p>
      <p className="mt-0.5 text-xs text-center" style={{ color: "#9CA3AF" }}>Your feedback helps us improve PathFinder</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        {REACTIONS.map((r) => (
          <button key={r.id} onClick={() => { setReaction(r.id); setTimeout(() => textRef.current?.focus(), 50); }}
            className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-center transition-all"
            style={{
              borderRadius: 16,
              border: reaction === r.id ? "1.5px solid #1E6FFF" : "1.5px solid rgba(30,111,255,0.1)",
              background: reaction === r.id ? "linear-gradient(135deg, #EEF4FF, #D9E9FF)" : "#F4F6FB",
              transform: reaction === r.id ? "scale(1.06)" : "scale(1)",
              minWidth: 58,
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
          className="w-full resize-none px-3 py-2.5 text-sm outline-none placeholder:text-gray-400"
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

// ── Strength Radar ──────────────────────────────────────────────────────────

const STRENGTH_DIMS = [
  { key: "aptitude",    label: "Analytical\nThinking", emoji: "🧠", color: "#1E6FFF" },
  { key: "academic",    label: "Problem\nSolving",     emoji: "💡", color: "#F59E0B" },
  { key: "interest",    label: "Interest\nMatch",      emoji: "🎯", color: "#EF4444" },
  { key: "personality", label: "People\nSkills",       emoji: "🤝", color: "#10B981" },
  { key: "aspiration",  label: "Future\nGrowth",       emoji: "🚀", color: "#8B5CF6" },
];

function deriveStrengths(top: RecommendationResult["top"]) {
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const d of STRENGTH_DIMS) totals[d.key] = { sum: 0, count: 0 };
  for (const career of top) {
    for (const f of (career.factors ?? [])) {
      if (totals[f.dimension]) {
        totals[f.dimension].sum += f.contribution;
        totals[f.dimension].count += 1;
      }
    }
  }
  return STRENGTH_DIMS.map((d) => {
    const t = totals[d.key];
    const raw = t.count > 0 ? t.sum / t.count : 0.5;
    return { ...d, value: Math.min(1, Math.max(0.15, raw)) };
  });
}

function StrengthRadar({ top }: { top: RecommendationResult["top"] }) {
  const strengths = deriveStrengths(top);
  const cx = 78, cy = 78, R = 58;
  const angles = [0, 1, 2, 3, 4].map((i) => ((-90 + i * 72) * Math.PI) / 180);
  const pt = (r: number, i: number): [number, number] => [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
  const poly = (f: number) => strengths.map((_, i) => pt(R * f, i).join(",")).join(" ");
  const filled = strengths.map((s, i) => pt(R * s.value, i).join(",")).join(" ");

  return (
    <div className="clay-card overflow-hidden">
      <div style={{ padding: "18px 18px 4px" }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1E6FFF" }}>
          Your strength profile
        </p>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 3 }}>
          What makes these a good fit?
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 20px" }}>

        {/* Pentagon radar chart */}
        <svg width="156" height="156" viewBox="0 0 156 156" style={{ flexShrink: 0 }}>
          {/* Grid rings */}
          {[0.33, 0.66, 1].map((f) => (
            <polygon key={f} points={poly(f)} fill="none" stroke="rgba(30,111,255,0.1)" strokeWidth={f === 1 ? 1.5 : 1} />
          ))}
          {/* Axis spokes */}
          {strengths.map((_, i) => {
            const [x, y] = pt(R, i);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(30,111,255,0.1)" strokeWidth="1" />;
          })}
          {/* Filled shape */}
          <polygon points={filled} fill="rgba(30,111,255,0.13)" stroke="#1E6FFF" strokeWidth="2" strokeLinejoin="round" />
          {/* Vertex dots */}
          {strengths.map((s, i) => {
            const [x, y] = pt(R * s.value, i);
            return <circle key={i} cx={x} cy={y} r={4} fill="#1E6FFF" stroke="#fff" strokeWidth="1.5" />;
          })}
          {/* Axis labels — two-line via tspan */}
          {strengths.map((s, i) => {
            const [x, y] = pt(R + 18, i);
            const lines = s.label.split("\n");
            return (
              <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontWeight="700" fill="#6B7280">
                {lines.map((l, li) => (
                  <tspan key={li} x={x} dy={li === 0 ? (lines.length > 1 ? -5 : 0) : 11}>{l}</tspan>
                ))}
              </text>
            );
          })}
        </svg>

        {/* Bar list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", lineHeight: 1.45, marginBottom: 10 }}>
            Your answers align strongly in these key areas
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {strengths.map((s) => (
              <div key={s.key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{s.emoji}</span>
                    {s.label.replace("\n", " ")}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: s.color, flexShrink: 0 }}>
                    {Math.round(s.value * 100)}%
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.value * 100}%`, borderRadius: 99, background: s.color, transition: "width 0.9s cubic-bezier(0.34,1.56,0.64,1)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function confidenceLevel(c: number) {
  if (c >= 0.75) return { label: "High confidence", bg: "rgba(74,222,128,0.12)", color: "#166534", border: "rgba(74,222,128,0.25)" };
  if (c >= 0.5)  return { label: "Good confidence", bg: "rgba(245,158,11,0.1)",  color: "#92400E", border: "rgba(245,158,11,0.2)" };
  return               { label: "Moderate confidence", bg: "rgba(249,115,22,0.1)", color: "#9A3412", border: "rgba(249,115,22,0.2)" };
}

// Rank visual config — each tier gets its own colour story
const RANK_CONFIG = [
  {
    medal: "🏆", label: "Best Match",
    accent: "#F59E0B", accentDark: "#D97706",
    bannerFrom: "#FFFBEB", bannerTo: "#FEF3C7",
    barColor: "#F59E0B",
    numOpacity: 0.07,
  },
  {
    medal: "🥈", label: "Strong Match",
    accent: "#1E6FFF", accentDark: "#1D4ED8",
    bannerFrom: "#EEF4FF", bannerTo: "#DBEAFE",
    barColor: "#1E6FFF",
    numOpacity: 0.07,
  },
  {
    medal: "🥉", label: "Good Match",
    accent: "#7C3AED", accentDark: "#6D28D9",
    bannerFrom: "#F5F3FF", bannerTo: "#EDE9FE",
    barColor: "#7C3AED",
    numOpacity: 0.07,
  },
];

const ROUTE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  primary:              { label: "Direct path",  color: "#1D4ED8", bg: "rgba(59,130,246,0.09)" },
  alternative:          { label: "Alternative",  color: "#6D28D9", bg: "rgba(139,92,246,0.09)" },
  fallback:             { label: "Fallback",     color: "#92400E", bg: "rgba(245,158,11,0.1)"  },
  "higher-study-route": { label: "After PG",    color: "#166534", bg: "rgba(74,222,128,0.1)"  },
};

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
      <div className="space-y-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/coyot/idle_thinking.png" alt="" width={120} height={120} style={{ objectFit: "contain", margin: "0 auto" }} />
        <div className="mx-auto h-6 w-6 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
        <p className="text-sm font-semibold" style={{ color: "#9CA3AF" }}>Building your career report…</p>
      </div>
    </Center>
  );

  const conf = confidenceLevel(data.overallConfidence);

  // Group courses, sorted by best fit
  type CareerEntry = { name: string; fitScore: number; routeType: string; shortDescription?: string; personalInsight?: string; gapToFix?: string };
  const map = new Map<string, {
    course: NonNullable<typeof data.top[0]["courses"][0]>;
    careers: CareerEntry[];
    bestFitScore: number;
    eligibilityNotes: string[];
  }>();

  for (const c of (data.top ?? [])) {
    for (const course of (c.courses ?? [])) {
      if (!map.has(course.courseId)) {
        map.set(course.courseId, { course, careers: [], bestFitScore: 0, eligibilityNotes: course.eligibilityNotes ?? [] });
      }
      const entry = map.get(course.courseId)!;
      if (!entry.careers.find((x) => x.name === c.name)) {
        entry.careers.push({ name: c.name, fitScore: c.fitScore, routeType: course.routeType, shortDescription: c.shortDescription, personalInsight: c.personalInsight, gapToFix: c.gapToFix });
      }
      if (c.fitScore > entry.bestFitScore) entry.bestFitScore = c.fitScore;
    }
  }

  const groups = Array.from(map.values())
    .map((g) => ({ ...g, careers: g.careers.sort((a, b) => b.fitScore - a.fitScore) }))
    .sort((a, b) => b.bestFitScore - a.bestFitScore);

  return (
    <div className="min-h-screen" style={{ background: "#F8F3EC" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(248,243,236,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,111,255,0.07)" }}>
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>P</span>
            </div>
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827" }}>PathFinder</span>
          </Link>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>Your Report</span>
        </div>
      </header>

      {/* ── Journey breadcrumb ── */}
      <div className="px-5 py-2.5" style={{ borderBottom: "1px solid rgba(30,111,255,0.06)", background: "rgba(255,255,255,0.45)" }}>
        <div className="mx-auto max-w-lg flex items-center gap-2 text-xs">
          <span style={{ color: "#9CA3AF" }}>Your details</span>
          <div className="h-px flex-1" style={{ background: "#1E6FFF" }} />
          <span style={{ color: "#9CA3AF" }}>Conversation</span>
          <div className="h-px flex-1" style={{ background: "#1E6FFF" }} />
          <span className="font-bold" style={{ color: "#1E6FFF" }}>✦ Report</span>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-5 py-6 space-y-5">

        {/* ── Celebration hero ── */}
        <div className="clay-card overflow-hidden" style={{ background: "linear-gradient(145deg, #EEF4FF 0%, #F8F3EC 100%)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
            <div style={{ flex: 1, padding: "22px 0 22px 22px" }}>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider" style={{ background: conf.bg, color: conf.color, border: `1px solid ${conf.border}` }}>
                {conf.label} · {Math.round(data.overallConfidence * 100)}%
              </span>
              <h1 className="mt-3 text-[22px] font-black leading-tight" style={{ color: "#111827" }}>
                Your career<br />report is ready 🎉
              </h1>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "#6B7280" }}>
                Based on your interests,<br />strengths &amp; goals.
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/coyot/celebrating.png"
              alt="Coyot celebrating"
              width={140}
              height={160}
              style={{ objectFit: "contain", flexShrink: 0, alignSelf: "flex-end" }}
            />
          </div>
        </div>

        {/* ── Stream mismatch alert ── */}
        {data.streamMismatch && (
          <div className="clay-card px-5 py-4" style={{ background: "rgba(255,251,235,0.9)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1.5" style={{ color: "#B45309" }}>💡 Good to know</p>
            <p className="text-sm leading-relaxed" style={{ color: "#92400E" }}>{data.streamMismatch}</p>
          </div>
        )}

        {/* ── Strength radar ── */}
        {(data.top ?? []).length > 0 && <StrengthRadar top={data.top} />}

        {/* ── AI explanation ── */}
        {data.explanation && (
          <div className="clay-card px-5 py-4" style={{ borderLeft: "3px solid #1E6FFF" }}>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>What we found</p>
            <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{data.explanation}</p>
          </div>
        )}

        {/* ── No results ── */}
        {groups.length === 0 && (
          <div className="clay-card px-5 py-8 text-center space-y-3">
            <p className="text-base font-bold" style={{ color: "#111827" }}>No recommendations yet</p>
            <p className="text-sm" style={{ color: "#9CA3AF" }}>We need a bit more info. Please go back and complete the quiz.</p>
            <Link href="/" className="inline-block text-sm font-semibold" style={{ color: "#1E6FFF" }}>← Start again</Link>
          </div>
        )}

        {/* ── Course cards ── */}
        {groups.map(({ course, careers, bestFitScore, eligibilityNotes }, i) => {
          const rank = RANK_CONFIG[i] ?? RANK_CONFIG[2];
          const pct = Math.round(bestFitScore * 100);
          const elig = course.eligibility === "eligible"
            ? { pill: "rgba(74,222,128,0.12)", color: "#166534", border: "rgba(74,222,128,0.25)", icon: "#16A34A", label: "✓ Eligible" }
            : course.eligibility === "conditional"
            ? { pill: "rgba(245,158,11,0.1)", color: "#92400E", border: "rgba(245,158,11,0.2)", icon: "#D97706", label: "~ Conditional" }
            : { pill: "rgba(239,68,68,0.08)", color: "#991B1B", border: "rgba(239,68,68,0.2)", icon: "#EF4444", label: "? Check eligibility" };

          return (
            <div key={course.courseId} className="clay-card overflow-hidden">

              {/* Coloured banner strip */}
              <div style={{ background: `linear-gradient(135deg, ${rank.bannerFrom}, ${rank.bannerTo})`, padding: "14px 18px", borderBottom: "1px solid rgba(0,0,0,0.04)", position: "relative", overflow: "hidden" }}>
                {/* Big faded rank number watermark */}
                <span style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  fontSize: 72, fontWeight: 900, lineHeight: 1,
                  color: rank.accent, opacity: rank.numOpacity,
                  pointerEvents: "none", userSelect: "none",
                }}>
                  {i + 1}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Medal */}
                  <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{rank.medal}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: rank.accentDark, marginBottom: 2 }}>
                      {rank.label}
                    </p>
                    {/* Match bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: rank.barColor, transition: "width 0.7s ease" }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: rank.accentDark, flexShrink: 0 }}>{pct}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: "18px 18px 20px" }}>

                {/* Course name */}
                <h2 style={{ fontSize: 20, fontWeight: 900, color: "#111827", lineHeight: 1.25, marginBottom: 14 }}>
                  {course.name}
                </h2>

                {/* Careers this course leads to */}
                <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 8 }}>
                  Careers this opens up
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {careers.map((career, ci) => {
                    const routeBadge = ROUTE_BADGE[career.routeType] ?? ROUTE_BADGE.alternative;
                    const careerPct = Math.round(career.fitScore * 100);
                    const medals = ["🥇", "🥈", "🥉"];
                    const isTop = ci === 0;
                    return (
                      <div key={career.name} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        borderRadius: 16,
                        padding: "10px 12px",
                        background: isTop ? `${rank.accent}0D` : "#F7F8FA",
                        border: isTop ? `1.5px solid ${rank.accent}28` : "1.5px solid transparent",
                      }}>
                        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{medals[ci] ?? "·"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {career.name}
                          </p>
                          {career.personalInsight ? (
                            <p style={{ fontSize: 11, color: "#1D4ED8", marginTop: 2, lineHeight: 1.4, fontStyle: "italic" }}>
                              {career.personalInsight}
                            </p>
                          ) : career.shortDescription ? (
                            <p style={{ fontSize: 11, color: "#6B7280", marginTop: 1, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {career.shortDescription}
                            </p>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: rank.accent }}>{careerPct}%</span>
                          <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 99, padding: "2px 7px", background: routeBadge.bg, color: routeBadge.color, whiteSpace: "nowrap" }}>
                            {routeBadge.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Eligibility notes */}
                {eligibilityNotes.length > 0 && (
                  <p style={{ marginTop: 10, fontSize: 11, color: "#9CA3AF", lineHeight: 1.5 }}>{eligibilityNotes.join(" · ")}</p>
                )}

                {/* Badge pills row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 99, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: elig.pill, color: elig.color, border: `1px solid ${elig.border}` }}>
                    <CheckCircle2 size={12} style={{ color: elig.icon, flexShrink: 0 }} />
                    {elig.label}
                  </span>
                  {course.feeBand && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 99, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "rgba(59,130,246,0.08)", color: "#1D4ED8", border: "1px solid rgba(59,130,246,0.15)" }}>
                      <DollarSign size={12} style={{ flexShrink: 0 }} />
                      {course.feeBand.charAt(0).toUpperCase() + course.feeBand.slice(1)} fee
                    </span>
                  )}
                  {(course.exams ?? []).length > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 99, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "rgba(139,92,246,0.08)", color: "#6D28D9", border: "1px solid rgba(139,92,246,0.15)" }}>
                      <BookOpen size={12} style={{ flexShrink: 0 }} />
                      {(course.exams ?? []).map((ex) => ex.name).join(", ")}
                    </span>
                  )}
                </div>

                {/* Gap-to-fix tip — deterministic advice on the weakest scoring dimension */}
                {careers[0]?.gapToFix && (
                  <div style={{ marginTop: 14, borderRadius: 12, padding: "10px 13px", background: "rgba(30,111,255,0.05)", border: "1px solid rgba(30,111,255,0.12)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
                    <p style={{ fontSize: 11.5, color: "#1D4ED8", lineHeight: 1.5, margin: 0 }}>
                      <span style={{ fontWeight: 700 }}>One thing to work on: </span>
                      {careers[0].gapToFix}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Caveats ── */}
        {(data.caveats ?? []).length > 0 && (
          <div className="clay-card px-5 py-4" style={{ background: "rgba(255,251,235,0.8)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <p className="text-xs font-black uppercase tracking-[0.1em] mb-2" style={{ color: "#B45309" }}>⚠ Keep in mind</p>
            <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc", display: "flex", flexDirection: "column", gap: 4 }}>
              {(data.caveats ?? []).map((cv, i) => (
                <li key={i} style={{ fontSize: 12.5, color: "#92400E", lineHeight: 1.55 }}>{cv}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Parent summary card ── */}
        {data.parentSummary && (
          <div className="clay-card overflow-hidden">
            <div style={{ padding: "16px 18px 12px", background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", borderBottom: "1px solid rgba(74,222,128,0.2)" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "#166534" }}>👪 For parents</p>
              <p style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: "#14532D" }}>Share this with your family</p>
            </div>
            <div style={{ padding: "14px 18px 18px" }}>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{data.parentSummary}</p>
            </div>
          </div>
        )}

        {/* ── What to do next ── */}
        <div className="clay-card overflow-hidden">
          <div style={{ padding: "20px 20px 6px" }}>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-1" style={{ color: "#1E6FFF" }}>What&apos;s next?</p>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111827", lineHeight: 1.3 }}>
              Talk to someone who&apos;s been there
            </h3>
            <p style={{ marginTop: 8, fontSize: 12.5, color: "#6B7280", lineHeight: 1.6 }}>
              Share this report with your parents, a teacher, or a school counsellor. Use it as a starting point — not a final decision.
            </p>
          </div>
          <div style={{ padding: "14px 20px 20px", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              height: 42, padding: "0 20px", borderRadius: 20,
              fontSize: 13, fontWeight: 700, color: "#6B7280",
              border: "1.5px solid rgba(30,111,255,0.15)",
              background: "#ffffff",
              boxShadow: "inset 2px 2px 4px rgba(255,255,255,0.9), 0 3px 0 rgba(165,150,130,0.14)",
              textDecoration: "none",
            }}>
              ← Home
            </Link>
            <button
              onClick={() => { if (typeof window !== "undefined") window.print(); }}
              className="clay-btn"
              style={{ height: 42, padding: "0 20px", fontSize: 13, fontWeight: 700 }}
            >
              Save report 🖨
            </button>
          </div>
        </div>

        {/* ── Feedback ── */}
        {sessionId && <FeedbackWidget sessionId={sessionId} />}

        <div style={{ paddingBottom: 32 }} />
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
