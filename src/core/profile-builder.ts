import { clamp } from "@/lib/utils";
import {
  emptyProfile,
  type StudentProfile,
  type ProfileState,
  APTITUDES,
} from "@/types/profile";

// ---------------------------------------------------------------------------
// Profile builder. Merges newly extracted signals (from the AI extractor or the
// assessment) into the running profile, and computes completeness.
//
// It does NOT call the AI. The AI produces a validated `ProfileDelta`; this
// module is pure, deterministic state-merging — easy to test.
//
// IMPORTANT: profiles loaded from the DB may be PARTIAL (e.g. onboarding seeds
// only the `academic` section). Every entry point normalizes to the full shape
// first, so no function ever touches an undefined section.
// ---------------------------------------------------------------------------

export interface ProfileDelta {
  academic?: Partial<StudentProfile["academic"]>;
  interests?: Partial<StudentProfile["interests"]>;
  riasec?: Partial<StudentProfile["riasec"]>;
  aptitude?: Partial<StudentProfile["aptitude"]>;
  personality?: Partial<StudentProfile["personality"]>;
  aspiration?: Partial<StudentProfile["aspiration"]>;
  constraints?: Partial<StudentProfile["constraints"]>;
}

// Coerce any partial / null / malformed profile into a complete StudentProfile
// with every section present. Safe to call on DB rows, undefined, or {}.
export function normalizeProfile(p?: Partial<StudentProfile> | null): StudentProfile {
  const base = emptyProfile();
  if (!p || typeof p !== "object") return base;

  return {
    academic: {
      ...base.academic,
      ...(p.academic ?? {}),
      strongSubjects: [...(p.academic?.strongSubjects ?? base.academic.strongSubjects)],
      weakSubjects: [...(p.academic?.weakSubjects ?? base.academic.weakSubjects)],
    },
    interests: { ...base.interests, ...(p.interests ?? {}) },
    riasec: { ...base.riasec, ...(p.riasec ?? {}) },
    aptitude: { ...base.aptitude, ...(p.aptitude ?? {}) },
    personality: { ...base.personality, ...(p.personality ?? {}) },
    aspiration: { ...base.aspiration, ...(p.aspiration ?? {}) },
    constraints: {
      ...base.constraints,
      ...(p.constraints ?? {}),
      familyExpectations: [
        ...(p.constraints?.familyExpectations ?? base.constraints.familyExpectations),
      ],
    },
  };
}

export function mergeProfile(
  base: Partial<StudentProfile> | null | undefined,
  delta: ProfileDelta | null | undefined
): StudentProfile {
  // Always start from a complete, freshly-cloned profile shape.
  const next = normalizeProfile(base);
  if (!delta || typeof delta !== "object") return next;

  if (delta.academic) Object.assign(next.academic, delta.academic);
  if (delta.interests) next.interests = { ...next.interests, ...delta.interests };
  if (delta.riasec) next.riasec = { ...next.riasec, ...delta.riasec };
  if (delta.aptitude) next.aptitude = { ...next.aptitude, ...delta.aptitude };
  if (delta.personality) next.personality = { ...next.personality, ...delta.personality };
  if (delta.aspiration) Object.assign(next.aspiration, delta.aspiration);
  if (delta.constraints) {
    const existingFam = next.constraints.familyExpectations;
    const incomingFam = delta.constraints.familyExpectations ?? [];
    Object.assign(next.constraints, delta.constraints);
    next.constraints.familyExpectations = Array.from(new Set([...existingFam, ...incomingFam]));
  }
  return next;
}

// Completeness: weighted coverage of the dimensions the scoring engine needs.
// Accepts partial/null input and normalizes first, so it never crashes.
export function computeCompleteness(input?: Partial<StudentProfile> | null): number {
  const p = normalizeProfile(input);
  const checks: number[] = [
    p.academic.stream ? 1 : 0,
    p.academic.percentage !== undefined ? 1 : 0,
    Object.keys(p.interests).length >= 3 ? 1 : Object.keys(p.interests).length / 3,
    coverage(p.aptitude, APTITUDES.length),
    p.aspiration.goalOrientation ? 1 : 0,
    p.constraints.budgetBand ? 1 : 0,
    p.constraints.locationPref ? 1 : 0,
    p.academic.strongSubjects.length > 0 ? 1 : 0,
  ];
  const score = checks.reduce((a, b) => a + b, 0) / checks.length;
  return Math.round(clamp(score) * 100);
}

function coverage(obj: Record<string, unknown> | null | undefined, target: number): number {
  return clamp(Object.keys(obj ?? {}).length / target);
}

export function buildProfileState(
  sessionId: string,
  profile: Partial<StudentProfile> | null | undefined,
  confidence: Record<string, number> = {}
): ProfileState {
  const normalized = normalizeProfile(profile);
  return {
    sessionId,
    profile: normalized,
    completenessPct: computeCompleteness(normalized),
    confidence,
    conflictFlags: [],
  };
}

export { emptyProfile };
