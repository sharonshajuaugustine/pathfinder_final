import type { Aptitude, InterestCluster, PersonalityTrait, Riasec } from "./profile";

// ---------------------------------------------------------------------------
// Knowledge base entity types. Mirror the SQL catalog tables.
// ---------------------------------------------------------------------------

export type DomainId = string;
export type CareerId = string;
export type CourseId = string;
export type ExamId = string;

export interface Domain {
  id: DomainId;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface Career {
  id: CareerId;
  name: string;
  domainId: DomainId;
  field?: string;
  shortDescription?: string;
  typicalRoles: string[];
  riasecCodes: Riasec[];
  personalityFit: PersonalityTrait[];
  earningBand?: "low" | "medium" | "high" | "variable";
  jobMarketKerala?: "weak" | "moderate" | "strong";
  jobMarketIndia?: "weak" | "moderate" | "strong";
  higherStudyRequired?: "none" | "preferred" | "mandatory";
  riskLevel?: "stable" | "moderate" | "entrepreneurial";
  minYearsToEarn?: number;
}

export type CourseCategory =
  | "UG-Engineering" | "UG-Medical" | "UG-Science" | "UG-Commerce" | "UG-Arts"
  | "UG-Design" | "UG-Law" | "Diploma" | "Integrated" | "Professional-Cert";

export interface Course {
  id: CourseId;
  name: string;
  category: CourseCategory;
  level: "Diploma" | "UG" | "Integrated-PG" | "Professional";
  durationYears?: number;
  streamRequired: string[];
  coreSubjectsRequired: string[];
  typicalFeeBand?: "low" | "medium" | "high" | "very-high";
  availabilityKerala?: "abundant" | "limited" | "rare";
  demandWeight: number;
  leadsToHigherStudy: CourseId[];
  notes?: string;
}

export interface Exam {
  id: ExamId;
  name: string;
  scope: "Kerala-state" | "National" | "Institute-specific";
  conductingBody?: string;
  eligibleStreams: string[];
  requiredSubjects: string[];
  typicalWindow?: string;
  difficulty?: "moderate" | "hard" | "very-hard";
}

export interface CareerCourseLink {
  careerId: CareerId;
  courseId: CourseId;
  routeType: "primary" | "alternative" | "fallback" | "higher-study-route";
  strength: number; // 0..1
  pathwayNote?: string;
}

export interface CourseExamLink {
  courseId: CourseId;
  examId: ExamId;
  requirement: "mandatory" | "one-of" | "optional" | "not-required";
  region?: "Kerala" | "National";
}

export interface EligibilityRule {
  courseId: CourseId;
  requiredStream: string[];
  requiredSubjects: string[];
  minAggregatePct?: number;
  minSubjectPct?: Record<string, number>;
  ageMin?: number;
  ageMax?: number;
  otherConstraints: string[];
}

export interface CareerSignal {
  careerId: CareerId;
  signalType: "interest" | "aptitude" | "personality";
  signalKey: InterestCluster | Aptitude | PersonalityTrait;
  weight: number; // 0..1
}

export interface CareerSkill {
  careerId: CareerId;
  skillName: string;
  stage: "foundation" | "intermediate" | "advanced";
  resourceType?: "course" | "certification" | "project" | "exam" | "self-study";
  sortOrder: number;
}

// The full in-memory KB snapshot the scoring engine reads.
export interface KnowledgeBase {
  version: string;
  domains: Domain[];
  careers: Career[];
  courses: Course[];
  exams: Exam[];
  careerCourse: CareerCourseLink[];
  courseExam: CourseExamLink[];
  eligibility: EligibilityRule[];
  signals: CareerSignal[];
  skills: CareerSkill[];
}
