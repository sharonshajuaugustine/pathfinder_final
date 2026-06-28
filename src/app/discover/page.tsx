"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CoyotCIcon } from "@/components/coyot-logo";
import { Checkbox } from "@/components/ui/checkbox";
import { FlaskConical, Calculator, Laptop, TrendingUp, Palette, Wrench } from "lucide-react";
import type { Stream } from "@/types/onboarding";

const STREAM_CHOICES: Array<{ label: string; value: Stream | "vocational"; Icon: React.ElementType }> = [
  { label: "Science (Biology group)",    value: "science_bio",   Icon: FlaskConical },
  { label: "Science (Maths group)",      value: "science_maths", Icon: Calculator },
  { label: "Science (Computer Science)", value: "science_cs",    Icon: Laptop },
  { label: "Commerce",                   value: "commerce",      Icon: TrendingUp },
  { label: "Humanities / Arts",          value: "humanities",    Icon: Palette },
  { label: "Vocational / ITI",           value: "vocational",    Icon: Wrench },
];

const KERALA_DISTRICTS = [
  "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
  "Kottayam", "Idukki", "Ernakulam", "Thrissur",
  "Palakkad", "Malappuram", "Kozhikode", "Wayanad",
  "Kannur", "Kasaragod",
];

const GRID_META = [
  { emoji: "💡", bg: "#EEF4FF", border: "rgba(30,111,255,0.18)",  iconRing: "rgba(30,111,255,0.08)"  },
  { emoji: "🔥", bg: "#FFF7ED", border: "rgba(249,115,22,0.18)",  iconRing: "rgba(249,115,22,0.08)"  },
  { emoji: "🌿", bg: "#ECFDF5", border: "rgba(16,185,129,0.18)",  iconRing: "rgba(16,185,129,0.08)"  },
  { emoji: "⚡", bg: "#F5F3FF", border: "rgba(139,92,246,0.18)",  iconRing: "rgba(139,92,246,0.08)"  },
  { emoji: "🎯", bg: "#FFF0F3", border: "rgba(244,63,94,0.18)",   iconRing: "rgba(244,63,94,0.08)"   },
  { emoji: "✨", bg: "#FFFBEB", border: "rgba(234,179,8,0.18)",   iconRing: "rgba(234,179,8,0.08)"   },
];

type Phase = "intake" | "adaptive" | "email" | "finishing";
type Question = { id: string; text: string; options: Array<{ id: string; label: string }>; freeText?: boolean; freeTextPlaceholder?: string; multiSelect?: boolean };
type MascotState = "greeting" | "idle_thinking" | "curious_headtilt" | "excited" | "impressed" | "confused_squint" | "celebrating";

const field = {
  borderRadius: 16,
  border: "1.5px solid rgba(30,111,255,0.15)",
  background: "#F4F6FB",
  color: "#111827",
} as const;

const MASCOT_LABELS: Record<MascotState, string> = {
  greeting:         "Hi! Let's discover your path 👋",
  idle_thinking:    "Getting to know you...",
  curious_headtilt: "Tell me more! 🤔",
  excited:          "✦ Great choice!",
  impressed:        "✦ You're on the right path!",
  confused_squint:  "Let me reconsider...",
  celebrating:      "Almost there! 🎉",
};

// 2×2 (or 2×N) grid of clay option cards — works great on phones
function GridOptions({ options, onAnswer, busy }: {
  options: Array<{ id: string; label: string }>;
  onAnswer: (id: string) => void;
  busy: boolean;
}) {
  const [pressed, setPressed] = useState<string | null>(null);

  function handleClick(id: string) {
    if (busy) return;
    setPressed(id);
    setTimeout(() => { setPressed(null); onAnswer(id); }, 140);
  }

  const isOdd = options.length % 2 !== 0;
  const pairItems = isOdd ? options.slice(0, -1) : options;
  const lastItem = isOdd ? options[options.length - 1] : null;

  function renderCard(o: { id: string; label: string }, i: number, style?: React.CSSProperties) {
    const meta = GRID_META[i % GRID_META.length];
    const isPressed = pressed === o.id;
    return (
      <button
        key={o.id}
        disabled={busy}
        onClick={() => handleClick(o.id)}
        style={{
          borderRadius: 22,
          border: `1.5px solid ${isPressed ? meta.border.replace("0.18", "0.6") : meta.border}`,
          background: isPressed ? meta.bg : "#ffffff",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          cursor: busy ? "not-allowed" : "pointer",
          textAlign: "left",
          opacity: busy && !isPressed ? 0.65 : 1,
          transform: isPressed ? "translateY(3px)" : "translateY(0)",
          boxShadow: isPressed
            ? "inset 2px 2px 4px rgba(255,255,255,0.7), 0 2px 0 rgba(165,150,130,0.12), 0 4px 10px rgba(165,150,130,0.08)"
            : "inset 3px 3px 6px rgba(255,255,255,0.95), inset -2px -2px 5px rgba(30,111,255,0.04), 0 6px 0 rgba(165,150,130,0.18), 0 10px 24px rgba(165,150,130,0.12)",
          transition: "transform 0.10s ease, box-shadow 0.10s ease, border-color 0.10s ease",
          minHeight: 68,
          ...style,
        }}
      >
        {/* Left accent bar */}
        <div style={{
          width: 3, alignSelf: "stretch", borderRadius: 99,
          background: meta.border.replace("0.18", "0.7"),
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: "#111827", lineHeight: 1.35, letterSpacing: "-0.01em" }}>
          {o.label}
        </span>
      </button>
    );
  }

  return (
    <div style={{ padding: "4px 20px 0" }}>
      {/* Pairs — always 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {pairItems.map((o, i) => renderCard(o, i))}
      </div>

      {/* Lone last card — centred */}
      {lastItem && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          {renderCard(lastItem, options.length - 1, { width: "calc(50% - 6px)" })}
        </div>
      )}
    </div>
  );
}

// Multi-select version — checkmark grid, confirm button at bottom
function MultiSelectGrid({ options, selected, onToggle, onConfirm, busy }: {
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <div style={{ padding: "4px 20px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {options.map((o, i) => {
          const meta = GRID_META[i % GRID_META.length];
          const isSelected = selected.includes(o.id);
          return (
            <button
              key={o.id}
              disabled={busy}
              onClick={() => onToggle(o.id)}
              style={{
                borderRadius: 22,
                border: isSelected ? "2px solid #1E6FFF" : `1.5px solid ${meta.border}`,
                background: isSelected ? "linear-gradient(135deg, #EEF4FF, #DBEAFE)" : "#ffffff",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                cursor: busy ? "not-allowed" : "pointer",
                textAlign: "left",
                opacity: busy ? 0.65 : 1,
                boxShadow: isSelected
                  ? "inset 2px 2px 5px rgba(255,255,255,0.7), 0 3px 0 rgba(30,111,255,0.2)"
                  : "inset 3px 3px 6px rgba(255,255,255,0.95), 0 6px 0 rgba(165,150,130,0.18), 0 10px 24px rgba(165,150,130,0.12)",
                transform: isSelected ? "scale(0.97)" : "scale(1)",
                transition: "all 0.15s ease",
                minHeight: 68,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Corner tick ribbon — only visible when selected */}
              {isSelected && (
                <div style={{
                  position: "absolute", top: 0, right: 0,
                  width: 36, height: 36,
                  background: "#1E6FFF",
                  clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                  display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                  paddingTop: 4, paddingRight: 4,
                }}>
                  <svg viewBox="0 0 10 10" fill="none" style={{ width: 9, height: 9 }}>
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              {/* Left accent bar */}
              <div style={{
                width: 3, alignSelf: "stretch", borderRadius: 99,
                background: isSelected ? "#1E6FFF" : meta.border.replace("0.18", "0.7"),
                flexShrink: 0,
                transition: "background 0.15s ease",
              }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: isSelected ? "#1D4ED8" : "#111827", lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onConfirm}
        disabled={busy || selected.length === 0}
        className="clay-btn w-full"
        style={{ marginTop: 16, height: 50, fontSize: 14, fontWeight: 700, opacity: (busy || selected.length === 0) ? 0.4 : 1 }}
      >
        {selected.length === 0
          ? "Pick at least one subject"
          : `Confirm ${selected.length} subject${selected.length > 1 ? "s" : ""} →`}
      </button>
    </div>
  );
}

const STORAGE_KEY = "pf_session";

function saveSession(sessionId: string, phase: Phase) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, phase })); } catch {}
}

function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function DiscoverInner() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [phase, setPhase] = useState<Phase>("intake");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // intake
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [isKerala, setIsKerala] = useState<boolean | null>(null);
  const [district, setDistrict] = useState("");
  const [stream, setStream] = useState<Stream | "vocational" | null>(null);
  const [percentage, setPercentage] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // adaptive
  const [question, setQuestion] = useState<Question | null>(null);
  const [asked, setAsked] = useState(0);
  const [mascotState, setMascotState] = useState<MascotState>("greeting");
  const [history, setHistory] = useState<{ question: Question; optionId: string }[]>([]);
  const loadedRef = useRef(false);
  const [textInput, setTextInput] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [skipWarning, setSkipWarning] = useState(false);
  const [careerConfirmation, setCareerConfirmation] = useState<string | null>(null);

  // Restore session from localStorage on mount, or create a new one
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { sessionId: sid, phase: savedPhase } = JSON.parse(saved) as { sessionId: string; phase: Phase };
        if (sid && savedPhase) {
          setSessionId(sid);
          setPhase(savedPhase);
          return;
        }
      }
    } catch {}
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
      await fetch("/api/start", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionIndex: 0, name: name.trim(), phone: phone.trim(), age: parseInt(age) || undefined, district: district || undefined, isChoice: false }),
      });
      await fetch("/api/start", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionIndex: 1, value: stream === "vocational" ? null : stream, percentage: pct, isChoice: true }),
      });
      setPhase("adaptive");
    } catch { setErr("Something went wrong. Please try again — your info is safe."); }
    setBusy(false);
  }

  // Persist session to localStorage whenever sessionId or phase changes
  useEffect(() => {
    if (sessionId && phase !== "finishing") saveSession(sessionId, phase);
    if (phase === "finishing") clearSession();
  }, [sessionId, phase]);

  useEffect(() => {
    if (phase !== "adaptive" || loadedRef.current || !sessionId) return;
    loadedRef.current = true;
    setMascotState("greeting");
    void stepAdaptive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sessionId]);

  async function stepAdaptive(prev?: { prevQuestionId: string; optionId?: string; optionIds?: string[]; textAnswer?: string }) {
    if (!sessionId) return;
    setBusy(true); setErr(null);
    setMascotState("idle_thinking");
    try {
      const res = await fetch("/api/adaptive", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, ...prev }),
      });
      const data = await res.json().catch(() => ({ done: true }));
      if (!res.ok) { setErr("We hit a snag. Please try again."); setBusy(false); return; }
      if (data.done || !data.question) {
        setMascotState("celebrating");
        setQuestion(null); setPhase("email"); setBusy(false); return;
      }
      if (data.careerConfirmation) {
        setCareerConfirmation(data.careerConfirmation);
        setTimeout(() => setCareerConfirmation(null), 2500);
      }
      if (data.question.mascot) setMascotState(data.question.mascot);
      else setMascotState("idle_thinking");
      setQuestion(data.question);
      setSelectedOptions([]);
      setSkipWarning(false);
      setAsked(typeof data.asked === "number" ? data.asked : asked + 1);
    } catch { setErr("No internet? Check your connection and try again."); }
    setBusy(false);
  }

  function answer(optionId: string) {
    if (!question || busy) return;
    setMascotState("excited");
    setTextInput("");
    setHistory((h) => [...h, { question, optionId }]);
    void stepAdaptive({ prevQuestionId: question.id, optionId });
  }

  function answerMulti() {
    if (!question || busy || selectedOptions.length === 0) return;
    setMascotState("excited");
    setHistory((h) => [...h, { question, optionId: selectedOptions.join(",") }]);
    void stepAdaptive({ prevQuestionId: question.id, optionIds: selectedOptions });
  }

  function toggleOption(id: string) {
    setSelectedOptions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function answerText() {
    const t = textInput.trim();
    if (!question || busy || !t) return;
    setMascotState("excited");
    setTextInput("");
    setHistory((h) => [...h, { question, optionId: "__text__" }]);
    void stepAdaptive({ prevQuestionId: question.id, textAnswer: t });
  }

  function skip() {
    if (!question || busy) return;
    if (!skipWarning) { setSkipWarning(true); return; }
    setSkipWarning(false);
    setTextInput("");
    setHistory((h) => [...h, { question, optionId: "skip" }]);
    void stepAdaptive({ prevQuestionId: question.id, optionId: "skip" });
  }

  async function goBack() {
    if (!sessionId || busy || history.length === 0) return;
    setMascotState("confused_squint");
    setTimeout(() => setMascotState("idle_thinking"), 800);
    setBusy(true); setErr(null);
    try {
      await fetch("/api/adaptive", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) });
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setTextInput("");
      setQuestion(prev.question);
      setAsked((n) => Math.max(0, n - 1));
    } catch { setErr("Couldn't go back right now. Try again."); }
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
          district: district || undefined,
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
    } catch { setErr("No internet? Check your connection and try again."); setBusy(false); return; }
    setPhase("finishing");
    clearSession();
    router.push(`/result?session=${sessionId}`);
  }

  if (sessionError) {
    return (
      <main className="flex h-screen items-center justify-center px-6 text-center" style={{ background: "#F8F3EC" }}>
        <div className="space-y-3">
          <p className="text-3xl">😵</p>
          <p className="text-sm font-bold" style={{ color: "#111827" }}>Something went wrong at the start</p>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Try refreshing the page — your progress will be saved.</p>
          <button onClick={() => window.location.reload()} className="clay-btn px-5 text-sm" style={{ height: 44 }}>Refresh</button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#F8F3EC" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(248,243,236,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(30,111,255,0.07)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <CoyotCIcon size={24} />
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827" }}>PathFinder</span>
          </Link>
          {phase === "adaptive" && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>
              {asked} of ~12
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-6 gap-4">

        {/* ── Intake ── */}
        {phase === "intake" && (
          <>
            {/* Step dots */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", paddingTop: 4 }}>
              {[1, 2, 3, 4].map((s) => (
                <div key={s} style={{
                  width: s === intakeStep ? 24 : 8, height: 8, borderRadius: 99,
                  background: s === intakeStep ? "#1E6FFF" : s < intakeStep ? "rgba(30,111,255,0.4)" : "rgba(30,111,255,0.15)",
                  transition: "all 0.3s ease",
                }} />
              ))}
            </div>

            {intakeStep === 1 && (
              <>
                <div className="clay-card px-6 pt-6 pb-5">
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Hey, welcome! 👋</p>
                  <h2 className="text-xl font-bold leading-snug" style={{ color: "#111827" }}>Let&apos;s find the right career path for you.</h2>
                  <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>⏱ Takes about 5 minutes · Free forever · No account needed</p>
                </div>
                <div className="clay-card p-6 space-y-3">
                  {/* Name */}
                  <div className="space-y-1">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      placeholder="What's your name?"
                      autoFocus
                      className="w-full px-4 py-3.5 text-sm outline-none"
                      style={{ ...field, borderColor: touched.name && !name.trim() ? "#EF4444" : undefined }}
                    />
                    {touched.name && !name.trim() && (
                      <p style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>Please enter your name</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                      inputMode="numeric"
                      placeholder="Your phone number (10 digits)"
                      className="w-full px-4 py-3.5 text-sm outline-none"
                      style={{ ...field, borderColor: touched.phone && phone && !/^[6-9]\d{9}$/.test(phone) ? "#EF4444" : undefined }}
                    />
                    {touched.phone && phone.length > 0 && !/^[6-9]\d{9}$/.test(phone) && (
                      <p style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>
                        {phone.length < 10 ? `${10 - phone.length} more digit${10 - phone.length > 1 ? "s" : ""} needed` : "Must start with 6, 7, 8, or 9"}
                      </p>
                    )}
                    {touched.phone && !phone && (
                      <p style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>Phone number is required</p>
                    )}
                  </div>

                  {/* Age */}
                  <div className="space-y-1">
                    <input
                      value={age}
                      onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      onBlur={() => setTouched((t) => ({ ...t, age: true }))}
                      inputMode="numeric"
                      placeholder="Your age (e.g. 17)"
                      className="w-full px-4 py-3.5 text-sm outline-none"
                      style={{ ...field, borderColor: touched.age && age && (parseInt(age) < 14 || parseInt(age) > 25) ? "#EF4444" : undefined }}
                    />
                    {touched.age && !age && (
                      <p style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>Age is required</p>
                    )}
                    {touched.age && age && (parseInt(age) < 14 || parseInt(age) > 25) && (
                      <p style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>Age should be between 14 and 25</p>
                    )}
                  </div>

                  <button
                    disabled={!name.trim() || !/^[6-9]\d{9}$/.test(phone) || !age || parseInt(age) < 14 || parseInt(age) > 25}
                    onClick={() => {
                      setTouched((t) => ({ ...t, name: true, phone: true, age: true }));
                      if (name.trim() && /^[6-9]\d{9}$/.test(phone) && age && parseInt(age) >= 14 && parseInt(age) <= 25) setIntakeStep(2);
                    }}
                    className="clay-btn w-full text-sm"
                    style={{ height: 52, marginTop: 4 }}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {intakeStep === 2 && (
              <>
                {isKerala === null && (
                  <>
                    <div className="clay-card px-6 pt-6 pb-5">
                      <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Your location</p>
                      <h2 className="text-xl font-bold leading-snug" style={{ color: "#111827" }}>Are you based in Kerala?</h2>
                      <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>We use this to find the right colleges and exams for you.</p>
                    </div>
                    <div className="clay-card p-4 space-y-3">
                      <button
                        type="button"
                        onClick={() => setIsKerala(true)}
                        className="w-full flex items-center gap-3 px-4 py-4 text-left text-sm font-semibold"
                        style={{ borderRadius: 18, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1E6FFF"; e.currentTarget.style.background = "#EEF4FF"; e.currentTarget.style.color = "#1E6FFF"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(30,111,255,0.1)"; e.currentTarget.style.background = "#F4F6FB"; e.currentTarget.style.color = "#374151"; }}
                      >
                        <span style={{ fontSize: 20 }}>🌴</span>
                        <span className="flex-1">Yes, I&apos;m in Kerala</span>
                        <span style={{ color: "rgba(30,111,255,0.3)", fontSize: 12 }}>→</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsKerala(false); setDistrict(""); setIntakeStep(3); }}
                        className="w-full flex items-center gap-3 px-4 py-4 text-left text-sm font-semibold"
                        style={{ borderRadius: 18, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1E6FFF"; e.currentTarget.style.background = "#EEF4FF"; e.currentTarget.style.color = "#1E6FFF"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(30,111,255,0.1)"; e.currentTarget.style.background = "#F4F6FB"; e.currentTarget.style.color = "#374151"; }}
                      >
                        <span style={{ fontSize: 20 }}>🗺️</span>
                        <span className="flex-1">No, I&apos;m outside Kerala</span>
                        <span style={{ color: "rgba(30,111,255,0.3)", fontSize: 12 }}>→</span>
                      </button>
                    </div>
                    <button onClick={() => setIntakeStep(1)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>← Back</button>
                  </>
                )}

                {isKerala === true && (
                  <>
                    <div className="clay-card px-6 pt-6 pb-5">
                      <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Your district</p>
                      <h2 className="text-xl font-bold leading-snug" style={{ color: "#111827" }}>Which district are you from?</h2>
                      <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>We use this to find colleges and exams near you.</p>
                    </div>
                    <div className="clay-card p-4">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {KERALA_DISTRICTS.map((d) => (
                          <button key={d} type="button" onClick={() => { setDistrict(d); setIntakeStep(3); }}
                            style={{ borderRadius: 16, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151", padding: "10px 8px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.12s ease" }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1E6FFF"; e.currentTarget.style.background = "#EEF4FF"; e.currentTarget.style.color = "#1E6FFF"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(30,111,255,0.1)"; e.currentTarget.style.background = "#F4F6FB"; e.currentTarget.style.color = "#374151"; }}
                          >{d}</button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setIsKerala(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>← Back</button>
                  </>
                )}
              </>
            )}

            {intakeStep === 3 && (
              <>
                <div className="clay-card px-6 pt-6 pb-5">
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Your background</p>
                  <h2 className="text-xl font-bold leading-snug" style={{ color: "#111827" }}>Which stream did you study in Plus Two?</h2>
                  <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>Don&apos;t worry — this doesn&apos;t limit your options. It&apos;s just a starting point.</p>
                </div>
                <div className="clay-card p-5 space-y-2">
                  {STREAM_CHOICES.map((c) => (
                    <button key={c.value} type="button" onClick={() => { setStream(c.value); setIntakeStep(4); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold"
                      style={{ borderRadius: 18, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1E6FFF"; e.currentTarget.style.background = "#EEF4FF"; e.currentTarget.style.color = "#1E6FFF"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(30,111,255,0.1)"; e.currentTarget.style.background = "#F4F6FB"; e.currentTarget.style.color = "#374151"; }}
                    >
                      <c.Icon size={20} style={{ color: "#1E6FFF", flexShrink: 0 }} />
                      <span className="flex-1">{c.label}</span>
                      <span style={{ color: "rgba(30,111,255,0.3)", fontSize: 12 }}>→</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => { if (isKerala === false) setIsKerala(null); setIntakeStep(2); }} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>← Back</button>
              </>
            )}

            {intakeStep === 4 && (
              <>
                <div className="clay-card px-6 pt-6 pb-5">
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>Almost there 🎉</p>
                  <h2 className="text-xl font-bold leading-snug" style={{ color: "#111827" }}>What was your Plus Two percentage?</h2>
                  <p className="mt-2 text-xs" style={{ color: "#9CA3AF" }}>We use this only to check which courses you&apos;re eligible for — it doesn&apos;t define you!</p>
                </div>
                <div className="clay-card p-6 space-y-4">
                  <div className="space-y-1">
                    <input
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, percentage: true }))}
                      type="number"
                      min={0}
                      max={100}
                      placeholder="e.g. 78"
                      autoFocus
                      className="w-full px-4 py-3.5 text-sm outline-none"
                      style={{ ...field, borderColor: touched.percentage && percentage && (parseFloat(percentage) < 0 || parseFloat(percentage) > 100) ? "#EF4444" : undefined }}
                    />
                    {touched.percentage && !percentage && (
                      <p style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>Please enter your percentage</p>
                    )}
                    {touched.percentage && percentage && (parseFloat(percentage) < 0 || parseFloat(percentage) > 100) && (
                      <p style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>Percentage must be between 0 and 100</p>
                    )}
                  </div>
                  <button
                    disabled={busy || !percentage || parseFloat(percentage) < 0 || parseFloat(percentage) > 100}
                    onClick={() => {
                      setTouched((t) => ({ ...t, percentage: true }));
                      submitIntake();
                    }}
                    className="clay-btn w-full text-sm"
                    style={{ height: 52 }}
                  >
                    {busy ? "Saving…" : "Find my career →"}
                  </button>
                  {err && <p className="text-xs" style={{ color: "#EF4444" }}>{err}</p>}
                </div>
                <button onClick={() => setIntakeStep(3)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>← Back</button>
              </>
            )}
          </>
        )}

        {/* ── Adaptive interview ── */}
        {phase === "adaptive" && (
          question ? (
            <div className="flex flex-col flex-1 -mx-5 -my-6">

              {/* Segmented progress bar + tagline */}
              <div style={{ padding: "14px 20px 0" }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 5, borderRadius: 99,
                      background: i < asked ? "#1E6FFF" : "rgba(30,111,255,0.13)",
                      transition: "background 0.35s ease",
                    }} />
                  ))}
                </div>
                <p style={{ marginTop: 10, fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                  You&apos;re building your future. One step at a time. 🚀
                </p>
              </div>

              {/* Career confirmation toast */}
              {careerConfirmation && (
                <div style={{
                  margin: "10px 20px 0",
                  padding: "12px 16px",
                  borderRadius: 18,
                  background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
                  border: "1.5px solid rgba(16,185,129,0.25)",
                  display: "flex", alignItems: "center", gap: 10,
                  animation: "fadeIn 0.25s ease",
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>🎯</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#065F46", margin: 0 }}>{careerConfirmation}</p>
                </div>
              )}

              {/* Question clay card + mascot overlap */}
              <div style={{ position: "relative", margin: "14px 20px 0" }}>
                <div className="clay-card" style={{ padding: "20px 178px 22px 20px", minHeight: 118 }}>
                  <p style={{ color: "#1E6FFF", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                    {MASCOT_LABELS[mascotState]}
                  </p>
                  <h2 style={{ color: "#111827", fontSize: 19, fontWeight: 800, lineHeight: 1.35 }}>
                    {question.text}
                  </h2>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/coyot/${mascotState}.png`}
                  alt="Coyot"
                  style={{
                    position: "absolute", top: -44, right: -16,
                    width: 195, height: 220,
                    objectFit: "contain", pointerEvents: "none",
                    transition: "opacity 0.25s ease",
                  }}
                />
              </div>

              {/* 2×2 clay option grid — single or multi-select */}
              <div style={{ marginTop: 16 }}>
                {question.multiSelect ? (
                  <MultiSelectGrid
                    options={question.options}
                    selected={selectedOptions}
                    onToggle={toggleOption}
                    onConfirm={answerMulti}
                    busy={busy}
                  />
                ) : (
                  <GridOptions options={question.options} onAnswer={answer} busy={busy} />
                )}
              </div>

              {/* Free-text input */}
              {question.freeText && (
                <form
                  onSubmit={(e) => { e.preventDefault(); answerText(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    margin: "12px 20px 0",
                    borderRadius: 22,
                    background: "#ffffff",
                    border: "1.5px solid rgba(30,111,255,0.12)",
                    padding: "10px 10px 10px 16px",
                    boxShadow: "inset 3px 3px 6px rgba(255,255,255,0.9), 0 4px 12px rgba(165,150,130,0.1)",
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
                    style={{
                      width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
                      background: "linear-gradient(145deg, #3B82FF, #1E6FFF)",
                      boxShadow: "0 3px 0 rgba(6,26,138,0.35), 0 6px 16px rgba(30,111,255,0.25)",
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: (busy || !textInput.trim()) ? 0.3 : 1, transition: "opacity 0.2s",
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}>
                      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.557H13.5a.75.75 0 0 1 0 1.5H4.182l-1.903 6.557a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.6-7.386.75.75 0 0 0 0-1.128A28.897 28.897 0 0 0 3.105 2.288Z" />
                    </svg>
                  </button>
                </form>
              )}

              {err && <p style={{ margin: "8px 20px 0", fontSize: 12, color: "#EF4444" }}>{err}</p>}

              {/* Hint bar */}
              <div style={{
                margin: "14px 20px 0",
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                borderRadius: 16,
                background: "rgba(30,111,255,0.05)",
                border: "1px solid rgba(30,111,255,0.08)",
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
                <p style={{ fontSize: 11.5, color: "#6B7280", fontWeight: 500, lineHeight: 1.5, flex: 1 }}>
                  This helps us suggest the best paths and opportunities for you.
                </p>
              </div>

              {/* Bottom nav */}
              <div style={{
                marginTop: "auto",
                padding: "16px 20px 28px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              }}>
                {history.length > 0 ? (
                  <button
                    onClick={goBack} disabled={busy}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 13, fontWeight: 700, color: "#6B7280",
                      background: "none", border: "none", cursor: "pointer",
                      opacity: busy ? 0.4 : 1, transition: "opacity 0.2s",
                      padding: "8px 4px",
                    }}
                  >
                    ← Back
                  </button>
                ) : <span style={{ width: 60 }} />}

                {/* Dot pagination */}
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const active = i === (asked - 1) % 7;
                    return (
                      <div key={i} style={{
                        width: active ? 18 : 6, height: 6, borderRadius: 99,
                        background: active ? "#1E6FFF" : "rgba(30,111,255,0.2)",
                        transition: "all 0.3s ease",
                      }} />
                    );
                  })}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {skipWarning && (
                    <p style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, textAlign: "right", maxWidth: 160, lineHeight: 1.4 }}>
                      ⚠ Skipping may make your results less accurate. Tap again to skip.
                    </p>
                  )}
                  <button
                    onClick={skip} disabled={busy}
                    className="clay-btn"
                    style={{ fontSize: 13, fontWeight: 700, height: 40, padding: "0 18px", opacity: busy ? 0.4 : 1 }}
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div style={{ position: "relative", width: 160, height: 160 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/coyot/idle_thinking.png" alt="Coyot" width={160} height={160} style={{ objectFit: "contain" }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#6B7280" }}>Finding the best question…</p>
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
              <input name="email" type="email" placeholder="your@email.com (optional)" autoFocus className="w-full px-4 py-3.5 text-sm outline-none" style={field} />
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
