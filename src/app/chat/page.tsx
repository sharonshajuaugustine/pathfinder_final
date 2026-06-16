"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

// Chat page — functional PLACEHOLDER. Wires the guided conversation to
// /api/chat (AI interviews + extracts). Not the final polished UI.
//
// MVP stage sequence (the orchestrator lives client-side here for now; move to
// a server-driven state machine when hardening).
const STAGES = ["interests", "strengths", "personality", "aspiration", "constraints"];

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
  const endRef = useRef<HTMLDivElement>(null);
  // One-shot guard: React StrictMode double-invokes mount effects in dev, which
  // otherwise fires two kickoff requests => the same opening question twice.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || startedRef.current) return;
    startedRef.current = true;
    void send(undefined); // kick off the first AI question exactly once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

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

  const done = turns >= STAGES.length * 2;

  if (!sessionId) {
    return <main className="p-12 text-center text-muted-foreground">Missing session. Please start from onboarding.</main>;
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col px-4 py-6">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Let&apos;s talk about you</h1>
        <p className="text-xs text-muted-foreground">Stage: {STAGES[stageIdx]} · There are no wrong answers.</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <Card key={i} className={m.role === "user" ? "ml-auto max-w-[80%] bg-primary text-primary-foreground" : "mr-auto max-w-[80%]"}>
            <div className="p-3 text-sm">{m.content}</div>
          </Card>
        ))}
        {busy && <p className="text-xs text-muted-foreground">Thinking…</p>}
        <div ref={endRef} />
      </div>

      {done ? (
        <Button className="mt-4" onClick={() => router.push(`/result?session=${sessionId}`)}>
          See my recommendations
        </Button>
      ) : (
        <form onSubmit={onSend} className="mt-4 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your answer…" disabled={busy} />
          <Button type="submit" disabled={busy || !input.trim()}>Send</Button>
        </form>
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
