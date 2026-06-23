"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import type { AssessmentItemPublic } from "@/types/assessment";
import { KERALA_DISTRICTS } from "@/types/onboarding";

const STAGES = ["interests", "aspiration", "constraints"];
const STAGE_LABELS = ["Your direction", "Your goals", "Practicalities"];
const TURNS_PER_STAGE = 4;
const HARD_MAX_TURNS = 14;

type Msg = { role: "assistant" | "user"; content: string };

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [stageIdx, setStageIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [serverDone, setServerDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  const [assessmentItems, setAssessmentItems] = useState<AssessmentItemPublic[]>([]);
  const [assessmentIdx, setAssessmentIdx] = useState(0);
  const [assessmentDone, setAssessmentDone] = useState(false);
  const [answering, setAnswering] = useState(false);
  const assessmentLoadedRef = useRef(false);

  const [dataPhase, setDataPhase] = useState<"hidden" | "collecting" | "submitting">("hidden");
  const [dataErr, setDataErr] = useState<string | null>(null);

  useEffect(() => {
    if (assessmentDone && dataPhase === "hidden") setDataPhase("collecting");
  }, [assessmentDone, dataPhase]);

  useEffect(() => {
    if (!sessionId || startedRef.current) return;
    startedRef.current = true;
    void initChatSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function initChatSession() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/chat-resume?session=${sessionId}`);
      if (!res.ok) throw new Error("resume fetch failed");
      const data = await res.json() as {
        status: string;
        messages: { role: "assistant" | "user"; content: string }[];
        turns: number;
        lastChoices: string[];
        assessmentAnswered: number;
        assessmentTotal: number;
      };
      if (data.status === "completed" || data.status === "onboarded") {
        router.replace(`/result?session=${sessionId}`);
        return;
      }
      if (data.status === "assessment" && data.assessmentAnswered >= (data.assessmentTotal ?? 10)) {
        setMessages(data.messages);
        setTurns(data.turns);
        assessmentLoadedRef.current = true;
        setAssessmentDone(true);
        setServerDone(true);
        return;
      }
      if (data.status === "assessment") {
        setMessages(data.messages);
        setTurns(data.turns);
        setServerDone(true);
        return;
      }
      if (data.status === "in_chat" && data.messages.length > 0) {
        setMessages(data.messages);
        setTurns(data.turns);
        setStageIdx(Math.min(Math.floor(data.turns / TURNS_PER_STAGE), STAGES.length - 1));
        setChoices(data.lastChoices);
        return;
      }
    } catch {
      // fall through
    }
    void send(undefined, false);
  }

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const chatDone = serverDone || turns >= HARD_MAX_TURNS;

  useEffect(() => {
    if (!chatDone || assessmentLoadedRef.current) return;
    assessmentLoadedRef.current = true;
    fetch(`/api/assessment?session=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        const items: AssessmentItemPublic[] = d.items ?? [];
        setAssessmentItems(items);
        if (items.length === 0) setAssessmentDone(true);
      })
      .catch(() => setAssessmentDone(true));
  }, [chatDone]);

  async function send(message?: string, isChoice = false) {
    if (!sessionId || busy) return;
    setBusy(true);
    setChatError(null);
    setChoices([]);
    if (message) setMessages((m) => [...m, { role: "user", content: message }]);

    let stage = STAGES[stageIdx];
    if (message) {
      const nextTurns = turns + 1;
      setTurns(nextTurns);
      if (nextTurns % TURNS_PER_STAGE === 0 && stageIdx < STAGES.length - 1) {
        setStageIdx((i) => i + 1);
        stage = STAGES[Math.min(stageIdx + 1, STAGES.length - 1)];
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, stage, message, isChoice }),
      });
      if (res.status === 429) { setChatError("The AI is busy right now. Please wait a moment and try again."); return; }
      if (!res.ok) { setChatError("Something went wrong. Please try again."); return; }
      const data = await res.json();
      if (data.done) { setServerDone(true); return; }
      if (data.question) {
        setMessages((m) => [...m, { role: "assistant", content: data.question }]);
        setChoices(data.choices ?? []);
      }
    } catch {
      setChatError("Connection error. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    void send(text, false);
  }

  async function submitAssessmentAnswer(itemId: string, choiceId: string) {
    if (!sessionId || answering) return;
    setAnswering(true);
    try {
      await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, itemId, choiceId }),
      });
    } catch { /* non-fatal */ }
    const next = assessmentIdx + 1;
    if (next >= assessmentItems.length) setAssessmentDone(true);
    else setAssessmentIdx(next);
    setAnswering(false);
  }

  async function submitDataForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionId) return;
    setDataPhase("submitting");
    setDataErr(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      sessionId,
      email: String(fd.get("email") ?? ""),
      gender: String(fd.get("gender") ?? "") || undefined,
      district: String(fd.get("district") ?? ""),
      preferredLanguage: "en",
      consentGiven: fd.get("consentGiven") === "on",
    };
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDataErr(body.error ?? "Please check your details and try again.");
      setDataPhase("collecting");
      return;
    }
    router.push(`/result?session=${sessionId}`);
  }

  if (!sessionId) {
    return (
      <main className="flex h-screen items-center justify-center px-6 text-center" style={{ background: "#F8F3EC", color: "#6B7280" }}>
        Missing session. Please start from{" "}
        <Link href="/start" className="ml-1 underline" style={{ color: "#1E6FFF" }}>the start page</Link>.
      </main>
    );
  }

  const currentAssessmentItem = assessmentItems[assessmentIdx];

  return (
    <div className="flex h-screen flex-col" style={{ background: "#F8F3EC" }}>

      {/* Nav */}
      <header className="shrink-0" style={{ background: "rgba(248,243,236,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,111,255,0.07)" }}>
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.4), 0 6px 16px rgba(30,111,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12, fontFamily: "var(--font-heading)" }}>P</span>
            </div>
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827", fontFamily: "var(--font-heading)" }}>PathFinder</span>
          </Link>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>
            {chatDone && !assessmentDone && assessmentItems.length > 0
              ? `Quick check · ${assessmentIdx + 1} of ${assessmentItems.length}`
              : "Step 2 of 3"}
          </span>
        </div>
      </header>

      {/* Stage progress */}
      {!chatDone && (
        <div className="shrink-0 px-5 pt-3 pb-1">
          <div className="mx-auto max-w-2xl">
            <div className="mb-1.5 flex gap-1.5">
              {STAGE_LABELS.map((label, i) => (
                <div key={label} className="flex-1" style={{ height: 5, borderRadius: 99, background: i <= stageIdx ? "#1E6FFF" : "rgba(30,111,255,0.12)", boxShadow: i <= stageIdx ? "0 1px 6px rgba(30,111,255,0.3)" : "none", transition: "all 0.3s" }} />
              ))}
            </div>
            <p className="text-[11px]" style={{ color: "#9CA3AF" }}>{STAGE_LABELS[stageIdx]} · There are no wrong answers.</p>
          </div>
        </div>
      )}

      {/* Assessment progress */}
      {chatDone && !assessmentDone && assessmentItems.length > 0 && (
        <div className="shrink-0 px-5 pt-3 pb-1">
          <div className="mx-auto max-w-2xl">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-bold" style={{ color: "#111827" }}>Aptitude check</span>
              <span style={{ color: "#9CA3AF" }}>{assessmentIdx + 1} of {assessmentItems.length}</span>
            </div>
            <div className="overflow-hidden" style={{ height: 5, borderRadius: 99, background: "rgba(30,111,255,0.1)" }}>
              <div style={{ height: "100%", borderRadius: 99, background: "#1E6FFF", width: `${(assessmentIdx / assessmentItems.length) * 100}%`, transition: "width 0.3s", boxShadow: "0 1px 6px rgba(30,111,255,0.3)" }} />
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-bold text-white" style={{ borderRadius: 10, background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.35), 0 4px 12px rgba(30,111,255,0.25)" }}>P</div>
                <div className="max-w-[80%] px-4 py-3 text-sm" style={{ borderRadius: "4px 18px 18px 18px", background: "#fff", color: "#111827", boxShadow: "0 2px 12px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.9) inset" }}>{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] px-4 py-3 text-sm text-white" style={{ borderRadius: "18px 4px 18px 18px", background: "linear-gradient(135deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.3), 0 6px 16px rgba(30,111,255,0.2)" }}>{m.content}</div>
              </div>
            )
          )}

          {busy && (
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-bold text-white" style={{ borderRadius: 10, background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.35)" }}>P</div>
              <div className="px-4 py-3" style={{ borderRadius: "4px 18px 18px 18px", background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" style={{ background: "#1E6FFF" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" style={{ background: "#1E6FFF" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "#1E6FFF" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Assessment loading */}
      {chatDone && !assessmentDone && assessmentItems.length === 0 && (
        <div className="shrink-0 px-5 py-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
            <p className="text-sm font-bold" style={{ color: "#111827" }}>Preparing your aptitude check…</p>
            <p className="mt-1 text-xs" style={{ color: "#9CA3AF" }}>This takes a few seconds</p>
          </div>
        </div>
      )}

      {/* Assessment quiz */}
      {chatDone && !assessmentDone && currentAssessmentItem && (
        <div className="shrink-0 px-5 py-4" style={{ borderTop: "1px solid rgba(30,111,255,0.07)" }}>
          <div className="mx-auto max-w-2xl">
            <p className="mb-3 text-sm font-semibold" style={{ color: "#111827" }}>{currentAssessmentItem.questionText}</p>
            <div className="grid gap-2">
              {currentAssessmentItem.choices.map((c) => (
                <button key={c.id} disabled={answering} onClick={() => void submitAssessmentAnswer(currentAssessmentItem.id, c.id)}
                  className="w-full px-4 py-3 text-left text-sm font-medium transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: 16, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151" }}
                  onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#1E6FFF"; (e.target as HTMLButtonElement).style.background = "#EEF4FF"; }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "rgba(30,111,255,0.1)"; (e.target as HTMLButtonElement).style.background = "#F4F6FB"; }}
                >{c.text}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {chatError && (
        <div className="shrink-0 px-5 py-2" style={{ background: "rgba(239,68,68,0.06)", borderTop: "1px solid rgba(239,68,68,0.15)" }}>
          <p className="mx-auto max-w-2xl text-xs" style={{ color: "#EF4444" }}>{chatError}</p>
        </div>
      )}

      {/* Chat input */}
      {!chatDone && (
        <div className="shrink-0 px-5 py-3" style={{ borderTop: "1px solid rgba(30,111,255,0.07)", background: "rgba(248,243,236,0.9)" }}>
          <div className="mx-auto max-w-2xl space-y-2">
            {choices.length > 0 && !busy && (
              <div className="grid grid-cols-2 gap-2">
                {choices.map((c) => (
                  <button key={c} onClick={() => void send(c, true)}
                    className="px-3 py-2.5 text-left text-sm font-medium transition-all focus:outline-none"
                    style={{ borderRadius: 14, border: "1.5px solid rgba(30,111,255,0.12)", background: "#fff", color: "#374151" }}
                    onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#1E6FFF"; (e.target as HTMLButtonElement).style.background = "#EEF4FF"; (e.target as HTMLButtonElement).style.color = "#1E6FFF"; }}
                    onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "rgba(30,111,255,0.12)"; (e.target as HTMLButtonElement).style.background = "#fff"; (e.target as HTMLButtonElement).style.color = "#374151"; }}
                  >{c}</button>
                ))}
              </div>
            )}
            <form onSubmit={onSend} className="flex gap-2.5 items-center px-4 py-2.5" style={{ borderRadius: 22, background: "#fff", border: "1.5px solid rgba(30,111,255,0.12)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={choices.length > 0 ? "Or type your own answer…" : "Type your answer…"}
                disabled={busy}
                className="flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-gray-400"
                style={{ color: "#111827" }}
              />
              <button type="submit" disabled={busy || !input.trim()}
                className="flex shrink-0 items-center justify-center transition-all disabled:opacity-30"
                style={{ width: 34, height: 34, borderRadius: "50%", border: "none", cursor: "pointer", background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.35), 0 4px 12px rgba(30,111,255,0.25)", color: "#fff" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
                  <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.557H13.5a.75.75 0 0 1 0 1.5H4.182l-1.903 6.557a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.6-7.386.75.75 0 0 0 0-1.128A28.897 28.897 0 0 0 3.105 2.288Z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Data collection form */}
      {assessmentDone && dataPhase !== "hidden" && (
        <div className="shrink-0 px-5 py-5" style={{ borderTop: "1px solid rgba(30,111,255,0.07)", background: "rgba(248,243,236,0.95)" }}>
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 rounded-2xl px-4 py-3 text-center" style={{ background: "linear-gradient(135deg, #EEF4FF, #D9E9FF)", border: "1px solid rgba(30,111,255,0.12)" }}>
              <p className="text-sm font-bold" style={{ color: "#111827" }}>Almost there — save your results</p>
              <p className="mt-0.5 text-xs" style={{ color: "#6B7280" }}>Enter your details to get your full personalised career report.</p>
            </div>
            <form onSubmit={submitDataForm} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold" style={{ color: "#6B7280" }}>Email</label>
                <input name="email" type="email" required placeholder="you@example.com" className="w-full px-4 py-3 text-sm outline-none placeholder:text-gray-400 transition-all" style={{ borderRadius: 14, border: "1.5px solid rgba(30,111,255,0.15)", background: "#F4F6FB", color: "#111827" }}
                  onFocus={(e) => { e.target.style.borderColor = "#1E6FFF"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 3px rgba(30,111,255,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(30,111,255,0.15)"; e.target.style.background = "#F4F6FB"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold" style={{ color: "#6B7280" }}>District</label>
                  <Select name="district" required defaultValue="" className="h-11 rounded-2xl border text-sm" style={{ borderColor: "rgba(30,111,255,0.15)", background: "#F4F6FB" }}>
                    <option value="" disabled>Select</option>
                    {KERALA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold" style={{ color: "#6B7280" }}>Gender (optional)</label>
                  <Select name="gender" defaultValue="" className="h-11 rounded-2xl border text-sm" style={{ borderColor: "rgba(30,111,255,0.15)", background: "#F4F6FB" }}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </Select>
                </div>
              </div>
              <label className="flex items-start gap-2.5 rounded-2xl p-3 text-xs" style={{ border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB" }}>
                <Checkbox name="consentGiven" required className="mt-0.5 shrink-0" />
                <span style={{ color: "#6B7280" }}>I agree to my data being processed for career guidance and may be shared with a counsellor.</span>
              </label>
              {dataErr && <p className="rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444" }}>{dataErr}</p>}
              <button type="submit" disabled={dataPhase === "submitting"} className="clay-btn w-full text-sm" style={{ height: 52 }}>
                {dataPhase === "submitting" ? "Saving…" : "Get my career report →"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="flex h-screen items-center justify-center p-12" style={{ color: "#9CA3AF" }}>Loading…</main>}>
      <ChatInner />
    </Suspense>
  );
}
