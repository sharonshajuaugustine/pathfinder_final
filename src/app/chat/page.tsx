"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { AssessmentItemPublic } from "@/types/assessment";

// Chat page — functional PLACEHOLDER. Wires the guided conversation to
// /api/chat (AI interviews + extracts). Not the final polished UI.
//
// Flow: chat (10 turns) → mini assessment (15 MCQs) → result page.
// The assessment activates the dormant 25% aptitude weight in the scoring engine.
const STAGES = ["interests", "strengths", "personality", "aspiration", "constraints"];

type Msg = { role: "assistant" | "user"; content: string };

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  // ── Chat state ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [stageIdx, setStageIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  // One-shot guard: React StrictMode double-invokes mount effects in dev.
  const startedRef = useRef(false);

  // ── Assessment state ─────────────────────────────────────────────────────
  const [assessmentItems, setAssessmentItems] = useState<AssessmentItemPublic[]>([]);
  const [assessmentIdx, setAssessmentIdx] = useState(0);
  const [assessmentDone, setAssessmentDone] = useState(false);
  const [answering, setAnswering] = useState(false);
  const assessmentLoadedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || startedRef.current) return;
    startedRef.current = true;
    void send(undefined); // kick off the first AI question exactly once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const chatDone = turns >= STAGES.length * 2;

  // Fetch assessment questions once chat finishes.
  useEffect(() => {
    if (!chatDone || assessmentLoadedRef.current) return;
    assessmentLoadedRef.current = true;
    fetch("/api/assessment")
      .then((r) => r.json())
      .then((d) => {
        const items: AssessmentItemPublic[] = d.items ?? [];
        setAssessmentItems(items);
        if (items.length === 0) setAssessmentDone(true); // fallback: skip if empty
      })
      .catch(() => setAssessmentDone(true)); // fallback: don't block on network error
  }, [chatDone]);

  async function send(message?: string) {
    if (!sessionId || busy) return;
    setBusy(true);
    if (message) setMessages((m) => [...m, { role: "user", content: message }]);

    // Advance stage every 2 student turns (simple MVP pacing).
    let stage = STAGES[stageIdx];
    if (message) {
      const t = turns + 1;
      setTurns(t);
      if (t % 2 === 0 && stageIdx < STAGES.length - 1) {
        setStageIdx((i) => i + 1);
        stage = STAGES[Math.min(stageIdx + 1, STAGES.length - 1)];
      }
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, stage, message }),
    });
    const data = await res.json();
    if (data.question) setMessages((m) => [...m, { role: "assistant", content: data.question }]);
    setBusy(false);
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    void send(text);
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
      // non-fatal — profile update best-effort
    }
    const next = assessmentIdx + 1;
    if (next >= assessmentItems.length) {
      setAssessmentDone(true);
    } else {
      setAssessmentIdx(next);
    }
    setAnswering(false);
  }

  if (!sessionId) {
    return <main className="p-12 text-center text-muted-foreground">Missing session. Please start from onboarding.</main>;
  }

  const currentAssessmentItem = assessmentItems[assessmentIdx];

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col px-4 py-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Let&apos;s talk about you</h1>
        {!chatDone && (
          <p className="text-xs text-muted-foreground">Stage: {STAGES[stageIdx]} · There are no wrong answers.</p>
        )}
        {chatDone && !assessmentDone && assessmentItems.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Quick check — question {assessmentIdx + 1} of {assessmentItems.length}
          </p>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <Card
            key={i}
            className={m.role === "user" ? "ml-auto max-w-[80%] bg-primary text-primary-foreground" : "mr-auto max-w-[80%]"}
          >
            <div className="p-3 text-sm">{m.content}</div>
          </Card>
        ))}
        {busy && <p className="text-xs text-muted-foreground">Thinking…</p>}
        <div ref={endRef} />
      </div>

      {/* ── Assessment phase (after chat is done, before result) ── */}
      {chatDone && !assessmentDone && currentAssessmentItem && (
        <div className="mt-4 space-y-3">
          <Card className="mr-auto max-w-[90%]">
            <div className="p-3 text-sm">{currentAssessmentItem.questionText}</div>
          </Card>
          <div className="grid gap-2">
            {currentAssessmentItem.choices.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="h-auto justify-start whitespace-normal py-2 px-3 text-left text-sm"
                disabled={answering}
                onClick={() => void submitAssessmentAnswer(currentAssessmentItem.id, c.id)}
              >
                {c.text}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat input (visible while chat is running) ── */}
      {!chatDone && (
        <form onSubmit={onSend} className="mt-4 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your answer…" disabled={busy} />
          <Button type="submit" disabled={busy || !input.trim()}>Send</Button>
        </form>
      )}

      {/* ── Result button (after both chat and assessment are done) ── */}
      {assessmentDone && (
        <Button className="mt-4" onClick={() => router.push(`/result?session=${sessionId}`)}>
          See my recommendations
        </Button>
      )}
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="p-12 text-center">Loading…</main>}>
      <ChatInner />
    </Suspense>
  );
}
