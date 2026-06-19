// Unit tests for the accuracy-critical engine paths, using Node's built-in test
// runner (no dependency needed). Run with:  npm test
//
// Covers:
//   • profile-builder: normalize, merge (accumulate don't overwrite), derived
//     aptitude from subjects, completeness.
//   • scoring-engine: fit score clamping, renormalization over measured dims
//     only (unmeasured dims must NOT drag the score down), eligibility gating.
//   • assessment-scorer: correct/wrong aptitude scoring + interest averaging.
//
// These directly address "is it accurate?" by pinning the invariants the engine
// relies on. If any of these breaks, recommendations change silently.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProfile,
  mergeProfile,
  applyDerivedAptitude,
  computeCompleteness,
  type ProfileDelta,
} from "../profile-builder";
import { scoreCareer, evaluateEligibility, SCORING_WEIGHTS } from "../scoring-engine";
import { computeAssessmentDelta } from "../assessment-scorer";
import { emptyProfile } from "../../types/profile";
import type { StudentProfile } from "../../types/profile";
import type { KnowledgeBase, Career, CareerSignal, EligibilityRule } from "../../types/kb";

// ── profile-builder ───────────────────────────────────────────────────────────

test("normalizeProfile: fills every section for empty/null input", () => {
  const p = normalizeProfile(null);
  assert.ok(p.academic && Array.isArray(p.academic.strongSubjects));
  assert.ok(p.interests && typeof p.interests === "object");
  assert.ok(p.constraints && Array.isArray(p.constraints.familyExpectations));
});

test("mergeProfile: accumulates subjects instead of overwriting", () => {
  const afterBio = mergeProfile(null, { academic: { strongSubjects: ["Biology"] } });
  const afterChem = mergeProfile(afterBio, { academic: { strongSubjects: ["Chemistry"] } });
  assert.deepEqual(afterChem.academic.strongSubjects.sort(), ["Biology", "Chemistry"]);
});

test("mergeProfile: accumulates careerPriorities across turns", () => {
  const a = mergeProfile(null, { aspiration: { careerPriorities: ["high_salary"] } });
  const b = mergeProfile(a, { aspiration: { careerPriorities: ["job_security"] } });
  assert.deepEqual(b.aspiration.careerPriorities?.sort(), ["high_salary", "job_security"]);
});

test("applyDerivedAptitude: Maths infers numerical/logical/spatial; never lowers existing", () => {
  const p: StudentProfile = {
    ...emptyProfile(),
    academic: { ...emptyProfile().academic, strongSubjects: ["Mathematics"] },
  };
  applyDerivedAptitude(p);
  assert.ok((p.aptitude.numerical ?? 0) >= 80, "numerical should be inferred strong");
  assert.ok((p.aptitude.logical ?? 0) >= 75, "logical should be inferred");
  assert.ok((p.aptitude.spatial ?? 0) >= 65, "spatial should be inferred");
});

test("applyDerivedAptitude: observed value wins over inferred", () => {
  const p: StudentProfile = {
    ...emptyProfile(),
    academic: { ...emptyProfile().academic, strongSubjects: ["Mathematics"] },
    aptitude: { numerical: 95 }, // already observed, higher than inference
  };
  applyDerivedAptitude(p);
  assert.equal(p.aptitude.numerical, 95, "observed value must not be lowered");
});

test("computeCompleteness: returns 0..100 and is monotonic with more data", () => {
  const empty = computeCompleteness(null);
  assert.ok(empty >= 0 && empty <= 100);
  const richer = mergeProfile(null, {
    academic: { strongSubjects: ["Mathematics"], stream: "science_maths" as never, percentage: 80 },
    interests: { technology_coding: 0.8 },
    aspiration: { goalOrientation: "higher_study" },
    constraints: { budgetBand: "medium", locationPref: "india" },
  });
  assert.ok(computeCompleteness(richer) > empty, "richer profile must score higher completeness");
});

// ── scoring-engine ────────────────────────────────────────────────────────────

function makeKb(careers: Career[], signals: CareerSignal[], eligibility: EligibilityRule[]): KnowledgeBase {
  return {
    version: "test",
    domains: [],
    careers,
    courses: [],
    exams: [],
    careerCourse: [],
    courseExam: [],
    eligibility,
    signals,
    skills: [],
  };
}

const techCareer: Career = {
  id: "software_engineer", name: "Software Engineer", domainId: "computing",
  typicalRoles: [], riasecCodes: [], personalityFit: ["analytical"],
};
const medCareer: Career = {
  id: "doctor", name: "Doctor", domainId: "medical",
  typicalRoles: [], riasecCodes: [], personalityFit: ["social"],
};

const signals: CareerSignal[] = [
  { careerId: "software_engineer", signalType: "interest", signalKey: "technology_coding", weight: 1 },
  { careerId: "software_engineer", signalType: "aptitude", signalKey: "logical", weight: 1 },
  { careerId: "doctor", signalType: "interest", signalKey: "health_medicine", weight: 1 },
  { careerId: "doctor", signalType: "aptitude", signalKey: "scientific", weight: 1 },
];

test("scoreCareer: fit score is within [0,1]", () => {
  const kb = makeKb([techCareer, medCareer], signals, []);
  const profile = mergeProfile(null, { interests: { technology_coding: 0.9 }, aptitude: { logical: 90 } });
  const s = scoreCareer(techCareer, profile, kb);
  assert.ok(s.fitScore >= 0 && s.fitScore <= 1, `fitScore out of range: ${s.fitScore}`);
});

test("scoreCareer: a matching profile scores HIGHER than a mismatching one", () => {
  const kb = makeKb([techCareer, medCareer], signals, []);
  const techProfile = mergeProfile(null, {
    interests: { technology_coding: 0.9 },
    aptitude: { logical: 90 },
    academic: { strongSubjects: ["Mathematics", "Computer Science"] },
  });
  const sTech = scoreCareer(techCareer, techProfile, kb);
  const sMed = scoreCareer(medCareer, techProfile, kb);
  assert.ok(sTech.fitScore > sMed.fitScore, `expected tech > med, got ${sTech.fitScore} vs ${sMed.fitScore}`);
});

test("scoreCareer: unmeasured dimensions are excluded (not scored 0)", () => {
  // Critical invariant: an empty aptitude section must NOT cap the fit score.
  // If aptitude (weight 0.25) were scored as 0 instead of excluded, a perfect
  // interest match could never exceed ~0.75 * 0.30 / renormalized.
  const kb = makeKb([techCareer], signals, []);
  // Only interest measured, nothing else.
  const profile = mergeProfile(null, { interests: { technology_coding: 1.0 } });
  const s = scoreCareer(techCareer, profile, kb);
  // With only interest measured, a perfect interest match should yield a fit
  // score close to 1 (the interest dimension alone renormalizes to full weight).
  assert.ok(
    s.fitScore > 0.9,
    `perfect single-dimension match should be near 1.0 after renormalization, got ${s.fitScore}`
  );
});

test("evaluateEligibility: wrong stream makes a course ineligible", () => {
  const rule: EligibilityRule = {
    courseId: "c1", requiredStream: ["science_bio"], requiredSubjects: [],
    otherConstraints: [],
  };
  const profile = mergeProfile(null, { academic: { stream: "commerce" as never } });
  const e = evaluateEligibility(rule, profile);
  assert.equal(e.status, "ineligible");
});

test("evaluateEligibility: low marks => conditional, not ineligible", () => {
  const rule: EligibilityRule = {
    courseId: "c1", requiredStream: ["science_maths"], requiredSubjects: [],
    minAggregatePct: 75, otherConstraints: [],
  };
  const profile = mergeProfile(null, {
    academic: { stream: "science_maths" as never, percentage: 60 },
  });
  const e = evaluateEligibility(rule, profile);
  assert.equal(e.status, "conditional");
});

test("SCORING_WEIGHTS: interest is the highest-weighted dimension", () => {
  // Documents the design intent: interest (30%) leads, aptitude (25%) second.
  const entries = Object.entries(SCORING_WEIGHTS) as [string, number][];
  const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.equal(max[0], "interest");
});

// ── assessment-scorer ─────────────────────────────────────────────────────────

test("computeAssessmentDelta: correct aptitude answer scores 100, wrong scores 0", () => {
  // We can't import the full bank without DB wiring; test the scorer logic with
  // two responses to the same numerical item (one correct, one wrong).
  // We rely on the real ASSESSMENT_ITEMS via computeAssessmentDelta, so this also
  // validates that the bank's correct-answer marking is consistent.
  const correct = computeAssessmentDelta([{ item_id: "apt_numerical", answer: "a" }]);
  const wrong = computeAssessmentDelta([{ item_id: "apt_numerical", answer: "b" }]);
  assert.equal(correct.aptitude?.numerical, 100, "correct answer must score 100");
  assert.equal(wrong.aptitude?.numerical, 0, "wrong answer must score 0");
});

test("computeAssessmentDelta: interest signals are averaged across responses", () => {
  // Two different interest items both pointing at health_medicine should yield a
  // blended health_medicine value in (0,1].
  const d = computeAssessmentDelta([
    { item_id: "int_02", answer: "a" }, // health_medicine 0.9
    { item_id: "int_03", answer: "a" }, // health_medicine 0.9
  ]);
  const hm = d.interests?.health_medicine ?? 0;
  assert.ok(hm > 0 && hm <= 1, `health_medicine interest out of range: ${hm}`);
  assert.ok(Math.abs(hm - 0.9) < 0.01, `expected ~0.9, got ${hm}`);
});
