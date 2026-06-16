import type { StudentProfile } from "@/types/profile";
import type { KnowledgeBase, Career } from "@/types/kb";
import type {
  RecommendationResult, CareerRecommendation, CourseRecommendation,
} from "@/types/recommendation";
import { scoreCareer, evaluateEligibility } from "./scoring-engine";
import { computeConfidence } from "./confidence";
import { detectConflicts } from "./conflict-detection";
import { computeCompleteness } from "./profile-builder";

// ---------------------------------------------------------------------------
// RECOMMENDATION ENGINE — the final decision-maker.
//
// Orchestrates: score every career -> rank -> for each top career resolve
// eligible courses (primary/alt/fallback) + exams + skills + alternatives ->
// compute confidence and caveats. Output is 100% derived from the KB + engine;
// the AI only adds prose explanation afterwards (see reviewer step / API route).
// ---------------------------------------------------------------------------

export interface RecommendOptions {
  topN?: number;
  age?: number;
}

export function generateRecommendations(
  sessionId: string,
  profile: StudentProfile,
  kb: KnowledgeBase,
  opts: RecommendOptions = {}
): RecommendationResult {
  const topN = opts.topN ?? 5;

  // 1. Score all published careers.
  const scored = kb.careers
    .map((c) => scoreCareer(c, profile, kb))
    .sort((a, b) => b.fitScore - a.fitScore);

  const conflicts = detectConflicts(profile);
  const completeness = computeCompleteness(profile);

  const topScore = scored[0]?.fitScore ?? 0;
  const runnerUp = scored[1]?.fitScore ?? 0;
  const overallConfidence = computeConfidence({
    completenessPct: completeness,
    topScore,
    runnerUpScore: runnerUp,
    conflictFlags: conflicts,
  });

  // 2. Build full recommendation objects for the top N.
  const top: CareerRecommendation[] = scored.slice(0, topN).map((s, idx) => {
    const courses = resolveCourses(s.career, profile, kb, opts.age);
    const skills = kb.skills
      .filter((sk) => sk.careerId === s.career.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((sk) => ({ stage: sk.stage, skillName: sk.skillName, resourceType: sk.resourceType }));

    // Per-career confidence scales overall confidence by relative position.
    const positional = 1 - idx * 0.08;
    const careerConfidence = Number((overallConfidence * Math.max(0.5, positional)).toFixed(3));

    return {
      careerId: s.career.id,
      name: s.career.name,
      domain: kb.domains.find((d) => d.id === s.career.domainId)?.name ?? s.career.domainId,
      fitScore: s.fitScore,
      confidence: careerConfidence,
      factors: s.factors,
      courses,
      skills,
      alternatives: buildAlternatives(s.career, scored.map((x) => x.career), idx),
    };
  });

  return {
    sessionId,
    kbVersion: kb.version,
    overallConfidence,
    top,
    caveats: buildCaveats(conflicts, completeness, overallConfidence),
  };
}

// Resolve courses for a career: primary first, always include a fallback.
function resolveCourses(
  career: Career,
  profile: StudentProfile,
  kb: KnowledgeBase,
  age?: number
): CourseRecommendation[] {
  const links = kb.careerCourse
    .filter((l) => l.careerId === career.id)
    .sort((a, b) => routeRank(a.routeType) - routeRank(b.routeType) || b.strength - a.strength);

  const out: CourseRecommendation[] = [];
  for (const link of links) {
    const course = kb.courses.find((c) => c.id === link.courseId);
    if (!course) continue;
    const rule = kb.eligibility.find((e) => e.courseId === course.id);
    const elig = evaluateEligibility(rule, profile, age);
    if (elig.status === "ineligible" && link.routeType !== "fallback") continue;

    const exams = kb.courseExam
      .filter((ce) => ce.courseId === course.id)
      .map((ce) => {
        const exam = kb.exams.find((e) => e.id === ce.examId);
        return { examId: ce.examId, name: exam?.name ?? ce.examId, requirement: ce.requirement, difficulty: exam?.difficulty };
      });

    out.push({
      courseId: course.id,
      name: course.name,
      routeType: link.routeType,
      eligibility: elig.status,
      eligibilityNotes: elig.notes,
      exams,
      feeBand: course.typicalFeeBand,
    });
  }
  return out;
}

function buildAlternatives(career: Career, all: Career[], idx: number) {
  // Adjacent careers = same domain, different career, ranked nearby.
  return all
    .filter((c) => c.domainId === career.domainId && c.id !== career.id)
    .slice(0, 2)
    .map((c) => ({ careerId: c.id, name: c.name, reason: `Related path in ${career.domainId.replace(/_/g, " ")}` }));
}

function buildCaveats(conflicts: ReturnType<typeof detectConflicts>, completeness: number, confidence: number): string[] {
  const caveats: string[] = [];
  if (completeness < 60) caveats.push("Profile is incomplete — answer a few more questions to improve accuracy.");
  if (confidence < 0.5) caveats.push("Confidence is moderate. Treat these as options to explore, not final decisions.");
  for (const c of conflicts) caveats.push(c.detail);
  caveats.push("These are suggestions to discuss with a counsellor and your family — not a final decision.");
  return caveats;
}

function routeRank(r: string): number {
  return { primary: 0, alternative: 1, "higher-study-route": 2, fallback: 3 }[r] ?? 9;
}
