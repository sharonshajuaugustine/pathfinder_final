import { clamp } from "@/lib/utils";
import type { StudentProfile } from "@/types/profile";
import type { Career, EligibilityRule, KnowledgeBase } from "@/types/kb";
import type { EligibilityStatus, ScoreFactor } from "@/types/recommendation";

// ---------------------------------------------------------------------------
// SCORING ENGINE — deterministic. This is a final decision-maker (with the
// recommendation engine). The AI never runs scoring.
//
// Pipeline per career:
//   1. Hard eligibility filter (stream/subjects/marks) across its courses.
//   2. Weighted soft scoring across 6 dimensions.
// ---------------------------------------------------------------------------

// Default scoring weights (tunable; mirror the blueprint).
export const SCORING_WEIGHTS = {
  interest: 0.3,
  aptitude: 0.25,
  academic: 0.15,
  personality: 0.1,
  aspiration: 0.1,
  constraint: 0.1,
} as const;

export interface CareerScore {
  career: Career;
  fitScore: number;
  factors: ScoreFactor[];
}

// ---- Eligibility (hard filter) ------------------------------------------------

export function evaluateEligibility(
  rule: EligibilityRule | undefined,
  profile: StudentProfile,
  age?: number
): { status: EligibilityStatus; notes: string[] } {
  const notes: string[] = [];
  if (!rule) return { status: "eligible", notes };

  // Stream (OR) — hard reject on mismatch.
  if (rule.requiredStream.length && profile.academic.stream) {
    if (!rule.requiredStream.includes(profile.academic.stream)) {
      return { status: "ineligible", notes: ["Stream does not match course requirement"] };
    }
  }

  // Age window.
  if (age !== undefined) {
    if (rule.ageMin && age < rule.ageMin) return { status: "ineligible", notes: ["Below minimum age"] };
    if (rule.ageMax && age > rule.ageMax) return { status: "ineligible", notes: ["Above maximum age"] };
  }

  // Aggregate marks — below threshold becomes CONDITIONAL, not rejected.
  let status: EligibilityStatus = "eligible";
  if (rule.minAggregatePct && profile.academic.percentage !== undefined) {
    if (profile.academic.percentage < rule.minAggregatePct) {
      status = "conditional";
      notes.push(`Needs ~${rule.minAggregatePct}% (current ${profile.academic.percentage}%)`);
    }
  }

  if (rule.otherConstraints.length) {
    notes.push(...rule.otherConstraints.map((c) => `Note: ${c.replace(/-/g, " ")}`));
  }
  return { status, notes };
}

// ---- Soft scoring -------------------------------------------------------------

export function scoreCareer(career: Career, profile: StudentProfile, kb: KnowledgeBase): CareerScore {
  const signals = kb.signals.filter((s) => s.careerId === career.id);
  const factors: ScoreFactor[] = [];

  // Interest match: weighted overlap of student interests vs career interest signals.
  const interestScore = weightedMatch(
    signals.filter((s) => s.signalType === "interest").map((s) => [s.signalKey, s.weight]),
    (k) => profile.interests[k as keyof typeof profile.interests] ?? 0
  );
  pushFactor(factors, "interest", interestScore, SCORING_WEIGHTS.interest, topLabel(career, "interest"));

  // Aptitude match: career aptitude signals vs student aptitude (normalized 0..1).
  const aptitudeScore = weightedMatch(
    signals.filter((s) => s.signalType === "aptitude").map((s) => [s.signalKey, s.weight]),
    (k) => (profile.aptitude[k as keyof typeof profile.aptitude] ?? 0) / 100
  );
  pushFactor(factors, "aptitude", aptitudeScore, SCORING_WEIGHTS.aptitude, "Aptitude alignment");

  // Academic fit: strong subjects matching, light penalty for weak overlaps.
  const academicScore = academicFit(career, profile);
  pushFactor(factors, "academic", academicScore, SCORING_WEIGHTS.academic, "Academic fit");

  // Personality fit: overlap of career personality_fit tags with student traits.
  const personalityScore = personalityFit(career, profile);
  pushFactor(factors, "personality", personalityScore, SCORING_WEIGHTS.personality, "Personality fit");

  // Aspiration alignment.
  const aspirationScore = aspirationFit(career, profile);
  pushFactor(factors, "aspiration", aspirationScore, SCORING_WEIGHTS.aspiration, "Goal alignment");

  // Constraint feasibility (budget/time-to-income vs career profile).
  const constraintScore = constraintFit(career, profile);
  pushFactor(factors, "constraint", constraintScore, SCORING_WEIGHTS.constraint, "Fits your constraints");

  const fitScore = Number(
    clamp(
      interestScore * SCORING_WEIGHTS.interest +
        aptitudeScore * SCORING_WEIGHTS.aptitude +
        academicScore * SCORING_WEIGHTS.academic +
        personalityScore * SCORING_WEIGHTS.personality +
        aspirationScore * SCORING_WEIGHTS.aspiration +
        constraintScore * SCORING_WEIGHTS.constraint
    ).toFixed(4)
  );

  // Keep only meaningfully-contributing factors, ranked.
  const ranked = factors
    .filter((f) => f.contribution > 0.02)
    .sort((a, b) => b.contribution - a.contribution);

  return { career, fitScore, factors: ranked };
}

// ---- helpers ------------------------------------------------------------------

function weightedMatch(signals: [string, number][], studentValue: (k: string) => number): number {
  if (!signals.length) return 0;
  let num = 0;
  let denom = 0;
  for (const [key, weight] of signals) {
    num += weight * clamp(studentValue(key));
    denom += weight;
  }
  return denom === 0 ? 0 : clamp(num / denom);
}

function academicFit(career: Career, profile: StudentProfile): number {
  // Reward when career domain aligns with strong subjects (heuristic for MVP).
  const strong = profile.academic.strongSubjects.map((s) => s.toLowerCase());
  if (!strong.length) return 0.5; // neutral when unknown
  const domainHints: Record<string, string[]> = {
    "computing":        ["maths", "computer", "physics"],
    "engineering":      ["maths", "physics"],
    "medical":          ["biology", "chemistry"],
    "allied_health":    ["biology", "chemistry"],
    "sciences":         ["physics", "chemistry", "biology", "maths"],
    "commerce_finance": ["accountancy", "economics", "maths", "business"],
    "management":       ["accountancy", "economics", "business"],
    "law":              ["english", "political", "history"],
    "government":       ["english", "political", "history", "economics"],
    "humanities":       ["english", "history", "political", "social"],
    "architecture":     ["maths", "physics"],
    "design":           ["art", "computer"],
    "media":            ["english", "language"],
    "agriculture":      ["biology", "chemistry"],
    "hospitality":      ["english"],
  };
  const hints = domainHints[career.domainId] ?? [];
  const hit = hints.some((h) => strong.some((s) => s.includes(h)));
  // Return 0.5 (neutral) for domains without hints rather than 0.4 (penalty).
  return hit ? 0.85 : hints.length > 0 ? 0.4 : 0.5;
}

function personalityFit(career: Career, profile: StudentProfile): number {
  if (!career.personalityFit.length) return 0.5;
  const matches = career.personalityFit.filter(
    (t) => (profile.personality[t] ?? 0) > 0.2
  ).length;
  return clamp(matches / career.personalityFit.length);
}

function aspirationFit(career: Career, profile: StudentProfile): number {
  const goal = profile.aspiration.goalOrientation;
  if (!goal) return 0.5;
  if (goal === "higher_study") {
    // Careers that require or prefer postgraduate study align best with this goal.
    if (career.higherStudyRequired === "mandatory") return 0.9;
    if (career.higherStudyRequired === "preferred") return 0.75;
    return 0.6; // 'none' — compatible but not a strong pull
  }
  if (goal === "job_soon") return career.minYearsToEarn && career.minYearsToEarn <= 4 ? 0.9 : 0.4;
  if (goal === "business") {
    if (career.riskLevel === "entrepreneurial") return 0.9;
    if (career.riskLevel === "moderate") return 0.6;
    return 0.4; // stable careers don't align with entrepreneurial goal
  }
  if (goal === "government") {
    // Score by how strongly a career tracks to government recruitment.
    if (career.domainId === "government") return 0.9;
    // Humanities, law, commerce, engineering all have significant govt pipelines (PSC, IBPS, PSU).
    const govCompatible = ["humanities", "law", "commerce_finance", "engineering"];
    if (govCompatible.includes(career.domainId)) return 0.6;
    return 0.4; // primarily private-sector paths
  }
  return 0.5;
}

function constraintFit(career: Career, profile: StudentProfile): number {
  let score = 0.7;
  if (profile.constraints.timeToIncomeNeed === "urgent" && (career.minYearsToEarn ?? 5) > 4) score -= 0.3;
  if (profile.constraints.budgetBand === "low" && career.higherStudyRequired === "mandatory") score -= 0.15;
  return clamp(score);
}

function pushFactor(
  factors: ScoreFactor[],
  dimension: ScoreFactor["dimension"],
  raw: number,
  weight: number,
  label: string
) {
  factors.push({ dimension, label, contribution: Number((raw * weight).toFixed(4)) });
}

function topLabel(career: Career, kind: string): string {
  return kind === "interest" ? "Matches your interests" : career.name;
}
