import type { Stream } from "./onboarding";

// ---------------------------------------------------------------------------
// Controlled profiling vocabularies. The LLM extracts free text but MUST map
// onto these keys — the scoring engine only understands these.
// ---------------------------------------------------------------------------

// India-relevant interest clusters (student-facing, 12).
export const INTEREST_CLUSTERS = [
  "technology_coding", "health_medicine", "business_money", "science_research",
  "design_visual", "helping_teaching", "law_justice", "building_engineering",
  "media_communication", "nature_agriculture", "defence_adventure", "numbers_analysis",
] as const;
export type InterestCluster = (typeof INTEREST_CLUSTERS)[number];

// RIASEC interest backbone.
export const RIASEC = ["realistic", "investigative", "artistic", "social", "enterprising", "conventional"] as const;
export type Riasec = (typeof RIASEC)[number];

// Aptitude categories (0..100).
export const APTITUDES = ["numerical", "logical", "verbal", "spatial", "scientific"] as const;
export type Aptitude = (typeof APTITUDES)[number];

// Personality trait poles (stored as -1..1; positive = first pole listed).
export const PERSONALITY_TRAITS = [
  "analytical", "structured", "social", "practical", "risk_taking",
] as const;
export type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

export const GOAL_ORIENTATIONS = ["job_soon", "higher_study", "business", "government"] as const;
export type GoalOrientation = (typeof GOAL_ORIENTATIONS)[number];

export const BUDGET_BANDS = ["low", "medium", "high", "no_constraint"] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

export const LOCATION_PREFS = ["kerala", "india", "abroad"] as const;
export type LocationPref = (typeof LOCATION_PREFS)[number];

// A single profile signal: value plus how confident we are and where it came from.
export interface Signal<T> {
  value: T;
  confidence: number; // 0..1
  source: "observed" | "inferred";
}

// The structured student profile (stored as jsonb in student_profiles.profile).
export interface StudentProfile {
  academic: {
    stream?: Stream;
    percentage?: number;
    strongSubjects: string[];
    weakSubjects: string[];
  };
  interests: Partial<Record<InterestCluster, number>>; // 0..1 strength
  riasec: Partial<Record<Riasec, number>>;
  aptitude: Partial<Record<Aptitude, number>>; // 0..100
  personality: Partial<Record<PersonalityTrait, number>>; // -1..1
  aspiration: {
    goalOrientation?: GoalOrientation;
    riskAppetite?: number; // 0..1
    ambitionLevel?: number; // 0..1
    // Free-text career the student explicitly says they want to become
    // (e.g. "game developer", "veterinarian"). Used to detect when a student's
    // target career falls outside the KB's catalog so the explainer can address
    // it honestly instead of silently returning the nearest match.
    statedCareer?: string;
    // What the student values most in a career (e.g. "high_salary", "job_security",
    // "passion", "government"). Collected from the "what matters most?" question.
    careerPriorities?: string[];
    // 1 = very open, 0.5 = somewhat open, 0 = wants to stay in stream
    openToOutsideStream?: number;
  };
  constraints: {
    budgetBand?: BudgetBand;
    locationPref?: LocationPref;
    relocationWilling?: boolean;
    familyExpectations: string[];
    timeToIncomeNeed?: "urgent" | "flexible";
  };
  _selectedInterests?: string[];
}

export interface ProfileState {
  sessionId: string;
  profile: StudentProfile;
  completenessPct: number;
  confidence: Record<string, number>;
  conflictFlags: ConflictFlag[];
}

export interface ConflictFlag {
  type: string; // e.g. 'interest_vs_marks'
  detail: string;
  severity: "low" | "medium" | "high";
}

// Empty profile factory.
export function emptyProfile(): StudentProfile {
  return {
    academic: { strongSubjects: [], weakSubjects: [] },
    interests: {},
    riasec: {},
    aptitude: {},
    personality: {},
    aspiration: {},
    constraints: { familyExpectations: [] },
  };
}
