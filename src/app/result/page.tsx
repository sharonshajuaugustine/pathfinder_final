"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CoyotCIcon } from "@/components/coyot-logo";
import { cn } from "@/lib/utils";
import type { RecommendationResult } from "@/types/recommendation";

type Reaction = "love" | "good" | "okay" | "poor";

const REACTIONS: { id: Reaction; emoji: string; label: string }[] = [
  { id: "love", emoji: "😍", label: "Loved it" },
  { id: "good", emoji: "😊", label: "Helpful" },
  { id: "okay", emoji: "😐", label: "It's okay" },
  { id: "poor", emoji: "😕", label: "Not helpful" },
];

// ── Skeleton loading ─────────────────────────────────────────────────────────

function SkeletonBar({ w = "100%", h = 12 }: { w?: string; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 99, background: "#E8E0D5" }} />
  );
}

function SkeletonResult() {
  return (
    <div className="min-h-screen" style={{ background: "#F8F3EC" }}>
      <header style={{ height: 56, background: "rgba(248,243,236,0.92)", borderBottom: "1px solid rgba(30,111,255,0.07)" }} />
      <main className="mx-auto max-w-lg px-5 py-6 space-y-5 animate-pulse">
        <div className="clay-card p-6 space-y-3">
          <SkeletonBar w="35%" h={18} />
          <SkeletonBar w="80%" h={26} />
          <SkeletonBar w="55%" h={26} />
          <SkeletonBar w="45%" h={13} />
        </div>
        <div className="clay-card p-6 space-y-4">
          <SkeletonBar w="50%" h={14} />
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="space-y-2">
              <SkeletonBar w="65%" h={12} />
              <SkeletonBar h={6} />
            </div>
          ))}
        </div>
        {[1, 2].map((n) => (
          <div key={n} className="clay-card overflow-hidden">
            <div style={{ height: 72, background: "#EDE7DF" }} />
            <div className="p-5 space-y-3">
              <SkeletonBar w="70%" h={22} />
              <SkeletonBar w="40%" h={11} />
              <div style={{ height: 52, borderRadius: 16, background: "#EDE7DF" }} />
              <div style={{ height: 52, borderRadius: 16, background: "#EDE7DF" }} />
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

// ── Feedback widget ──────────────────────────────────────────────────────────

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
      <div className="clay-card px-5 py-6 text-center" style={{ background: "linear-gradient(135deg,#F0FDF4,#DCFCE7)", border: "1px solid rgba(74,222,128,0.2)" }}>
        <p className="text-sm font-bold" style={{ color: "#166534" }}>Thanks for the feedback!</p>
        <p className="mt-1 text-sm" style={{ color: "#15803D" }}>It helps us improve PathFinder for students like you.</p>
      </div>
    );
  }

  return (
    <div className="clay-card px-5 py-6">
      <p className="text-base font-bold text-center" style={{ color: "#111827" }}>How was your experience?</p>
      <p className="mt-1 text-sm text-center" style={{ color: "#9CA3AF" }}>Your feedback helps us improve PathFinder</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        {REACTIONS.map((r) => (
          <button key={r.id} onClick={() => { setReaction(r.id); setTimeout(() => textRef.current?.focus(), 50); }}
            className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-center transition-all"
            style={{
              borderRadius: 16,
              border: reaction === r.id ? "1.5px solid #1E6FFF" : "1.5px solid rgba(30,111,255,0.1)",
              background: reaction === r.id ? "linear-gradient(135deg,#EEF4FF,#D9E9FF)" : "#F4F6FB",
              transform: reaction === r.id ? "scale(1.06)" : "scale(1)",
              minWidth: 58,
            }}
          >
            <span className="text-2xl leading-none">{r.emoji}</span>
            <span className="text-xs font-semibold" style={{ color: reaction === r.id ? "#1E6FFF" : "#9CA3AF" }}>{r.label}</span>
          </button>
        ))}
      </div>
      <div className={cn("overflow-hidden transition-all duration-200", reaction ? "max-h-72 opacity-100 mt-4" : "max-h-0 opacity-0")}>
        <p className="mb-2 text-xs" style={{ color: "#6B7280", lineHeight: 1.6 }}>
          Tell us anything — what you liked, what felt off, or what you wish was different. Every bit helps us make PathFinder better for students like you.
        </p>
        <textarea ref={textRef} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Share your thoughts… (optional)" maxLength={1000} rows={3}
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

// ── Strength trait cards ──────────────────────────────────────────────────────

const PLAIN_DIMS = [
  {
    keys: ["aptitude", "academic"],
    emoji: "🧠", trait: "Analytical",     color: "#1E6FFF",
    bg: "#EEF4FF", border: "rgba(30,111,255,0.15)",
    desc: "You break problems down well — a natural fit for science, tech & data careers.",
  },
  {
    keys: ["interest"],
    emoji: "🔥", trait: "High Drive",     color: "#F97316",
    bg: "#FFF7ED", border: "rgba(249,115,22,0.15)",
    desc: "Your curiosity and motivation are strong. You'll stick with whatever you choose.",
  },
  {
    keys: ["personality"],
    emoji: "🤝", trait: "Collaborative",  color: "#10B981",
    bg: "#ECFDF5", border: "rgba(16,185,129,0.15)",
    desc: "You work well with people — great for teams, clients or patients.",
  },
  {
    keys: ["aspiration"],
    emoji: "🚀", trait: "Future-Focused", color: "#8B5CF6",
    bg: "#F5F3FF", border: "rgba(139,92,246,0.15)",
    desc: "You think long-term. You'll keep pushing for growth no matter the path.",
  },
];

function deriveStrengths(top: RecommendationResult["top"]) {
  const totals: Record<string, { sum: number; count: number }> = {};
  const allKeys = ["aptitude", "academic", "interest", "personality", "aspiration"];
  for (const k of allKeys) totals[k] = { sum: 0, count: 0 };
  for (const career of top) {
    for (const f of (career.factors ?? [])) {
      if (totals[f.dimension]) {
        totals[f.dimension].sum += f.contribution;
        totals[f.dimension].count += 1;
      }
    }
  }
  const rawValues = PLAIN_DIMS.map((d) => {
    const scores = d.keys.map((k) => {
      const t = totals[k];
      return t.count > 0 ? t.sum / t.count : 0.5;
    });
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  });
  const minV = Math.min(...rawValues);
  const maxV = Math.max(...rawValues);
  const spread = maxV - minV;
  return PLAIN_DIMS.map((d, i) => ({
    ...d,
    value: spread < 0.01 ? 0.78 : 0.65 + ((rawValues[i] - minV) / spread) * 0.30,
  }));
}

function StrengthCards({ top }: { top: RecommendationResult["top"] }) {
  const cards = deriveStrengths(top);
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const [featured, ...rest] = sorted;

  return (
    <div className="clay-card overflow-hidden">
      {/* Featured top trait — full-width, editorial */}
      <div style={{
        background: featured.bg,
        padding: "22px 22px 20px",
        borderBottom: `1px solid ${featured.border}`,
      }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 14, letterSpacing: "0.01em" }}>
          What your answers reveal about you
        </p>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <span style={{ fontSize: 48, lineHeight: 1, flexShrink: 0 }}>{featured.emoji}</span>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: "#111827", lineHeight: 1.15, marginBottom: 6 }}>
              {featured.trait}
            </p>
            <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6, margin: 0 }}>
              {featured.desc}
            </p>
          </div>
        </div>
      </div>

      {/* Remaining traits as a simple horizontal list */}
      <div style={{ padding: "16px 22px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF" }}>Also in your profile</p>
        {rest.map((c) => (
          <div key={c.trait} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{c.emoji}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{c.trait}</p>
              <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.55, margin: 0 }}>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WhatsApp share ────────────────────────────────────────────────────────────

function WhatsAppShare({ sessionId, topCareer, topScore }: { sessionId: string; topCareer?: string; topScore?: number }) {
  const [opened, setOpened] = useState(false);

  function share() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/discover`;
    const lines = [
      "🎉 I just got my career report on PathFinder!",
      "",
      topCareer ? `My top match: *${topCareer}*${topScore ? ` (${topScore}% fit)` : ""}` : "My career report is ready!",
      "",
      "It's a free AI career guide for Plus Two students — takes about 20 mins. Try it here 👇",
      url,
    ];
    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
    setOpened(true);
    setTimeout(() => setOpened(false), 3000);
  }

  return (
    <button
      onClick={share}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        height: 44, padding: "0 20px", borderRadius: 22,
        background: opened ? "#128C7E" : "#25D366",
        color: "#fff", fontWeight: 700, fontSize: 14,
        border: "none", cursor: "pointer", flexShrink: 0,
        boxShadow: `0 4px 0 ${opened ? "#0a6b60" : "#128C7E"}, 0 8px 20px rgba(37,211,102,0.3)`,
        transition: "all 0.2s ease",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      {opened ? "Link opened!" : "Share on WhatsApp"}
    </button>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function confidenceLevel(c: number) {
  if (c >= 0.75) return { label: "High confidence", bg: "rgba(74,222,128,0.12)", color: "#166534", border: "rgba(74,222,128,0.25)" };
  if (c >= 0.5)  return { label: "Good confidence", bg: "rgba(245,158,11,0.1)",  color: "#92400E", border: "rgba(245,158,11,0.2)" };
  return               { label: "Moderate confidence", bg: "rgba(249,115,22,0.1)", color: "#9A3412", border: "rgba(249,115,22,0.2)" };
}

const RANK_CONFIG = [
  { num: "01", label: "Top pick",      accent: "#D97706", accentDark: "#92400E", bannerBg: "#FFFBEB", barColor: "#F59E0B" },
  { num: "02", label: "Strong option", accent: "#1E6FFF", accentDark: "#1D4ED8", bannerBg: "#EEF4FF", barColor: "#1E6FFF" },
  { num: "03", label: "Worth exploring", accent: "#7C3AED", accentDark: "#6D28D9", bannerBg: "#F5F3FF", barColor: "#7C3AED" },
];

const ROUTE_LABEL: Record<string, string> = {
  primary:              "Direct path",
  alternative:          "Alternative",
  fallback:             "Fallback",
  "higher-study-route": "After postgrad",
};

const FEE_LABEL: Record<string, string> = {
  low:       "₹ Affordable",
  medium:    "₹₹ Moderate fees",
  high:      "₹₹₹ Higher fees",
  "very-high": "₹₹₹₹ Premium fees",
};

// ── Main result view ─────────────────────────────────────────────────────────

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
      .then((d) => (d.error ? setError("We couldn't load your results. Please try refreshing the page.") : setData(d)))
      .catch(() => setError("No internet? Check your connection and refresh the page."));
  }, [sessionId]);

  if (!sessionId) return (
    <Center>
      <div className="space-y-4 text-center">
        <p className="text-3xl">😕</p>
        <p className="text-base font-bold" style={{ color: "#111827" }}>We couldn&apos;t find your session.</p>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>This usually happens if you opened this link on a different device. Try completing the quiz again.</p>
        <Link href="/discover" className="clay-btn inline-flex items-center px-5 text-sm" style={{ height: 44, textDecoration: "none" }}>Start the quiz →</Link>
      </div>
    </Center>
  );

  if (error) return (
    <Center>
      <div className="space-y-4 text-center">
        <p className="text-3xl">😵</p>
        <p className="text-sm font-bold" style={{ color: "#111827" }}>Something went wrong</p>
        <p className="text-sm" style={{ color: "#9CA3AF" }}>{error}</p>
        <button onClick={() => window.location.reload()} className="clay-btn inline-flex items-center px-5 text-sm" style={{ height: 44 }}>Try again</button>
      </div>
    </Center>
  );

  if (!data) return <SkeletonResult />;

  const conf = confidenceLevel(data.overallConfidence);

  type CareerEntry = { name: string; fitScore: number; routeType: string; shortDescription?: string; personalInsight?: string; gapToFix?: string };
  const map = new Map<string, { course: NonNullable<typeof data.top[0]["courses"][0]>; careers: CareerEntry[]; bestFitScore: number; eligibilityNotes: string[] }>();

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

  const topCareerName = groups[0]?.careers[0]?.name;
  const topCareerScore = groups[0] ? Math.round(groups[0].bestFitScore * 100) : undefined;

  // When all scores cluster within 5 points, showing the same % on every card is misleading.
  // Instead we show qualitative fit labels and hide the raw number.
  const scores = groups.map((g) => g.bestFitScore);
  const scoreSpread = scores.length > 1 ? Math.max(...scores) - Math.min(...scores) : 1;
  const flatScores = scoreSpread < 0.05;

  return (
    <div className="min-h-screen" style={{ background: "#F8F3EC" }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(248,243,236,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,111,255,0.07)" }}>
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <CoyotCIcon size={24} />
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827" }}>PathFinder</span>
          </Link>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>Your Report</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 py-6 space-y-5">

        {/* ── Celebration hero ── */}
        <div className="clay-card overflow-hidden" style={{ background: "linear-gradient(145deg,#EEF4FF 0%,#F8F3EC 100%)" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <div style={{ flex: 1, padding: "24px 0 24px 22px" }}>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: conf.bg, color: conf.color, border: `1px solid ${conf.border}` }}>
                {conf.label} · {Math.round(data.overallConfidence * 100)}%
              </span>
              <h1 className="mt-3 text-2xl font-black leading-tight" style={{ color: "#111827" }}>
                Your career<br />report is ready 🎉
              </h1>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "#6B7280" }}>
                Based on your interests,<br />strengths &amp; goals.
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/coyot/celebrating.png" alt="Coyot celebrating" width={140} height={160} style={{ objectFit: "contain", flexShrink: 0, alignSelf: "flex-end" }} />
          </div>
        </div>

        {/* ── Stream mismatch alert ── */}
        {data.streamMismatch && (
          <div className="clay-card px-5 py-4" style={{ background: "rgba(255,251,235,0.9)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "#B45309" }}>💡 Good to know</p>
            <p className="text-sm leading-relaxed" style={{ color: "#92400E" }}>{data.streamMismatch}</p>
          </div>
        )}

        {/* ── Strength bars ── */}
        {(data.top ?? []).length > 0 && <StrengthCards top={data.top} />}

        {/* ── AI explanation ── */}
        {data.explanation && (
          <div className="clay-card px-5 py-5">
            <p className="mb-2 text-sm font-bold" style={{ color: "#111827" }}>A note on your results</p>
            <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{data.explanation}</p>
          </div>
        )}

        {/* ── No results ── */}
        {groups.length === 0 && (
          <div className="clay-card px-5 py-8 text-center space-y-3">
            <p className="text-3xl">🤔</p>
            <p className="text-base font-bold" style={{ color: "#111827" }}>We need a bit more from you</p>
            <p className="text-sm" style={{ color: "#9CA3AF" }}>Your answers didn&apos;t give us enough to work with yet. Try the quiz again and answer a few more questions.</p>
            <Link href="/discover" className="clay-btn inline-flex items-center px-5 text-sm" style={{ height: 44, textDecoration: "none" }}>Retake quiz →</Link>
          </div>
        )}

        {/* ── Divider label ── */}
        {groups.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(30,111,255,0.1)" }} />
            <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", whiteSpace: "nowrap" }}>Your top matches</p>
            <div style={{ flex: 1, height: 1, background: "rgba(30,111,255,0.1)" }} />
          </div>
        )}

        {/* ── Course cards ── */}
        {groups.map(({ course, careers, bestFitScore, eligibilityNotes }, i) => {
          const rank = RANK_CONFIG[i] ?? RANK_CONFIG[2];
          const pct = Math.round(bestFitScore * 100);
          const eligColor =
            course.eligibility === "eligible"   ? { color: "#16A34A", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.25)", label: "Eligible" } :
            course.eligibility === "conditional" ? { color: "#D97706", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)",  label: "Conditional" } :
                                                   { color: "#EF4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",   label: "Check eligibility" };

          const metaParts: string[] = [];
          if (course.feeBand && FEE_LABEL[course.feeBand]) metaParts.push(FEE_LABEL[course.feeBand]);
          if ((course.exams ?? []).length > 0) metaParts.push((course.exams ?? []).map((ex) => ex.name).join(", "));

          return (
            <div key={course.courseId} className="clay-card overflow-hidden">
              {/* Banner */}
              <div style={{ background: rank.bannerBg, padding: "18px 20px 16px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: rank.accentDark, opacity: 0.6, marginBottom: 2 }}>{rank.label}</p>
                  {flatScores ? (
                    <p style={{ fontSize: 22, fontWeight: 900, color: rank.accentDark, lineHeight: 1.1 }}>
                      {i === 0 ? "Strong fit" : i === 1 ? "Good fit" : "Worth exploring"}
                    </p>
                  ) : (
                    <p style={{ fontSize: 28, fontWeight: 900, color: rank.accentDark, lineHeight: 1 }}>{pct}% fit</p>
                  )}
                </div>
                <p style={{ fontSize: 64, fontWeight: 900, color: rank.accent, opacity: 0.12, lineHeight: 1, letterSpacing: "-0.04em", userSelect: "none" }}>{rank.num}</p>
              </div>

              {/* Body */}
              <div style={{ padding: "20px 20px 22px" }}>
                <h2 style={{ fontSize: 21, fontWeight: 900, color: "#111827", lineHeight: 1.2, marginBottom: 6 }}>{course.name}</h2>

                {/* Eligibility + meta on one line */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 99, padding: "3px 10px", background: eligColor.bg, color: eligColor.color, border: `1px solid ${eligColor.border}` }}>
                    {eligColor.label}
                  </span>
                  {metaParts.length > 0 && (
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>·</span>
                  )}
                  {metaParts.length > 0 && (
                    <span style={{ fontSize: 12, color: "#6B7280" }}>{metaParts.join("  ·  ")}</span>
                  )}
                </div>

                {/* Career list */}
                <p style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", marginBottom: 10 }}>Careers this opens up</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {careers.map((career, ci) => {
                    const isTop = ci === 0;
                    const routeLabel = ROUTE_LABEL[career.routeType] ?? "Alternative";
                    return (
                      <div key={career.name} style={{
                        borderRadius: 16,
                        padding: "12px 14px",
                        background: isTop ? `${rank.accent}0D` : "#F7F8FA",
                        border: isTop ? `1.5px solid ${rank.accent}28` : "1.5px solid transparent",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{career.name}</p>
                          <span style={{ fontSize: 13, fontWeight: 800, color: rank.accent, flexShrink: 0 }}>{Math.round(career.fitScore * 100)}%</span>
                        </div>
                        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {career.personalInsight ? (
                            <p style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.45, flex: 1 }}>{career.personalInsight}</p>
                          ) : career.shortDescription ? (
                            <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.45, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{career.shortDescription}</p>
                          ) : null}
                          <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 99, padding: "2px 8px", background: "rgba(0,0,0,0.05)", color: "#6B7280", whiteSpace: "nowrap", flexShrink: 0 }}>{routeLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {eligibilityNotes.length > 0 && (
                  <p style={{ marginTop: 12, fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>{eligibilityNotes.join(" · ")}</p>
                )}

                {careers[0]?.gapToFix && (
                  <div style={{ marginTop: 16, borderRadius: 14, padding: "12px 14px", background: "rgba(30,111,255,0.05)", border: "1px solid rgba(30,111,255,0.1)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>💡</span>
                    <p style={{ fontSize: 13, color: "#1D4ED8", lineHeight: 1.55, margin: 0 }}>
                      <span style={{ fontWeight: 700 }}>One thing to work on: </span>{careers[0].gapToFix}
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
            <p className="text-xs font-bold mb-3" style={{ color: "#B45309" }}>⚠ Keep in mind</p>
            <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc", display: "flex", flexDirection: "column", gap: 6 }}>
              {(data.caveats ?? []).map((cv, i) => <li key={i} style={{ fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>{cv}</li>)}
            </ul>
          </div>
        )}

        {/* ── Parent summary ── */}
        {data.parentSummary && (
          <div className="clay-card overflow-hidden">
            <div style={{ padding: "16px 20px 12px", background: "linear-gradient(135deg,#F0FDF4,#DCFCE7)", borderBottom: "1px solid rgba(74,222,128,0.2)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#14532D" }}>👪 Share this with your family</p>
            </div>
            <div style={{ padding: "16px 20px 20px" }}>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{data.parentSummary}</p>
            </div>
          </div>
        )}

        {/* ── What's next ── */}
        <div className="clay-card overflow-hidden">
          <div style={{ padding: "22px 20px 8px" }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1.3 }}>Talk to someone who&apos;s been there</h3>
            <p style={{ marginTop: 8, fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>
              Share this with your parents, a teacher, or a school counsellor. Use it as a starting point — not a final decision.
            </p>
          </div>
          <div style={{ padding: "14px 20px 20px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {sessionId && <WhatsAppShare sessionId={sessionId} topCareer={topCareerName} topScore={topCareerScore} />}
            <button onClick={() => { if (typeof window !== "undefined") window.print(); }}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 44, padding: "0 18px", borderRadius: 22, fontSize: 13, fontWeight: 700, color: "#6B7280", border: "1.5px solid rgba(30,111,255,0.15)", background: "#ffffff", boxShadow: "inset 2px 2px 4px rgba(255,255,255,0.9), 0 3px 0 rgba(165,150,130,0.14)", cursor: "pointer" }}>
              Save report 🖨
            </button>
          </div>
          <div style={{ borderTop: "1px solid rgba(30,111,255,0.07)", padding: "12px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, color: "#9CA3AF" }}>Want different results?</p>
            <Link href="/discover" style={{ fontSize: 13, fontWeight: 700, color: "#1E6FFF", textDecoration: "none" }}>
              Retake quiz →
            </Link>
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
    <Suspense fallback={<SkeletonResult />}>
      <ResultInner />
    </Suspense>
  );
}
