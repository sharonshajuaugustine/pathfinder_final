"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Stream } from "@/types/onboarding";

// ── Stream-aware choice data ─────────────────────────────────────────────────

const STREAM_CHOICES = [
  { label: "Science (Biology)", value: "science_bio" },
  { label: "Science (Maths)", value: "science_maths" },
  { label: "Science (Computer Science)", value: "science_cs" },
  { label: "Commerce", value: "commerce" },
  { label: "Humanities / Arts", value: "humanities" },
];

const SUBJECT_CHOICES: Record<Stream, Array<{ label: string; value: string }>> = {
  science_bio: [
    { label: "Biology", value: "Biology" },
    { label: "Chemistry", value: "Chemistry" },
    { label: "Physics", value: "Physics" },
    { label: "Mathematics", value: "Mathematics" },
  ],
  science_maths: [
    { label: "Mathematics", value: "Mathematics" },
    { label: "Physics", value: "Physics" },
    { label: "Chemistry", value: "Chemistry" },
    { label: "Computer Science", value: "Computer Science" },
  ],
  science_cs: [
    { label: "Computer Science", value: "Computer Science" },
    { label: "Mathematics", value: "Mathematics" },
    { label: "Physics", value: "Physics" },
    { label: "Chemistry", value: "Chemistry" },
  ],
  commerce: [
    { label: "Accountancy", value: "Accountancy" },
    { label: "Business Studies", value: "Business Studies" },
    { label: "Economics", value: "Economics" },
    { label: "Mathematics", value: "Mathematics" },
  ],
  humanities: [
    { label: "History", value: "History" },
    { label: "English", value: "English" },
    { label: "Psychology", value: "Psychology" },
    { label: "Economics", value: "Economics" },
  ],
};

const INTEREST_CHOICES: Record<Stream, Array<{ label: string; value: string }>> = {
  science_bio: [
    { label: "Caring for patients or diagnosing disease", value: "health_medicine" },
    { label: "Running experiments in a lab", value: "science_research" },
    { label: "Growing crops or working with nature", value: "nature_agriculture" },
    { label: "Teaching or mentoring others", value: "helping_teaching" },
  ],
  science_maths: [
    { label: "Building apps, websites, or programs", value: "technology_coding" },
    { label: "Solving maths or engineering problems", value: "numbers_analysis" },
    { label: "Designing structures or machines", value: "building_engineering" },
    { label: "Analysing data to find patterns", value: "science_research" },
  ],
  science_cs: [
    { label: "Writing code and building software", value: "technology_coding" },
    { label: "Designing apps, games, or interfaces", value: "design_visual" },
    { label: "Working with AI, data, or security", value: "numbers_analysis" },
    { label: "Building hardware or embedded systems", value: "building_engineering" },
  ],
  commerce: [
    { label: "Running or growing a business", value: "business_money" },
    { label: "Managing accounts and investments", value: "numbers_analysis" },
    { label: "Arguing cases or navigating law", value: "law_justice" },
    { label: "Marketing, media, or communications", value: "media_communication" },
  ],
  humanities: [
    { label: "Counselling, teaching, or social work", value: "helping_teaching" },
    { label: "Writing, journalism, or broadcasting", value: "media_communication" },
    { label: "Studying law and advocating for justice", value: "law_justice" },
    { label: "Creating art, design, or visual content", value: "design_visual" },
  ],
};

const GOAL_CHOICES = [
  { label: "Study a degree (BTech / BSc / BA / BBA)", value: "higher_study" },
  { label: "Get a job quickly", value: "job_soon" },
  { label: "Prepare for govt exams (PSC / UPSC)", value: "government" },
  { label: "Start a business or project", value: "business" },
];

const PRIORITY_CHOICES = [
  { label: "High salary and fast growth", value: "high_salary" },
  { label: "Stable job and security", value: "job_security" },
  { label: "Work I'm passionate about", value: "passion" },
  { label: "Government or public service", value: "government_service" },
];

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "questions" | "loading" | "result";

type MiniRecCareer = {
  careerId: string;
  name: string;
  domain: string;
  fitScore: number;
  confidence: number;
};

type MiniRecResult = {
  top: MiniRecCareer[];
  overallConfidence: number;
};

const DOMAIN_COLORS: Record<string, string> = {
  "Health & Medicine": "bg-rose-400",
  "Technology": "bg-violet-400",
  "Technology & Computing": "bg-violet-400",
  "Business & Finance": "bg-amber-400",
  "Science & Research": "bg-cyan-400",
  "Engineering": "bg-blue-400",
  "Design & Media": "bg-pink-400",
  "Law & Justice": "bg-indigo-400",
  "Education & Social Work": "bg-green-400",
  "Agriculture & Nature": "bg-emerald-400",
  "Defence & Security": "bg-slate-400",
};

function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? "bg-primary";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StartPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("questions");
  const [qIndex, setQIndex] = useState(0);
  const [stream, setStream] = useState<Stream | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);

  // Subject multi-select
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());

  // Free-text input
  const [showText, setShowText] = useState(false);
  const [textVal, setTextVal] = useState("");
  const textRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [miniRec, setMiniRec] = useState<MiniRecResult | null>(null);
  const [recError, setRecError] = useState(false);

  // Animate question transitions
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "start_quiz" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.sessionId) setSessionId(d.sessionId);
        else setSessionError(true);
      })
      .catch(() => setSessionError(true));
  }, []);

  function getChoices() {
    const s = stream ?? "science_bio";
    switch (qIndex) {
      case 0: return STREAM_CHOICES;
      case 1: return SUBJECT_CHOICES[s];
      case 2: return INTEREST_CHOICES[s];
      case 3: return GOAL_CHOICES;
      case 4: return PRIORITY_CHOICES;
      default: return [];
    }
  }

  function getQuestion() {
    switch (qIndex) {
      case 0: return "Which Plus Two stream are you in?";
      case 1: return "Which subjects are you strongest in? (pick up to 2)";
      case 2: return "Which of these would you most enjoy doing every day?";
      case 3: return "What's your main plan after Plus Two?";
      case 4: return "What matters most in a career for you?";
      default: return "";
    }
  }

  function getTextPlaceholder() {
    switch (qIndex) {
      case 1: return "e.g. Applied Statistics, Physical Education…";
      case 2: return "e.g. I love designing posters, writing stories…";
      case 3: return "e.g. I want to go abroad for studies…";
      case 4: return "e.g. Work-life balance matters most to me…";
      default: return "Type your answer…";
    }
  }

  function toggleSubject(value: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (next.size >= 2) {
          // Replace the oldest selection
          const first = next.values().next().value as string;
          next.delete(first);
        }
        next.add(value);
      }
      return next;
    });
  }

  async function postAnswer(opts: {
    value?: string;
    values?: string[];
    text?: string;
    isChoice: boolean;
  }) {
    if (!sessionId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionIndex: qIndex, ...opts }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
    advance();
  }

  function advance() {
    // Fade out
    setVisible(false);
    setTimeout(() => {
      if (qIndex < 4) {
        setQIndex((i) => i + 1);
        setSelectedSubjects(new Set());
        setShowText(false);
        setTextVal("");
        setVisible(true);
      } else {
        // Last question answered — fetch mini-rec
        setPhase("loading");
        fetchMiniRec();
      }
    }, 220);
  }

  async function fetchMiniRec() {
    if (!sessionId) return;
    try {
      const res = await fetch("/api/mini-recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data: MiniRecResult = await res.json();
      setMiniRec(data);
      setPhase("result");
    } catch {
      setRecError(true);
      setPhase("result");
    }
  }

  function onChoiceClick(value: string) {
    if (qIndex === 0) {
      setStream(value as Stream);
    }
    if (qIndex === 1) {
      toggleSubject(value);
      return; // subjects need explicit Continue
    }
    void postAnswer({ value, isChoice: true });
  }

  function onSubjectContinue() {
    if (selectedSubjects.size === 0 && !textVal.trim()) return;
    if (showText && textVal.trim()) {
      void postAnswer({ text: textVal.trim(), isChoice: false });
    } else if (selectedSubjects.size > 0) {
      void postAnswer({ values: Array.from(selectedSubjects), isChoice: true });
    }
  }

  function onTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = textVal.trim();
    if (!t || busy) return;
    void postAnswer({ text: t, isChoice: false });
  }

  if (sessionError) {
    return (
      <main className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">Could not start a session. Please refresh the page.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white"
        >
          Refresh
        </button>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary" />
            <span className="text-sm font-semibold">PathFinder</span>
          </Link>
          {phase === "questions" && (
            <span className="text-xs text-muted-foreground">Question {qIndex + 1} of 5</span>
          )}
        </div>
      </header>

      {/* Progress dots */}
      {phase === "questions" && (
        <div className="border-b bg-white px-5 py-3">
          <div className="mx-auto flex max-w-lg items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < qIndex ? "bg-primary" : i === qIndex ? "bg-primary/60" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-8">

        {/* ── Questions ── */}
        {phase === "questions" && (
          <div
            className="flex flex-1 flex-col"
            style={{ opacity: visible ? 1 : 0, transition: "opacity 0.22s ease" }}
          >
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
              {["Your stream", "Your subjects", "Your interests", "Your goal", "Your priorities"][qIndex]}
            </p>
            <h2 className="mb-6 text-xl font-bold leading-snug text-foreground sm:text-2xl">
              {getQuestion()}
            </h2>

            {/* Choice buttons */}
            <div className="space-y-2.5">
              {getChoices().map((c) => {
                const isSelected = qIndex === 1 && selectedSubjects.has(c.value);
                return (
                  <button
                    key={c.value}
                    disabled={busy}
                    onClick={() => onChoiceClick(c.value)}
                    className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSelected
                        ? "border-primary bg-primary/8 text-primary ring-1 ring-primary"
                        : "border-border bg-white text-foreground hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    {qIndex === 1 && (
                      <span
                        className={`mr-2.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                          isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground"
                        }`}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                    )}
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Subject Continue button */}
            {qIndex === 1 && (selectedSubjects.size > 0 || (showText && textVal.trim())) && (
              <button
                disabled={busy}
                onClick={onSubjectContinue}
                className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue →"}
              </button>
            )}

            {/* "Type your own" toggle (Q1–Q4) */}
            {qIndex > 0 && !showText && (
              <button
                onClick={() => {
                  setShowText(true);
                  setTimeout(() => textRef.current?.focus(), 50);
                }}
                className="mt-4 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                My answer isn&apos;t listed — type it
              </button>
            )}

            {/* Free-text input */}
            {showText && qIndex > 0 && (
              <form onSubmit={onTextSubmit} className="mt-4 flex gap-2">
                <input
                  ref={textRef}
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                  placeholder={getTextPlaceholder()}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none ring-0 transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={busy || !textVal.trim()}
                  className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  {busy ? "…" : "→"}
                </button>
              </form>
            )}

            {error && (
              <p className="mt-3 text-xs text-destructive">{error}</p>
            )}
          </div>
        )}

        {/* ── Loading mini-rec ── */}
        {phase === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <div className="h-6 w-6 rounded-md bg-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Calculating your matches…</p>
              <p className="mt-1 text-xs text-muted-foreground">Running the recommendation engine</p>
            </div>
          </div>
        )}

        {/* ── Mini-rec result ── */}
        {phase === "result" && (
          <div className="flex flex-1 flex-col">
            {recError || !miniRec ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t generate a preview right now, but your answers are saved.
                </p>
                <button
                  onClick={() => router.push(`/chat?session=${sessionId}`)}
                  className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Continue to conversation →
                </button>
              </div>
            ) : (
              <>
                {/* Card */}
                <div className="rounded-2xl border bg-white p-6 shadow-lg">
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Early estimate
                      </p>
                      <h2 className="mt-0.5 text-lg font-bold text-foreground">Your top career matches</h2>
                    </div>
                    <div className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-center">
                      <p className="text-base font-bold text-amber-600">{miniRec.overallConfidence}%</p>
                      <p className="text-[10px] text-amber-500">confidence</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {miniRec.top.map((c, i) => (
                      <div key={c.careerId}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                              {i + 1}
                            </span>
                            <span className="text-sm font-semibold text-foreground">{c.name}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{c.fitScore}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${domainColor(c.domain)}`}
                            style={{ width: `${c.fitScore}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{c.domain}</p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 rounded-lg bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    These are early estimates based on 5 answers. A short conversation — about 15 minutes —
                    will sharpen them significantly and explain the reasoning behind each match.
                  </p>
                </div>

                <button
                  onClick={() => router.push(`/chat?session=${sessionId}`)}
                  className="mt-5 h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
                >
                  Continue for more accurate results →
                </button>

                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Free · Takes about 15 minutes · No account needed
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
