"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import type { Stream } from "@/types/onboarding";

// Adaptive (Akinator-style) flow:
//   intake (name + phone + stream + marks) → adaptive interview → email → /result
//
// Questions are confidence-based — the engine asks as many as needed, not a
// fixed count. A live belief meter shows the top-3 careers narrowing down.

const STREAM_CHOICES: Array<{ label: string; value: Stream | "vocational"; icon: string }> = [
  { label: "Science (Biology group)",   value: "science_bio",   icon: "microscope" },
  { label: "Science (Maths group)",     value: "science_maths", icon: "math" },
  { label: "Science (Computer Science)",value: "science_cs",    icon: "laptop" },
  { label: "Commerce",                  value: "commerce",      icon: "combo-chart" },
  { label: "Humanities / Arts",         value: "humanities",    icon: "paint-palette" },
  { label: "Vocational / ITI",          value: "vocational",    icon: "factory" },
];
const i8 = (n: string) => `https://img.icons8.com/3d-fluency/96/${n}.png`;

type Phase = "intake" | "adaptive" | "email" | "finishing";
type Question = { id: string; text: string; options: Array<{ id: string; label: string }>; freeText?: boolean; freeTextPlaceholder?: string };
type TopCareer = { name: string; score: number };

const field = {
  borderRadius: 16,
  border: "1.5px solid rgba(30,111,255,0.15)",
  background: "#F4F6FB",
  color: "#111827",
} as const;

// Bar width clamped so even low scores show a sliver.
function beliefBar(score: number, max: number) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return Math.max(pct, 4);
}

function BeliefMeter({ careers }: { careers: TopCareer[] }) {
  if (careers.length === 0) return null;
  const max = careers[0]?.score ?? 1;
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="clay-card px-5 py-4" style={{ background: "rgba(30,111,255,0.04)" }}>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "#6B7280" }}>
        Leading so far
      </p>
      <div className="space-y-2.5">
        {careers.map((c, i) => (
          <div key={c.name}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold" style={{ color: "#111827" }}>
                {medals[i]} {c.name}
              </span>
              <span className="shrink-0 text-xs font-bold" style={{ color: "#1E6FFF" }}>{c.score}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: "rgba(30,111,255,0.1)" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 99,
                  width: `${beliefBar(c.score, max)}%`,
                  background: i === 0 ? "#1E6FFF" : i === 1 ? "#60A5FA" : "#BAD4FF",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscoverInner() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [phase, setPhase] = useState<Phase>("intake");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // intake
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [stream, setStream] = useState<Stream | "vocational" | null>(null);
  const [percentage, setPercentage] = useState("");

  // adaptive
  const [question, setQuestion] = useState<Question | null>(null);
  const [asked, setAsked] = useState(0);
  const [topCareers, setTopCareers] = useState<TopCareer[]>([]);
  const [history, setHistory] = useState<{ question: Question; optionId: string }[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "discover" }),
    })
      .then((r) => r.json())
      .then((d) => (d.sessionId ? setSessionId(d.sessionId) : setSessionError(true)))
      .catch(() => setSessionError(true));
  }, []);

  async function submitIntake() {
    const pct = parseFloat(percentage);
    if (!sessionId || !name.trim() || !/^[6-9]\d{9}$/.test(phone) || !stream || isNaN(pct) || pct < 0 || pct > 100) return;
    setBusy(true); setErr(null);
    try {
      // Save name + phone first, then stream + marks.
      await fetch("/api/start", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionIndex: 0, name: name.trim(), phone: phone.trim(), isChoice: false }),
      });
      await fetch("/api/start", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionIndex: 1, value: stream === "vocational" ? null : stream, percentage: pct, isChoice: true }),
      });
      setPhase("adaptive");
    } catch { setErr("Something went wrong. Please try again."); }
    setBusy(false);
  }

  // Kick off the adaptive loop once we enter the adaptive phase.
  useEffect(() => {
    if (phase !== "adaptive" || loadedRef.current || !sessionId) return;
    loadedRef.current = true;
    void stepAdaptive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionId]);

  async function stepAdaptive(prev?: { prevQuestionId: string; optionId?: string; textAnswer?: string }) {
    if (!sessionId) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/adaptive", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, ...prev }),
      });
      const data = await res.json().catch(() => ({ done: true }));
      if (!res.ok) { setErr("Something went wrong. Please try again."); setBusy(false); return; }
      if (Array.isArray(data.beliefs)) setTopCareers(data.beliefs);
      if (data.done || !data.question) { setQuestion(null); setPhase("email"); setBusy(false); return; }
      setQuestion(data.question);
      setAsked(typeof data.asked === "number" ? data.asked : asked + 1);
    } catch { setErr("Connection error. Please try again."); }
    setBusy(false);
  }

  const [textInput, setTextInput] = useState("");

  function answer(optionId: string) {
    if (!question || busy) return;
    setTextInput("");
    setHistory((h) => [...h, { question, optionId }]);
    void stepAdaptive({ prevQuestionId: question.id, optionId });
  }

  function answerText() {
    const t = textInput.trim();
    if (!question || busy || !t) return;
    setTextInput("");
    setHistory((h) => [...h, { question, optionId: "__text__" }]);
    void stepAdaptive({ prevQuestionId: question.id, textAnswer: t });
  }

  function skip() {
    if (!question || busy) return;
    setTextInput("");
    setHistory((h) => [...h, { question, optionId: "skip" }]);
    void stepAdaptive({ prevQuestionId: question.id, optionId: "skip" });
  }

  async function goBack() {
    if (!sessionId || busy || history.length === 0) return;
    setBusy(true); setErr(null);
    try {
      // Remove current question from server's asked list so engine re-picks it.
      await fetch("/api/adaptive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) });
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setTextInput("");
      setQuestion(prev.question);
      setAsked((n) => Math.max(0, n - 1));
    } catch { setErr("Could not go back. Please try again."); }
    setBusy(false);
  }

  async function submitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionId) return;
    setBusy(true); setErr(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          email: String(fd.get("email") ?? ""),
          district: "Kozhikode", // default; not collected here to reduce friction
          preferredLanguage: "en",
          consentGiven: fd.get("consentGiven") === "on",
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b.error ?? "Please check your details.");
        setBusy(false);
        return;
      }
    } catch { setErr("Connection error. Please try again."); setBusy(false); return; }
    setPhase("finishing");
    router.push(`/result?session=${sessionId}`);
  }

  if (sessionError) {
    return (
      <main className="flex h-screen items-center justify-center px-6 text-center" style={{ background: "#F8F3EC", color: "#6B7280" }}>
        Could not start a session. Please refresh the page.
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#F8F3EC" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "rgba(248,243,236,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,111,255,0.07)" }}
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(145deg,#3B82FF,#1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>P</span>
            </div>
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827" }}>PathFinder</span>
          </Link>
          {phase === "adaptive" && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>
              Question {asked}
            </span>
          )}
        </div>
      </header>

      {/* Progress bar — open-ended; grows as questions are asked */}
      {phase === "adaptive" && (
        <div className="px-5 pt-3">
          <div className="mx-auto max-w-lg overflow-hidden" style={{ height: 5, borderRadius: 99, background: "rgba(30,111,255,0.1)" }}>
            <div
              style={{
                height: "100%", borderRadius: 99, background: "#1E6FFF",
                width: `${Math.min(asked * 6, 95)}%`, // grows per question, never reaches 100 until done
                transition: "width 0.4s ease",
                boxShadow: "0 1px 6px rgba(30,111,255,0.3)",
              }}
            />
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-6 gap-4">

        {/* ── Intake (combined) ── */}
        {phase === "intake" && (
          <>
            <div className="clay-card px-6 pt-6 pb-5">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Let&apos;s get started</p>
              <h2 className="text-xl font-bold leading-snug" style={{ color: "#111827" }}>Tell us a little about you so we can find the right careers.</h2>
            </div>

            <div className="clay-card p-6 space-y-4">
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Full name" autoFocus
                className="w-full px-4 py-3.5 text-sm outline-none" style={field}
              />
              <input
                value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric" placeholder="Phone number (10 digits)"
                className="w-full px-4 py-3.5 text-sm outline-none" style={field}
              />
            </div>

            <div className="clay-card p-5 space-y-3">
              <p className="text-xs font-bold" style={{ color: "#6B7280" }}>Your Plus Two stream</p>
              <div className="space-y-2">
                {STREAM_CHOICES.map((c) => (
                  <button
                    key={c.value} type="button" onClick={() => setStream(c.value)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-all"
                    style={{
                      borderRadius: 18,
                      border: stream === c.value ? "1.5px solid #1E6FFF" : "1.5px solid rgba(30,111,255,0.1)",
                      background: stream === c.value ? "linear-gradient(135deg,#EEF4FF,#D9E9FF)" : "#F4F6FB",
                      color: stream === c.value ? "#1E6FFF" : "#374151",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={i8(c.icon)} alt="" width={24} height={24} />
                    <span className="flex-1">{c.label}</span>
                    {stream === c.value && <span style={{ color: "#1E6FFF" }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="clay-card p-5 space-y-3">
              <label className="block text-xs font-bold" style={{ color: "#6B7280" }}>Plus Two percentage (%)</label>
              <input
                value={percentage} onChange={(e) => setPercentage(e.target.value)}
                type="number" placeholder="e.g. 78"
                className="w-full px-4 py-3.5 text-sm outline-none" style={field}
              />
              <button
                disabled={busy || !name.trim() || !/^[6-9]\d{9}$/.test(phone) || !stream || !percentage}
                onClick={submitIntake}
                className="clay-btn w-full text-sm" style={{ height: 52 }}
              >
                {busy ? "Saving…" : "Find my career →"}
              </button>
              {err && <p className="text-xs" style={{ color: "#EF4444" }}>{err}</p>}
            </div>
          </>
        )}

        {/* ── Adaptive interview ── */}
        {phase === "adaptive" && (
          question ? (
            <>
              <div className="clay-card px-6 pt-6 pb-5">
                <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Getting to know you</p>
                <h2 className="text-lg font-bold leading-snug" style={{ color: "#111827" }}>{question.text}</h2>
              </div>

              <div className="clay-card p-4 space-y-2">
                {question.options.map((o) => (
                  <button
                    key={o.id} disabled={busy} onClick={() => answer(o.id)}
                    className="w-full px-4 py-4 text-left text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ borderRadius: 18, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1E6FFF"; e.currentTarget.style.background = "#EEF4FF"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(30,111,255,0.1)"; e.currentTarget.style.background = "#F4F6FB"; }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Free-text input — only for open questions */}
              {question.freeText && <form
                onSubmit={(e) => { e.preventDefault(); answerText(); }}
                className="flex items-center gap-2.5 px-4 py-3"
                style={{
                  borderRadius: 22,
                  background: "#fff",
                  border: "1.5px solid rgba(30,111,255,0.12)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 12px rgba(0,0,0,0.05)",
                }}
              >
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={question.freeTextPlaceholder ?? "Or type your own answer…"}
                  disabled={busy}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
                  style={{ color: "#111827" }}
                />
                <button
                  type="submit"
                  disabled={busy || !textInput.trim()}
                  className="flex shrink-0 items-center justify-center transition-all disabled:opacity-30"
                  style={{
                    width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: "linear-gradient(145deg, #3B82FF, #1E6FFF)",
                    boxShadow: "0 3px 0 rgba(6,26,138,0.35), 0 6px 16px rgba(30,111,255,0.25)",
                    color: "#fff",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
                    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.557H13.5a.75.75 0 0 1 0 1.5H4.182l-1.903 6.557a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.6-7.386.75.75 0 0 0 0-1.128A28.897 28.897 0 0 0 3.105 2.288Z" />
                  </svg>
                </button>
              </form>}

              <div className="flex items-center justify-between px-1">
                {history.length > 0 ? (
                  <button
                    onClick={goBack} disabled={busy}
                    className="flex items-center gap-1 text-xs font-semibold disabled:opacity-40 transition-opacity"
                    style={{ color: "#6B7280" }}
                  >
                    ← Go back
                  </button>
                ) : (
                  <span />
                )}
                <button
                  onClick={skip} disabled={busy}
                  className="text-xs font-semibold disabled:opacity-40"
                  style={{ color: "#9CA3AF" }}
                >
                  Skip →
                </button>
              </div>

              {topCareers.length > 0 && asked >= 6 && <BeliefMeter careers={topCareers} />}

              {err && <p className="text-xs" style={{ color: "#EF4444" }}>{err}</p>}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="h-8 w-8 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
              <p className="text-sm font-bold" style={{ color: "#111827" }}>Thinking of the best question…</p>
            </div>
          )
        )}

        {/* ── Email ── */}
        {phase === "email" && (
          <>
            <div className="clay-card px-6 pt-6 pb-5">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Almost done</p>
              <h2 className="text-xl font-bold leading-snug" style={{ color: "#111827" }}>Where should we send your full report?</h2>
            </div>
            <form onSubmit={submitEmail} className="clay-card p-6 space-y-4">
              <input
                name="email" type="email" required
                placeholder="your@email.com" autoFocus
                className="w-full px-4 py-3.5 text-sm outline-none" style={field}
              />
              <label className="flex items-start gap-2.5 rounded-2xl p-3 text-xs" style={{ border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB" }}>
                <Checkbox name="consentGiven" required className="mt-0.5 shrink-0" />
                <span style={{ color: "#6B7280" }}>I agree to my data being processed for career guidance and possibly shared with a counsellor.</span>
              </label>
              {err && <p className="rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444" }}>{err}</p>}
              <button type="submit" disabled={busy} className="clay-btn w-full text-sm" style={{ height: 52 }}>
                {busy ? "Saving…" : "See my career report →"}
              </button>
            </form>
          </>
        )}

        {/* ── Finishing ── */}
        {phase === "finishing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
            <p className="text-sm font-bold" style={{ color: "#111827" }}>Building your career report…</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<main className="flex h-screen items-center justify-center p-12" style={{ color: "#9CA3AF" }}>Loading…</main>}>
      <DiscoverInner />
    </Suspense>
  );
}
