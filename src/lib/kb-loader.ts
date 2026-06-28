import "server-only";
import { getServiceClient } from "@/lib/supabase/admin";
import { currentKbVersion } from "@/core/kb-version";
import type {
  KnowledgeBase, Domain, Career, Course, Exam,
  CareerCourseLink, CourseExamLink, EligibilityRule, CareerSignal, CareerSkill,
} from "@/types/kb";

// Loads the full KB snapshot from Supabase. Cached in-process for the lifetime
// of the serverless instance (KB changes are rare; bump KB_VERSION to bust).
let cache: { version: string; kb: KnowledgeBase } | null = null;

export async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  const version = currentKbVersion();
  if (process.env.NODE_ENV !== "development" && cache && cache.version === version) return cache.kb;

  const db = getServiceClient();
  const [
    domains, careers, courses, exams,
    careerCourse, courseExam, eligibility, signals, skills,
  ] = await Promise.all([
    db.from("domains").select("*"),
    db.from("careers").select("*").eq("status", "published"),
    db.from("courses").select("*").eq("status", "published"),
    db.from("exams").select("*"),
    db.from("career_course").select("*"),
    db.from("course_exam").select("*"),
    db.from("eligibility_rules").select("*"),
    db.from("career_signal").select("*"),
    db.from("career_skills").select("*"),
  ]);

  const kb: KnowledgeBase = {
    version,
    domains: (domains.data ?? []).map(mapDomain),
    careers: (careers.data ?? []).map(mapCareer),
    courses: (courses.data ?? []).map(mapCourse),
    exams: (exams.data ?? []).map(mapExam),
    careerCourse: (careerCourse.data ?? []).map(mapCareerCourse),
    courseExam: (courseExam.data ?? []).map(mapCourseExam),
    eligibility: (eligibility.data ?? []).map(mapEligibility),
    signals: (signals.data ?? []).map(mapSignal),
    skills: (skills.data ?? []).map(mapSkill),
  };

  cache = { version, kb };
  return kb;
}

// Raw DB rows are untyped (no generated Supabase types for MVP) -> map to typed entities.
/* eslint-disable */
const mapDomain = (r: any): Domain => ({ id: r.id, name: r.name, description: r.description, sortOrder: r.sort_order });
const mapCareer = (r: any): Career => ({
  id: r.id, name: r.name, domainId: r.domain_id, field: r.field, shortDescription: r.short_description,
  typicalRoles: r.typical_roles ?? [], riasecCodes: r.riasec_codes ?? [], personalityFit: r.personality_fit ?? [],
  earningBand: r.earning_band, jobMarketKerala: r.job_market_kerala, jobMarketIndia: r.job_market_india,
  higherStudyRequired: r.higher_study_required, riskLevel: r.risk_level, minYearsToEarn: r.min_years_to_earn,
});
const mapCourse = (r: any): Course => ({
  id: r.id, name: r.name, category: r.category, level: r.level, durationYears: r.duration_years,
  streamRequired: r.stream_required ?? [], coreSubjectsRequired: r.core_subjects_required ?? [],
  typicalFeeBand: r.typical_fee_band, availabilityKerala: r.availability_kerala,
  demandWeight: Number(r.demand_weight ?? 1.0),
  leadsToHigherStudy: r.leads_to_higher_study ?? [], notes: r.notes,
});
const mapExam = (r: any): Exam => ({
  id: r.id, name: r.name, scope: r.scope, conductingBody: r.conducting_body,
  eligibleStreams: r.eligible_streams ?? [], requiredSubjects: r.required_subjects ?? [],
  typicalWindow: r.typical_window, difficulty: r.difficulty,
});
const mapCareerCourse = (r: any): CareerCourseLink => ({
  careerId: r.career_id, courseId: r.course_id, routeType: r.route_type, strength: Number(r.strength), pathwayNote: r.pathway_note,
});
const mapCourseExam = (r: any): CourseExamLink => ({
  courseId: r.course_id, examId: r.exam_id, requirement: r.requirement, region: r.region,
});
const mapEligibility = (r: any): EligibilityRule => ({
  courseId: r.course_id, requiredStream: r.required_stream ?? [], requiredSubjects: r.required_subjects ?? [],
  minAggregatePct: r.min_aggregate_pct, minSubjectPct: r.min_subject_pct ?? {},
  ageMin: r.age_min, ageMax: r.age_max, otherConstraints: r.other_constraints ?? [],
});
const mapSignal = (r: any): CareerSignal => ({ careerId: r.career_id, signalType: r.signal_type, signalKey: r.signal_key, weight: Number(r.weight) });
const mapSkill = (r: any): CareerSkill => ({ careerId: r.career_id, skillName: r.skill_name, stage: r.stage, resourceType: r.resource_type, sortOrder: r.sort_order });
