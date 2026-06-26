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
const MIN_QUESTIONS       = 4;    // first 4 fixed Qs (goal/career/stream/subjects) establish strong priors
const CONFIDENCE_GAP      = 0.15; // require a bigger lead before early stop to avoid noise termination
const MAX_INTEREST        = 4;    // keep interest block short (stream filters cut further)
const MAX_APTITUDE        = 2;    // max aptitude questions
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

const SUBJECTS_QUESTION_IDS = [
  "ctx_subjects_bio", "ctx_subjects_maths", "ctx_subjects_commerce",
  "ctx_subjects_humanities", "ctx_subjects_vocational",
] as const;

function subjectsQuestionId(profile: StudentProfile): string {
  switch (profile.academic.stream) {
    case "science_bio":   return "ctx_subjects_bio";
    case "science_maths":
    case "science_cs":    return "ctx_subjects_maths";
    case "commerce":      return "ctx_subjects_commerce";
    case "humanities":    return "ctx_subjects_humanities";
    default:              return "ctx_subjects_vocational";
  }
}

export function pickNextQuestion(
  profile: StudentProfile,
  kb: KnowledgeBase,
  askedIds: string[]
): AdaptiveQuestion | null {
  const asked = new Set(askedIds);

  // 1. Goal — always first (frames everything).
  if (!asked.has("ctx_goal")) return ADAPTIVE_BY_ID.ctx_goal;

  // 1b. Stated career — right after goal while student is thinking about their future.
  if (!asked.has("ctx_stated_career")) return ADAPTIVE_BY_ID.ctx_stated_career;

  // 2. Stream — gates which subject question to show next.
  // Skip if stream is already known (collected during intake).
  if (!asked.has("ctx_stream") && !profile.academic.stream) return ADAPTIVE_BY_ID.ctx_stream;

  // 3. Stream-specific subject they enjoy — strongest early signal before info-gain kicks in.
  const hasAnsweredSubjects = SUBJECTS_QUESTION_IDS.some((id) => asked.has(id));
  if (!hasAnsweredSubjects) return ADAPTIVE_BY_ID[subjectsQuestionId(profile)];

  const beliefs = scoreBeliefs(profile, kb);
  const confident = isConfident(beliefs, askedIds.length);

  // Which interest cluster did the hobbies question seed (if answered)?
  // Hobbies sets exactly 0.85 — no direct interest question uses that value —
  // so any cluster at 0.85 after ctx_hobbies was asked is hobbies-seeded.
  // We skip its direct interest question to avoid an immediate contradiction.
  const hobbiesClusterSkip = asked.has("ctx_hobbies")
    ? Object.entries(profile.interests).find(([, v]) => v === 0.85)?.[0] ?? null
    : null;

  // 4. Interest questions — with hobbies fallback when stuck.
  if (!confident) {
    // 4a. Stuck? Inject hobbies question to recover signal.
    if (!asked.has("ctx_hobbies") && isStuck(profile, asked)) {
      return ADAPTIVE_BY_ID.ctx_hobbies;
    }

    // 4b. Domain drills — fire once when a cluster is confirmed ≥ 0.7.
    //     Only fire if the parent interest question for that cluster has been asked
    //     (so the student confirmed the interest before we drill in).
    const DRILLS: { drillId: string; parentId: string; cluster: keyof typeof profile.interests }[] = [
      { drillId: "int_business_drill", parentId: "int_business_money",    cluster: "business_money" },
      { drillId: "int_health_drill",   parentId: "int_health_medicine",   cluster: "health_medicine" },
      { drillId: "int_tech_drill",     parentId: "int_technology_coding", cluster: "technology_coding" },
      { drillId: "int_design_drill",   parentId: "int_design_visual",     cluster: "design_visual" },
      { drillId: "int_science_drill",  parentId: "int_science_research",  cluster: "science_research" },
    ];
    for (const { drillId, parentId, cluster } of DRILLS) {
      const score = profile.interests[cluster] ?? 0;
      if (score >= 0.7 && asked.has(parentId) && !asked.has(drillId)) {
        return ADAPTIVE_BY_ID[drillId];
      }
    }

    // 4c. Continue asking interest questions by info-gain, skipping clusters
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

      // Stream-aware exclusions: skip clusters that are very unlikely given
      // the student's stream. Applied once the subject question is answered
      // (stream signal is reliable by then). Be generous — only exclude clusters
      // where there is almost no realistic career path for that stream.
      const streamExclusions = new Set<string>();
      if (hasAnsweredSubjects) {
        const stream = profile.academic.stream as string | undefined;
        const strongSubjects = profile.academic.strongSubjects.map((s) => s.toLowerCase());
        const hasCS = strongSubjects.some((s) => s.includes("computer") || s.includes("cs") || s.includes("it"));

        if (stream === "science_bio") {
          // Bio students: coding/engineering/defence rarely relevant unless CS chosen
          if (!hasCS) streamExclusions.add("technology_coding");
          streamExclusions.add("building_engineering");
          streamExclusions.add("defence_adventure");
        }

        if (stream === "science_maths") {
          // Maths students: defence and pure nature/agri are off-track
          if (!hasCS) streamExclusions.add("technology_coding"); // already in aptitude path
          streamExclusions.add("defence_adventure");
          streamExclusions.add("nature_agriculture");
        }

        if (stream === "commerce") {
          // Commerce students: hard sciences and physical/outdoor clusters not relevant
          streamExclusions.add("nature_agriculture");
          streamExclusions.add("building_engineering");
          streamExclusions.add("defence_adventure");
          streamExclusions.add("health_medicine");
          streamExclusions.add("science_research");
        }

        if (stream === "humanities") {
          // Humanities: tech, hard engineering, outdoor/physical not relevant
          streamExclusions.add("technology_coding");
          streamExclusions.add("building_engineering");
          streamExclusions.add("nature_agriculture");
          streamExclusions.add("defence_adventure");
          streamExclusions.add("numbers_analysis");
        }

        if (stream === "vocational") {
          // Vocational: law and pure science research unlikely
          streamExclusions.add("law_justice");
          streamExclusions.add("science_research");
        }
      }

      const pool = (candidates.length > 0 ? candidates : byKind("interest"))
        .filter((q) => q.signalKey !== hobbiesClusterSkip && !streamExclusions.has(q.signalKey ?? ""));
      const q = pickByInfoGain(pool, asked, beliefs, kb);
      if (q) return q;
      void dominantCluster; // suppress unused-var lint
    }
  }

  // 5. Personality questions — skip if already confident (personality weight is 0.1;
  //    won't flip a clear winner). Still ask if undecided.
  if (!confident) {
    for (const id of ["per_social", "per_practical"]) {
      if (!asked.has(id)) return ADAPTIVE_BY_ID[id];
    }
  }

  // 6. Aptitude questions by relevance (skip if confident).
  if (!confident && countAsked(asked, "aptitude") < MAX_APTITUDE) {
    const q = pickByInfoGain(byKind("aptitude"), asked, beliefs, kb);
    if (q) return q;
  }

  // 7. Budget — always needed to filter course options.
  if (!asked.has("ctx_budget")) return ADAPTIVE_BY_ID.ctx_budget;
  // Location — skip if confident (top career is clear; location only refines course list).
  if (!asked.has("ctx_location") && !confident) return ADAPTIVE_BY_ID.ctx_location;

  // 8. Hobbies fallback — only if still not confident (skip if engine already knows enough).
  if (!asked.has("ctx_hobbies") && !confident) return ADAPTIVE_BY_ID.ctx_hobbies;

  // 9. Risk personality if still undecided.
  if (!asked.has("per_risk") && !confident) return ADAPTIVE_BY_ID.per_risk;

  return null;
}

// Estimate how many questions are likely left — used by the client to show a progress hint.
// This is a rough upper bound, not a guarantee; the engine may stop early.
export function estimateQuestionsRemaining(
  profile: StudentProfile,
  kb: KnowledgeBase,
  askedIds: string[]
): number {
  const asked = new Set(askedIds);
  const beliefs = scoreBeliefs(profile, kb);
  const confident = isConfident(beliefs, askedIds.length);

  let n = 0;

  // Budget is always asked.
  if (!asked.has("ctx_budget")) n++;

  if (!confident) {
    // Location, personality, hobbies, risk — all conditional on not-confident.
    if (!asked.has("ctx_location")) n++;
    if (!asked.has("per_social")) n++;
    if (!asked.has("per_practical")) n++;

    // Remaining interest questions up to the cap.
    const interestAsked = byKind("interest").filter((q) => asked.has(q.id)).length;
    n += Math.max(0, MAX_INTEREST - interestAsked);

    // Remaining aptitude questions up to the cap.
    const aptAsked = byKind("aptitude").filter((q) => asked.has(q.id)).length;
    n += Math.max(0, MAX_APTITUDE - aptAsked);
  }

  return n;
}
