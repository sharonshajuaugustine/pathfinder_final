"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import type { AssessmentItemPublic } from "@/types/assessment";
import { KERALA_DISTRICTS } from "@/types/onboarding";

// The chat is adaptive: the server decides when enough is captured and returns
// `done: true`, at which point the interview ends. Stages only rotate the AI's
// topical focus (interests → goals → practicalities). HARD_MAX is a safety
// ceiling so a student who never answers clearly still finishes.
const STAGES = ["interests", "aspiration", "constraints"];
const STAGE_LABELS = ["Your direction", "Your goals", "Practicalities"];
const TURNS_PER_STAGE = 4;
const HARD_MAX_TURNS = 14;

type Msg = { role: "assistant" | "user"; content: string };

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  // ── Chat state ──────────────────────────────────────────────────────────────
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
  // NOTE: gap follow-up capping is now SERVER-SIDE (see /api/chat). The server is
  // the single source of truth for which gap to ask and when to soft-skip, so the
  // client no longer tracks skipGaps or asksByGap.

  // ── Assessment state ────────────────────────────────────────────────────────
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItemPublic[]>([]);
  const [assessmentIdx, setAssessmentIdx] = useState(0);
  const [assessmentDone, setAssessmentDone] = useState(false);
  const [answering, setAnswering] = useState(false);
  const assessmentLoadedRef = useRef(false);

  // ── Data collection form (shown after assessment) ────────────────────────────
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

      // Already completed — send to results page
      if (data.status === "completed" || data.status === "onboarded") {
        router.replace(`/result?session=${sessionId}`);
        return;
      }

      // Assessment fully answered — skip chat AND assessment, show data form
      if (data.status === "assessment" && data.assessmentAnswered >= (data.assessmentTotal ?? 10)) {
        setMessages(data.messages);
        setTurns(data.turns);
        assessmentLoadedRef.current = true; // block the assessment-load effect
        setAssessmentDone(true);
        setServerDone(true);
        return;
      }

      // Mid-assessment — skip chat, load assessment from scratch
      if (data.status === "assessment") {
        setMessages(data.messages);
        setTurns(data.turns);
        setServerDone(true);
        return;
      }

      // Mid-chat with existing messages — restore state, don't re-ask
      if (data.status === "in_chat" && data.messages.length > 0) {
        setMessages(data.messages);
        setTurns(data.turns);
        setStageIdx(Math.min(Math.floor(data.turns / TURNS_PER_STAGE), STAGES.length - 1));
        setChoices(data.lastChoices);
        return;
      }
    } catch {
      // Network error or bad response — fall through to normal first-question flow
    }

    void send(undefined, false);
  }

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  // The interview is over when the server says it has enough, or as a safety net
  // when the student hits the hard question ceiling.
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
      if (res.status === 429) {
        setChatError("The AI is busy right now. Please wait a moment and try again.");
        return;
      }
      if (!res.ok) {
        setChatError("Something went wrong. Please try again.");
        return;
      }
      const data = await res.json();
      // Server has enough — end the interview and move to the assessment.
      if (data.done) {
        setServerDone(true);
        return;
      }
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
    } catch {
      // non-fatal
    }
    const next = assessmentIdx + 1;
    if (next >= assessmentItems.length) {
      setAssessmentDone(true);
    } else {
      setAssessmentIdx(next);
    }
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
      phone: String(fd.get("phone") ?? ""),
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
      <main className="flex h-screen items-center justify-center px-6 text-center text-muted-foreground">
        Missing session. Please start from{" "}
        <Link href="/start" className="ml-1 underline">
          the start page
        </Link>
        .
      </main>
    );
  }

  const currentAssessmentItem = assessmentItems[assessmentIdx];

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ── Top nav ── */}
      <header className="shrink-0 border-b bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary" />
            <span className="text-sm font-semibold">PathFinder</span>
          </Link>
          <span className="text-xs text-muted-foreground">
            {chatDone && !assessmentDone && assessmentItems.length > 0
              ? `Quick check · ${assessmentIdx + 1} of ${assessmentItems.length}`
              : "Step 2 of 3"}
          </span>
        </div>
      </header>

      {/* ── Stage progress (chat phase) ── */}
      {!chatDone && (
        <div className="shrink-0 border-b bg-white px-4 py-2.5">
          <div className="mx-auto max-w-2xl">
            <div className="mb-1.5 flex gap-1.5">
              {STAGE_LABELS.map((label, i) => (
                <div key={label} className="flex-1">
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      i <= stageIdx ? "bg-primary" : "bg-muted"
                    }`}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {STAGE_LABELS[stageIdx]} · There are no wrong answers.
            </p>
          </div>
        </div>
      )}

      {/* ── Assessment progress ── */}
      {chatDone && !assessmentDone && assessmentItems.length > 0 && (
        <div className="shrink-0 border-b bg-white px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Aptitude check</span>
              <span className="text-muted-foreground">
                {assessmentIdx + 1} of {assessmentItems.length}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(assessmentIdx / assessmentItems.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                  P
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm shadow-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-white">
                  {m.content}
                </div>
              </div>
            )
          )}

          {busy && (
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                P
              </div>
              <div className="rounded-2xl rounded-tl-sm border bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* ── Assessment quiz ── */}
      {chatDone && !assessmentDone && currentAssessmentItem && (
        <div className="shrink-0 border-t bg-secondary/30 px-4 py-4">
          <div className="mx-auto max-w-2xl">
            <p className="mb-3 text-sm font-medium text-foreground">
              {currentAssessmentItem.questionText}
            </p>
            <div className="grid gap-2">
              {currentAssessmentItem.choices.map((c) => (
                <button
                  key={c.id}
                  disabled={answering}
                  onClick={() => void submitAssessmentAnswer(currentAssessmentItem.id, c.id)}
                  className="w-full rounded-xl border bg-white px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {c.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {chatError && (
        <div className="shrink-0 border-t border-red-200 bg-red-50 px-4 py-2">
          <p className="mx-auto max-w-2xl text-xs text-red-600">{chatError}</p>
        </div>
      )}

      {/* ── Chat input: choice buttons + Other field ── */}
      {!chatDone && (
        <div className="shrink-0 border-t bg-white px-4 py-3">
          <div className="mx-auto max-w-2xl space-y-2">
            {/* Choice buttons — shown when the AI returns structured options */}
            {choices.length > 0 && !busy && (
              <div className="grid grid-cols-2 gap-2">
                {choices.map((c) => (
                  <button
                    key={c}
                    onClick={() => void send(c, true)}
                    className="rounded-xl border bg-white px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {/* Other / free-text input */}
            <form onSubmit={onSend} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={choices.length > 0 ? "Or type your own answer…" : "Type your answer…"}
                disabled={busy}
                className="flex-1 rounded-xl"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Data collection form (after assessment) ── */}
      {assessmentDone && dataPhase !== "hidden" && (
        <div className="shrink-0 border-t bg-white px-4 py-5">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 rounded-xl bg-primary/5 px-4 py-3 text-center">
              <p className="text-sm font-semibold text-foreground">Almost there — save your results</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Enter your details to get your full personalised career report.
              </p>
            </div>
            <form onSubmit={submitDataForm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Phone</label>
                  <Input name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" placeholder="9XXXXXXXXX" className="h-9 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                  <Input name="email" type="email" required placeholder="you@example.com" className="h-9 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">District</label>
                  <Select name="district" required defaultValue="" className="h-9 text-sm">
                    <option value="" disabled>Select</option>
                    {KERALA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Gender (optional)</label>
                  <Select name="gender" defaultValue="" className="h-9 text-sm">
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </Select>
                </div>
              </div>
              <label className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3 text-xs">
                <Checkbox name="consentGiven" required className="mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  I agree to my data being processed for career guidance and may be shared with a counsellor.
                </span>
              </label>
              {dataErr && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{dataErr}</p>
              )}
              <button
                type="submit"
                disabled={dataPhase === "submitting"}
                className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow transition-all hover:bg-primary/90 disabled:opacity-50"
              >
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
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center p-12 text-muted-foreground">
          Loading…
        </main>
      }
    >
      <ChatInner />
    </Suspense>
  );
}
