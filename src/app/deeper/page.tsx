"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { KERALA_DISTRICTS } from "@/types/onboarding";
import type { AssessmentItemPublic } from "@/types/assessment";

// New "dig deeper" flow (replaces the long AI chat):
//   1. email  — collect email + district + consent BEFORE the aptitude section
//   2. aptitude — AI-generated questions curated to the student's stream/interests
//   3. redirect to /result, where the full engine runs with aptitude included.

type Phase = "email" | "followup" | "loading" | "aptitude" | "finishing";
type FollowChoice = { label: string; value: string };

// Scored aptitude dimensions — anything else (interest/preference) gets a softer label.
const APTITUDE_DIMS = new Set(["numerical", "logical", "verbal", "spatial", "scientific"]);

function DeeperInner() {
  const router = useRouter();
  const sessionId = useSearchParams().get("session");

  const [phase, setPhase] = useState<Phase>("email");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<AssessmentItemPublic[]>([]);
  const [idx, setIdx] = useState(0);
  const [answering, setAnswering] = useState(false);
  const loadedRef = useRef(false);

  // Short adaptive follow-up (up to 3 questions) shown before the aptitude check.
  const FOLLOWUP_TOTAL = 3;
  const [followQ, setFollowQ] = useState<string | null>(null);
  const [followChoices, setFollowChoices] = useState<FollowChoice[]>([]);
  const [followIdx, setFollowIdx] = useState(0);
  const [followBusy, setFollowBusy] = useState(false);
  const [followText, setFollowText] = useState("");

  // Load the aptitude questions once the email step is cleared.
  useEffect(() => {
    if (phase !== "loading" || loadedRef.current || !sessionId) return;
    loadedRef.current = true;
    fetch(`/api/assessment?session=${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        const fetched: AssessmentItemPublic[] = d.items ?? [];
        if (fetched.length === 0) {
          // No questions — skip straight to the report.
          router.push(`/result?session=${sessionId}`);
          return;
        }
        setItems(fetched);
        setPhase("aptitude");
      })
      .catch(() => router.push(`/result?session=${sessionId}`));
  }, [phase, sessionId, router]);

  async function submitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionId) return;
    setSubmitting(true);
    setEmailErr(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      sessionId,
      email: String(fd.get("email") ?? ""),
      district: String(fd.get("district") ?? ""),
      preferredLanguage: "en",
      consentGiven: fd.get("consentGiven") === "on",
    };
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setEmailErr(body.error ?? "Please check your details and try again.");
        setSubmitting(false);
        return;
      }
    } catch {
      setEmailErr("Connection error. Please try again.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setPhase("followup");
    void loadFollow(0);
  }

  // Load the next follow-up question. `prev` carries the answer to the previous
  // one (if any). When the server says done (or fails), move on to aptitude.
  async function loadFollow(index: number, prev?: { value?: string; text?: string; isChoice?: boolean }) {
    if (!sessionId) return;
    setFollowBusy(true);
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, index, prev }),
      });
      const data = await res.json().catch(() => ({ done: true }));
      if (!res.ok || data.done || !data.question) {
        setPhase("loading"); // proceed to aptitude
        return;
      }
      setFollowIdx(index);
      setFollowQ(data.question);
      setFollowChoices(data.choices ?? []);
      setFollowText("");
    } catch {
      setPhase("loading");
    } finally {
      setFollowBusy(false);
    }
  }

  function answerFollow(prev: { value?: string; text?: string; isChoice?: boolean }) {
    if (followBusy) return;
    void loadFollow(followIdx + 1, prev);
  }

  async function answer(itemId: string, choiceId: string) {
    if (!sessionId || answering) return;
    setAnswering(true);
    try {
      await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, itemId, choiceId }),
      });
    } catch { /* non-fatal — keep going */ }
    const next = idx + 1;
    setAnswering(false);
    if (next >= items.length) {
      setPhase("finishing");
      router.push(`/result?session=${sessionId}`);
    } else {
      setIdx(next);
    }
  }

  if (!sessionId) {
    return (
      <main className="flex h-screen items-center justify-center px-6 text-center" style={{ background: "#F8F3EC", color: "#6B7280" }}>
        Missing session. Please start from{" "}
        <Link href="/start" className="ml-1 underline" style={{ color: "#1E6FFF" }}>the start page</Link>.
      </main>
    );
  }

  const current = items[idx];

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#F8F3EC" }}>
      {/* Nav */}
      <header className="sticky top-0 z-50" style={{ background: "rgba(248,243,236,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(30,111,255,0.07)" }}>
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.4), 0 6px 16px rgba(30,111,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>P</span>
            </div>
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827" }}>PathFinder</span>
          </Link>
          {phase === "followup" && followQ && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>
              Quick chat · {Math.min(followIdx + 1, FOLLOWUP_TOTAL)} / {FOLLOWUP_TOTAL}
            </span>
          )}
          {phase === "aptitude" && items.length > 0 && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}>
              {idx + 1} / {items.length}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-6">
        {/* ── Email step ── */}
        {phase === "email" && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="clay-card px-6 pt-6 pb-5">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>One last thing</p>
              <h2 className="text-xl font-bold leading-snug sm:text-2xl" style={{ color: "#111827" }}>
                Where should we send your full report?
              </h2>
              <p className="mt-2 text-sm" style={{ color: "#6B7280" }}>
                Next is a short aptitude check that sharpens your matches. Save your spot first.
              </p>
            </div>

            <form onSubmit={submitEmail} className="clay-card p-6 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold" style={{ color: "#6B7280" }}>Email</label>
                <input
                  name="email" type="email" required placeholder="you@example.com" autoFocus
                  className="w-full px-4 py-3.5 text-sm outline-none placeholder:text-gray-400 transition-all"
                  style={{ borderRadius: 16, border: "1.5px solid rgba(30,111,255,0.15)", background: "#F4F6FB", color: "#111827" }}
                  onFocus={(e) => { e.target.style.borderColor = "#1E6FFF"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 3px rgba(30,111,255,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(30,111,255,0.15)"; e.target.style.background = "#F4F6FB"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold" style={{ color: "#6B7280" }}>District</label>
                <Select name="district" required defaultValue="" className="h-12 rounded-2xl border text-sm" style={{ borderColor: "rgba(30,111,255,0.15)", background: "#F4F6FB" }}>
                  <option value="" disabled>Select your district</option>
                  {KERALA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <label className="flex items-start gap-2.5 rounded-2xl p-3 text-xs" style={{ border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB" }}>
                <Checkbox name="consentGiven" required className="mt-0.5 shrink-0" />
                <span style={{ color: "#6B7280" }}>I agree to my data being processed for career guidance and possibly shared with a counsellor.</span>
              </label>
              {emailErr && <p className="rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444" }}>{emailErr}</p>}
              <button type="submit" disabled={submitting} className="clay-btn w-full text-sm" style={{ height: 52 }}>
                {submitting ? "Saving…" : "Start aptitude check →"}
              </button>
            </form>
          </div>
        )}

        {/* ── Follow-up (adaptive) ── */}
        {phase === "followup" && (
          followQ ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="px-1">
                <div className="overflow-hidden" style={{ height: 6, borderRadius: 99, background: "rgba(30,111,255,0.1)" }}>
                  <div style={{ height: "100%", borderRadius: 99, background: "#1E6FFF", width: `${(followIdx / FOLLOWUP_TOTAL) * 100}%`, transition: "width 0.3s", boxShadow: "0 1px 6px rgba(30,111,255,0.3)" }} />
                </div>
              </div>
              <div className="clay-card px-6 pt-6 pb-5">
                <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>A quick follow-up</p>
                <h2 className="text-lg font-bold leading-snug" style={{ color: "#111827" }}>{followQ}</h2>
              </div>
              <div className="clay-card p-4 space-y-2">
                {followChoices.map((c, i) => (
                  <button
                    key={`${c.value}-${i}`} disabled={followBusy} onClick={() => answerFollow({ value: c.value, isChoice: true })}
                    className="w-full px-4 py-4 text-left text-sm font-semibold transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderRadius: 18, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#1E6FFF"; e.currentTarget.style.background = "#EEF4FF"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(30,111,255,0.1)"; e.currentTarget.style.background = "#F4F6FB"; }}
                  >{c.label}</button>
                ))}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); const t = followText.trim(); if (!t || followBusy) return; answerFollow({ text: t, isChoice: false }); }}
                className="flex items-center gap-2.5 px-4 py-3"
                style={{ borderRadius: 22, background: "#fff", border: "1.5px solid rgba(30,111,255,0.12)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
              >
                <input
                  value={followText} onChange={(e) => setFollowText(e.target.value)} disabled={followBusy}
                  placeholder="Or type your own answer…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
                  style={{ color: "#111827" }}
                />
                <button type="submit" disabled={followBusy || !followText.trim()}
                  className="flex shrink-0 items-center justify-center transition-all disabled:opacity-30"
                  style={{ width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", background: "linear-gradient(145deg, #3B82FF, #1E6FFF)", boxShadow: "0 3px 0 rgba(6,26,138,0.35)", color: "#fff" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.557H13.5a.75.75 0 0 1 0 1.5H4.182l-1.903 6.557a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.6-7.386.75.75 0 0 0 0-1.128A28.897 28.897 0 0 0 3.105 2.288Z" />
                  </svg>
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="h-8 w-8 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
              <p className="text-sm font-bold" style={{ color: "#111827" }}>Getting to know you…</p>
            </div>
          )
        )}

        {/* ── Loading aptitude ── */}
        {phase === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#111827" }}>Building your aptitude check…</p>
              <p className="mt-1 text-xs" style={{ color: "#9CA3AF" }}>Personalised to your stream and interests</p>
            </div>
          </div>
        )}

        {/* ── Aptitude questions ── */}
        {phase === "aptitude" && current && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="px-1">
              <div className="overflow-hidden" style={{ height: 6, borderRadius: 99, background: "rgba(30,111,255,0.1)" }}>
                <div style={{ height: "100%", borderRadius: 99, background: "#1E6FFF", width: `${(idx / items.length) * 100}%`, transition: "width 0.3s", boxShadow: "0 1px 6px rgba(30,111,255,0.3)" }} />
              </div>
            </div>
            <div className="clay-card px-6 pt-6 pb-5">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: "#1E6FFF" }}>
                {APTITUDE_DIMS.has(current.dimension) ? "Aptitude check" : "What you enjoy"}
              </p>
              <h2 className="text-lg font-bold leading-snug" style={{ color: "#111827" }}>{current.questionText}</h2>
            </div>
            <div className="clay-card p-4 space-y-2">
              {current.choices.map((c) => (
                <button
                  key={c.id} disabled={answering} onClick={() => void answer(current.id, c.id)}
                  className="w-full px-4 py-4 text-left text-sm font-semibold transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: 18, border: "1.5px solid rgba(30,111,255,0.1)", background: "#F4F6FB", color: "#374151" }}
                  onMouseEnter={(e) => { (e.currentTarget).style.borderColor = "#1E6FFF"; (e.currentTarget).style.background = "#EEF4FF"; }}
                  onMouseLeave={(e) => { (e.currentTarget).style.borderColor = "rgba(30,111,255,0.1)"; (e.currentTarget).style.background = "#F4F6FB"; }}
                >{c.text}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Finishing ── */}
        {phase === "finishing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full" style={{ border: "2.5px solid #1E6FFF", borderTopColor: "transparent" }} />
            <p className="text-sm font-bold" style={{ color: "#111827" }}>Building your full career report…</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DeeperPage() {
  return (
    <Suspense fallback={<main className="flex h-screen items-center justify-center p-12" style={{ color: "#9CA3AF" }}>Loading…</main>}>
      <DeeperInner />
    </Suspense>
  );
}
