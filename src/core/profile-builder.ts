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
    _selectedInterests: p._selectedInterests ? [...p._selectedInterests] : undefined,
  };
}

export function mergeProfile(
  base: Partial<StudentProfile> | null | undefined,
  delta: ProfileDelta | null | undefined
): StudentProfile {
  // Always start from a complete, freshly-cloned profile shape.
  const next = normalizeProfile(base);
  if (!delta || typeof delta !== "object") return next;

  if (delta.academic) {
    // Accumulate subject arrays rather than overwriting — clicking "Biology" then
    // "Chemistry" should result in both, not just the most recent click.
    const existingStrong = next.academic.strongSubjects;
    const existingWeak = next.academic.weakSubjects;
    Object.assign(next.academic, delta.academic);
    next.academic.strongSubjects = Array.from(
      new Set([...existingStrong, ...(delta.academic.strongSubjects ?? [])])
    );
    next.academic.weakSubjects = Array.from(
      new Set([...existingWeak, ...(delta.academic.weakSubjects ?? [])])
    );
  }
  if (delta.interests) next.interests = { ...next.interests, ...delta.interests };
  if (delta.riasec) next.riasec = { ...next.riasec, ...delta.riasec };
  if (delta.aptitude) next.aptitude = { ...next.aptitude, ...delta.aptitude };
  if (delta.personality) next.personality = { ...next.personality, ...delta.personality };
  if (delta.aspiration) {
    // Accumulate careerPriorities across turns — multiple answers should merge.
    const existingPriorities = next.aspiration.careerPriorities ?? [];
    Object.assign(next.aspiration, delta.aspiration);
    next.aspiration.careerPriorities = Array.from(
      new Set([...existingPriorities, ...(delta.aspiration.careerPriorities ?? [])])
    );
  }
  if (delta.constraints) {
    const existingFam = next.constraints.familyExpectations;
    const incomingFam = delta.constraints.familyExpectations ?? [];
    Object.assign(next.constraints, delta.constraints);
    next.constraints.familyExpectations = Array.from(new Set([...existingFam, ...incomingFam]));
  }

  // Derive aptitude from the subjects/stream we know. For a Plus Two student,
  // "strong in Maths" is a far more reliable aptitude signal than a few MCQs —
  // and it's the main source now that the quiz is interest-focused. Observed
  // values (e.g. "I'm great at numbers") always win; inference only fills gaps.
  applyDerivedAptitude(next);
  return next;
}

// Maps Plus Two subjects → aptitude dimensions (0..100). Partial substring match,
// so "Computer Science" hits "computer", "Mathematics" hits "maths"/"math".
const SUBJECT_APTITUDE: { match: string[]; aptitude: Partial<Record<string, number>> }[] = [
  { match: ["math", "maths"],            aptitude: { numerical: 85, logical: 80, spatial: 70 } },
  { match: ["physics"],                  aptitude: { numerical: 75, logical: 75, scientific: 80, spatial: 70 } },
  { match: ["chemistry"],                aptitude: { scientific: 85, numerical: 60 } },
  { match: ["biology", "bio ", "botany", "zoology"], aptitude: { scientific: 85, verbal: 60 } },
  { match: ["computer", "informatics"],  aptitude: { logical: 85, numerical: 75 } },
  { match: ["account"],                  aptitude: { numerical: 85, logical: 65 } },
  { match: ["economic"],                 aptitude: { numerical: 75, verbal: 70, logical: 65 } },
  { match: ["business", "commerce"],     aptitude: { verbal: 70, numerical: 65 } },
  { match: ["english", "literature"],    aptitude: { verbal: 90 } },
  { match: ["malayalam", "hindi", "language", "sanskrit", "arabic"], aptitude: { verbal: 75 } },
  { match: ["history"],                  aptitude: { verbal: 80 } },
  { match: ["political", "politics"],    aptitude: { verbal: 80, logical: 65 } },
  { match: ["geography"],                aptitude: { spatial: 75, verbal: 60 } },
  { match: ["sociology", "psychology", "philosophy"], aptitude: { verbal: 75 } },
];

// Weaker baseline from stream alone — used when no subjects were named.
const STREAM_APTITUDE: Record<string, Partial<Record<string, number>>> = {
  science_maths: { numerical: 70, logical: 70, spatial: 65, scientific: 60 },
  science_bio:   { scientific: 75, numerical: 55, verbal: 55 },
  science_cs:    { logical: 75, numerical: 70, scientific: 55 },
  commerce:      { numerical: 70, verbal: 65, logical: 55 },
  humanities:    { verbal: 75, logical: 55 },
};

// Fills aptitude gaps from subjects (preferred) or stream (fallback). Mutates
// the profile in place. Never lowers an existing value — takes the max so an
// observed strength and a subject signal reinforce rather than overwrite.
export function applyDerivedAptitude(p: StudentProfile): void {
  const inferred: Record<string, number> = {};
  const subjects = p.academic.strongSubjects.map((s) => s.toLowerCase());

  for (const subj of subjects) {
    for (const rule of SUBJECT_APTITUDE) {
      if (rule.match.some((m) => subj.includes(m.trim()))) {
        for (const [dim, val] of Object.entries(rule.aptitude)) {
          inferred[dim] = Math.max(inferred[dim] ?? 0, val as number);
        }
      }
    }
  }

  // No subject signal at all → fall back to the stream baseline.
  if (Object.keys(inferred).length === 0 && p.academic.stream) {
    const base = STREAM_APTITUDE[p.academic.stream];
    if (base) for (const [dim, val] of Object.entries(base)) inferred[dim] = val as number;
  }

  for (const [dim, val] of Object.entries(inferred)) {
    const existing = (p.aptitude as Record<string, number>)[dim];
    (p.aptitude as Record<string, number>)[dim] = Math.max(existing ?? 0, val);
  }
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
