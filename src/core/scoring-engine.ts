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
// aspiration raised from 0.1 → 0.15: student's stated career / priorities are a strong self-signal.
// academic lowered from 0.15 → 0.10: stream is a filter, not a strong differentiator post-stream-question.
export const SCORING_WEIGHTS = {
  interest: 0.3,
  aptitude: 0.25,
  academic: 0.10,
  personality: 0.1,
  aspiration: 0.15,
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

  // Which dimensions did we actually measure for THIS student? A dimension with
  // no data must be EXCLUDED from the weighted average — not scored 0. Scoring an
  // unmeasured dimension 0 silently caps everyone's fit (e.g. an empty aptitude
  // section dragging every career down ~25 points). We renormalize over the
  // dimensions we have, so a fit score reflects fit on what we know.
  const has = {
    interest: Object.values(profile.interests).some((v) => (v ?? 0) > 0) || Object.keys(profile.riasec).length > 0,
    aptitude: Object.keys(profile.aptitude).length > 0,
    academic: profile.academic.strongSubjects.length > 0 || profile.academic.percentage !== undefined,
    personality: Object.values(profile.personality).some((v) => Math.abs(v ?? 0) > 0),
    aspiration: !!profile.aspiration.goalOrientation || (profile.aspiration.careerPriorities?.length ?? 0) > 0,
    constraint: !!profile.constraints.budgetBand || !!profile.constraints.locationPref,
  };

  // Interest match: weighted overlap of student interests vs career interest signals.
  let interestScore = weightedMatch(
    signals.filter((s) => s.signalType === "interest").map((s) => [s.signalKey, s.weight]),
    (k) => profile.interests[k as keyof typeof profile.interests] ?? 0
  );

  // Culinary interest booster: if career is culinary and user selected any culinary option or typed cooking
  const isCulinaryCareer = career.id === "pastry_chef" || career.id === "restaurant_manager" || career.id === "food_scientist" || career.id === "food_stylist" || career.domainId === "hospitality";
  const rawInterests = (profile as any)._selectedInterests as string[] | undefined;
  const hasCulinaryInterest = rawInterests && rawInterests.some(val => {
    const v = val.toLowerCase();
    return v.includes("chef") || v.includes("culinary") || v.includes("restaurant") || v.includes("food") || v.includes("cook") || v.includes("bak") || v.includes("hospitality") || v.includes("hotel");
  });
  const hasCulinarySubject = profile.academic.strongSubjects.some(s => {
    const low = s.toLowerCase();
    return low.includes("cook") || low.includes("chef") || low.includes("bake") || low.includes("baking") || low.includes("culinary") || low.includes("food") || low.includes("hotel") || low.includes("hospitality");
  });
  if (isCulinaryCareer && (hasCulinaryInterest || hasCulinarySubject)) {
    interestScore = 0.95;
  }

  // RIASEC blend: if student has RIASEC data, blend it into the interest score
  // (RIASEC is fundamentally an interest-type framework). Only blends when we
  // have RIASEC data so it can't drag scores down when unanswered.
  const riasec = riasecFit(career, profile);
  if (riasec !== null) {
    interestScore = clamp(0.7 * interestScore + 0.3 * riasec);
  }

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

  // Weighted average over MEASURED dimensions only (renormalized).
  const dims: [number, number, boolean][] = [
    [interestScore, SCORING_WEIGHTS.interest, has.interest],
    [aptitudeScore, SCORING_WEIGHTS.aptitude, has.aptitude],
    [academicScore, SCORING_WEIGHTS.academic, has.academic],
    [personalityScore, SCORING_WEIGHTS.personality, has.personality],
    [aspirationScore, SCORING_WEIGHTS.aspiration, has.aspiration],
    [constraintScore, SCORING_WEIGHTS.constraint, has.constraint],
  ];
  let num = 0;
  let denom = 0;
  for (const [score, weight, present] of dims) {
    if (!present) continue;
    num += score * weight;
    denom += weight;
  }
  const fitScore = Number(clamp(denom === 0 ? 0 : num / denom).toFixed(4));

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

// Small modifier from the student's overall percentage. High marks signal
// academic capability; low marks signal potential misalignment with demanding courses.
// Kept deliberately small (±0.1) so it nudges rather than dominates.
function percentageModifier(pct: number | undefined): number {
  if (pct === undefined) return 0;
  if (pct >= 80) return 0.10;
  if (pct >= 60) return 0.05;
  if (pct >= 45) return 0;
  return -0.10;
}

function academicFit(career: Career, profile: StudentProfile): number {
  const strong = profile.academic.strongSubjects.map((s) => s.toLowerCase());
  const pctMod = percentageModifier(profile.academic.percentage);

  if (!strong.length) {
    const isCulinaryCareer = career.id === "pastry_chef" || career.id === "restaurant_manager" || career.id === "food_scientist" || career.id === "food_stylist" || career.domainId === "hospitality";
    const hasCulinaryStated = profile.aspiration.statedCareer && (() => {
      const low = profile.aspiration.statedCareer.toLowerCase();
      return low.includes("cook") || low.includes("chef") || low.includes("bake") || low.includes("baking") || low.includes("culinary") || low.includes("food") || low.includes("hotel") || low.includes("hospitality");
    })();
    if (isCulinaryCareer && hasCulinaryStated) return 0.95;
    // No subjects known — percentage alone still applies to the neutral baseline.
    return clamp(0.5 + pctMod);
  }

  const hasCulinarySubject = strong.some(s => {
    return s.includes("cook") || s.includes("chef") || s.includes("bake") || s.includes("baking") || s.includes("culinary") || s.includes("food") || s.includes("hotel") || s.includes("hospitality");
  });
  const isCulinaryCareer = career.id === "pastry_chef" || career.id === "restaurant_manager" || career.id === "food_scientist" || career.id === "food_stylist" || career.domainId === "hospitality";
  if (isCulinaryCareer && hasCulinarySubject) return 0.95;

  const domainHints: Record<string, string[]> = {
    "computing":        ["maths", "computer", "physics"],
    "engineering":      ["maths", "physics"],
    "medical":          ["biology", "chemistry"],
    "allied_health":    ["biology", "chemistry"],
    "sciences":         ["physics", "chemistry", "biology", "maths"],
    "commerce_finance": ["accountancy", "economics", "maths", "business"],
    "management":       ["accountancy", "economics", "business", "art"],
    "law":              ["english", "political", "history"],
    "government":       ["english", "political", "history", "economics"],
    "humanities":       ["english", "history", "political", "social"],
    "architecture":     ["maths", "physics"],
    "design":           ["art", "computer"],
    "media":            ["english", "language", "art", "humanities", "history"],
    "agriculture":      ["biology", "chemistry"],
    "hospitality":      ["english", "business", "commerce", "chemistry", "accountancy", "economics", "maths"],
  };
  const hints = domainHints[career.domainId] ?? [];
  const hit = hints.some((h) => strong.some((s) => s.includes(h)));
  const base = hit ? 0.85 : hints.length > 0 ? 0.4 : 0.5;
  return clamp(base + pctMod);
}

function personalityFit(career: Career, profile: StudentProfile): number {
  if (!career.personalityFit.length) return 0.5;
  const matches = career.personalityFit.filter(
    (t) => (profile.personality[t] ?? 0) > 0.2
  ).length;
  const ratio = matches / career.personalityFit.length;
  // Floor at 0.3: a single unmeasured/unmatched personality trait should not
  // zero out 10% of a career's score. Personality is a weak, noisy signal from
  // a few MCQ answers — a student curious about science but who didn't pick the
  // "logic puzzle" option shouldn't be hard-blocked from research careers.
  // 0 matches => 0.3, partial/full matches scale up to 1.0.
  return clamp(0.3 + 0.7 * ratio);
}

const GOVT_CAREER_IDS = new Set([
  "civil_services_officer", "defence_officer", "bank_officer",
  "forest_officer", "customs_excise_officer", "revenue_officer",
]);
const BUSINESS_CAREER_IDS = new Set([
  "business_manager", "mobile_app_developer", "game_developer",
]);

function aspirationFit(career: Career, profile: StudentProfile): number {
  const goal = profile.aspiration.goalOrientation;
  const priorities = profile.aspiration.careerPriorities ?? [];

  // Start with a base score from career properties, then apply goal multiplier.
  // Base: neutral 0.5 unless goal is known.
  let base = 0.5;
  let multiplier = 1.0;

  if (goal === "job_soon") {
    // Penalise long-study careers hard; boost careers where income starts in ≤2 years.
    if (career.higherStudyRequired === "mandatory") multiplier = 0.4;
    else if (career.minYearsToEarn !== undefined && career.minYearsToEarn <= 2) multiplier = 1.3;
    else if (career.minYearsToEarn !== undefined && career.minYearsToEarn > 4) multiplier = 0.7;
    base = 0.7;
  } else if (goal === "higher_study") {
    if (career.higherStudyRequired === "mandatory") { base = 0.9; multiplier = 1.2; }
    else if (career.higherStudyRequired === "preferred") { base = 0.75; multiplier = 1.2; }
    else { base = 0.6; multiplier = 0.85; }
  } else if (goal === "government") {
    if (GOVT_CAREER_IDS.has(career.id)) { base = 0.9; multiplier = 1.4; }
    else if (career.domainId === "government") { base = 0.85; multiplier = 1.2; }
    else if (["humanities", "law", "commerce_finance", "engineering"].includes(career.domainId)) base = 0.6;
    else if (career.riskLevel === "entrepreneurial") { base = 0.3; multiplier = 0.5; }
    else base = 0.4;
  } else if (goal === "business") {
    if (BUSINESS_CAREER_IDS.has(career.id)) { base = 0.9; multiplier = 1.3; }
    else if (career.riskLevel === "entrepreneurial") { base = 0.85; multiplier = 1.3; }
    else if (career.riskLevel === "moderate") base = 0.6;
    else { base = 0.4; multiplier = 0.8; }
  }

  let score = clamp(base * multiplier);

  // careerPriorities: small modifiers on top for what the student values most.
  let priorityMod = 0;
  if (priorities.includes("high_salary") || priorities.includes("salary")) {
    if (career.earningBand === "high") priorityMod += 0.08;
    else if (career.earningBand === "low") priorityMod -= 0.08;
  }
  if (priorities.includes("job_security") || priorities.includes("stability")) {
    if (career.riskLevel === "stable") priorityMod += 0.08;
    else if (career.riskLevel === "entrepreneurial") priorityMod -= 0.05;
  }
  if (priorities.includes("government") || priorities.includes("govt")) {
    if (GOVT_CAREER_IDS.has(career.id)) priorityMod += 0.10;
    else if (career.domainId === "government") priorityMod += 0.05;
  }
  if (priorities.includes("helping") || priorities.includes("social")) {
    if (["medical", "allied_health", "humanities", "government"].includes(career.domainId)) priorityMod += 0.06;
  }

  return clamp(score + priorityMod);
}

function constraintFit(career: Career, profile: StudentProfile): number {
  let score = 0.7;
  if (profile.constraints.timeToIncomeNeed === "urgent" && (career.minYearsToEarn ?? 5) > 4) score -= 0.3;
  if (profile.constraints.budgetBand === "low" && career.higherStudyRequired === "mandatory") score -= 0.15;

  // Location preference: reward careers whose job market aligns with where the
  // student wants to work. Penalties are mild — location is a preference, not a rule.
  const loc = profile.constraints.locationPref;
  if (loc === "kerala") {
    if (career.jobMarketKerala === "strong") score += 0.10;
    else if (career.jobMarketKerala === "weak") score -= 0.08;
  } else if (loc === "india") {
    if (career.jobMarketIndia === "strong") score += 0.10;
    else if (career.jobMarketIndia === "weak") score -= 0.05;
  } else if (loc === "gulf") {
    // Gulf demand is strong for engineering, hospitality, medical, allied health, computing.
    const gulfFriendly = ["engineering", "hospitality", "medical", "allied_health", "computing", "commerce_finance"];
    if (gulfFriendly.includes(career.domainId)) score += 0.10;
    else if (career.jobMarketIndia === "weak") score -= 0.05;
  } else if (loc === "abroad") {
    if (career.jobMarketIndia === "strong") score += 0.08;
    // Research/sciences and computing have strong global demand
    if (["computing", "sciences", "medical", "engineering"].includes(career.domainId)) score += 0.05;
  }

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

// RIASEC fit: what fraction of the career's RIASEC codes the student scores >= 0.5 on.
// Returns null when either side has no data so the caller can skip the blend.
function riasecFit(career: Career, profile: StudentProfile): number | null {
  if (!career.riasecCodes.length) return null;
  const profileKeys = Object.keys(profile.riasec);
  if (profileKeys.length === 0) return null;
  const hits = career.riasecCodes.filter((code) => (profile.riasec[code] ?? 0) >= 0.5).length;
  return hits / career.riasecCodes.length;
}
