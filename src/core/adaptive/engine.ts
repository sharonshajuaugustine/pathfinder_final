import type { StudentProfile } from "@/types/profile";
import type { KnowledgeBase, Career } from "@/types/kb";
import { scoreCareer } from "../scoring-engine";
import { ADAPTIVE_QUESTIONS, ADAPTIVE_BY_ID, type AdaptiveQuestion } from "./question-bank";

// ---------------------------------------------------------------------------
// ADAPTIVE ENGINE (Akinator-style)
//
// Belief  = the current career ranking from the deterministic scoring engine.
// Each turn we pick the question that best SEPARATES the careers currently in
// the lead — i.e. the one where the leading careers most disagree.
//
// Termination is confidence-based, not count-based:
//   • After MIN_QUESTIONS, if the top career leads #2 by CONFIDENCE_GAP, stop.
//   • Budget and location are always asked regardless (they filter courses).
//   • Hobbies question is injected when 3+ interest Qs yield no signal (stuck).
// ---------------------------------------------------------------------------

const TOP_K = 12;
const MIN_QUESTIONS       = 6;    // minimum before early confidence stop
const CONFIDENCE_GAP      = 0.15; // top career must lead #2 by this on 0-1 scale
const MAX_INTEREST        = 8;    // max interest questions (up from 5)
const MAX_APTITUDE        = 3;    // max aptitude questions (up from 2)
const EPS                 = 1e-6;

export interface Belief {
  career: Career;
  score: number;
}

export function scoreBeliefs(profile: StudentProfile, kb: KnowledgeBase): Belief[] {
  return kb.careers
    .map((c) => ({ career: c, score: scoreCareer(c, profile, kb).fitScore }))
    .sort((a, b) => b.score - a.score);
}

function careerSignalValue(
  career: Career,
  kind: AdaptiveQuestion["kind"],
  signalKey: string | undefined,
  kb: KnowledgeBase
): number {
  if (!signalKey || kind === "context") return 0;
  const sig = kb.signals.find(
    (s) => s.careerId === career.id && s.signalType === kind && s.signalKey === signalKey
  );
  if (sig) return sig.weight;
  if (kind === "personality" && career.personalityFit.includes(signalKey as never)) return 1;
  return 0;
}

export function informativeness(q: AdaptiveQuestion, beliefs: Belief[], kb: KnowledgeBase): number {
  if (q.kind === "context") return 0;
  const top = beliefs.slice(0, TOP_K);
  const total = top.reduce((sum, b) => sum + Math.max(b.score, 0), 0);
  if (total <= EPS) {
    const vals = top.map((b) => careerSignalValue(b.career, q.kind, q.signalKey, kb));
    const mean = vals.reduce((a, v) => a + v, 0) / (vals.length || 1);
    return vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length || 1);
  }
  const weights = top.map((b) => Math.max(b.score, 0) / total);
  const vals = top.map((b) => careerSignalValue(b.career, q.kind, q.signalKey, kb));
  const mean = vals.reduce((a, v, i) => a + weights[i] * v, 0);
  return vals.reduce((a, v, i) => a + weights[i] * (v - mean) ** 2, 0);
}

function pickByInfoGain(
  candidates: AdaptiveQuestion[],
  asked: Set<string>,
  beliefs: Belief[],
  kb: KnowledgeBase
): AdaptiveQuestion | null {
  let best: AdaptiveQuestion | null = null;
  let bestScore = -1;
  let firstUnasked: AdaptiveQuestion | null = null;
  for (const q of candidates) {
    if (asked.has(q.id)) continue;
    if (!firstUnasked) firstUnasked = q;
    const score = informativeness(q, beliefs, kb);
    if (score > bestScore) { bestScore = score; best = q; }
  }
  if (bestScore > EPS) return best;
  return firstUnasked;
}

const byKind = (kind: AdaptiveQuestion["kind"]) =>
  ADAPTIVE_QUESTIONS.filter((q) => q.kind === kind);

function countAsked(asked: Set<string>, kind: AdaptiveQuestion["kind"]): number {
  return byKind(kind).filter((q) => asked.has(q.id)).length;
}

// Student is "stuck" if 3+ direct interest questions have been asked but no
// interest cluster has risen above 0.2 — all answers were "Not really for me".
function isStuck(profile: StudentProfile, asked: Set<string>): boolean {
  const interestAsked = byKind("interest").filter((q) => asked.has(q.id)).length;
  if (interestAsked < 3) return false;
  const vals = Object.values(profile.interests ?? {}).filter((v): v is number => typeof v === "number");
  const maxInterest = vals.length > 0 ? Math.max(...vals) : 0;
  return maxInterest < 0.2;
}

// Is the engine confident enough to skip remaining interest / aptitude questions?
// Budget and location are still always asked — they filter course recommendations.
function isConfident(beliefs: Belief[], askedCount: number): boolean {
  if (askedCount < MIN_QUESTIONS) return false;
  if (beliefs.length < 2) return false;
  return (beliefs[0].score - beliefs[1].score) >= CONFIDENCE_GAP;
}

export function pickNextQuestion(
  profile: StudentProfile,
  kb: KnowledgeBase,
  askedIds: string[]
): AdaptiveQuestion | null {
  const asked = new Set(askedIds);

  // 1. Goal — always first (frames everything).
  if (!asked.has("ctx_goal")) return ADAPTIVE_BY_ID.ctx_goal;

  // 2. Stream openness — gates which career clusters are in play.
  if (!asked.has("ctx_open_stream")) return ADAPTIVE_BY_ID.ctx_open_stream;

  // 3. Subject they enjoy — strongest early signal before info-gain kicks in.
  if (!asked.has("ctx_subjects")) return ADAPTIVE_BY_ID.ctx_subjects;

  const beliefs = scoreBeliefs(profile, kb);
  const confident = isConfident(beliefs, askedIds.length);

  // 4. Interest questions — with hobbies fallback when stuck.
  if (!confident) {
    // 4a. Stuck? Inject hobbies question to recover signal.
    if (!asked.has("ctx_hobbies") && isStuck(profile, asked)) {
      return ADAPTIVE_BY_ID.ctx_hobbies;
    }

    // 4b. Continue asking interest questions by info-gain, skipping clusters
    //     that are irrelevant once a dominant cluster emerges (score > 0.6 and
    //     leading by 0.2+). This stops design/science Qs when law is clearly winning.
    if (countAsked(asked, "interest") < MAX_INTEREST) {
      const dominated = beliefs.length >= 2 &&
        beliefs[0].score > 0.6 &&
        (beliefs[0].score - beliefs[1].score) >= 0.20;
      const dominantCluster = dominated ? beliefs[0].career.id : null;

      const candidates = dominated
        ? byKind("interest").filter((q) => {
            // Keep questions whose signal key is relevant to the dominant career.
            const sig = q.signalKey
              ? kb.signals.find(
                  (s) => s.careerId === beliefs[0].career.id &&
                          s.signalType === "interest" &&
                          s.signalKey === q.signalKey
                )
              : null;
            return sig != null && sig.weight > 0.3;
          })
        : byKind("interest");

      const pool = candidates.length > 0 ? candidates : byKind("interest");
      const q = pickByInfoGain(pool, asked, beliefs, kb);
      if (q) return q;
      void dominantCluster; // suppress unused-var lint
    }
  }

  // 5. Core personality questions (always asked).
  for (const id of ["per_social", "per_practical"]) {
    if (!asked.has(id)) return ADAPTIVE_BY_ID[id];
  }

  // 6. Aptitude questions by relevance (skip if confident).
  if (!confident && countAsked(asked, "aptitude") < MAX_APTITUDE) {
    const q = pickByInfoGain(byKind("aptitude"), asked, beliefs, kb);
    if (q) return q;
  }

  // 7. Budget and location — always asked (needed to filter course recommendations).
  if (!asked.has("ctx_budget")) return ADAPTIVE_BY_ID.ctx_budget;
  if (!asked.has("ctx_location")) return ADAPTIVE_BY_ID.ctx_location;

  // 8. Hobbies fallback if not yet asked (e.g. student was confident early).
  if (!asked.has("ctx_hobbies")) return ADAPTIVE_BY_ID.ctx_hobbies;

  // 9. Risk personality if still undecided.
  if (!asked.has("per_risk") && !confident) return ADAPTIVE_BY_ID.per_risk;

  return null;
}
