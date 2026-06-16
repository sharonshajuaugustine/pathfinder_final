import type { CareerId, CourseId, ExamId } from "./kb";

// Eligibility verdict for a course against a profile.
export type EligibilityStatus = "eligible" | "conditional" | "ineligible";

export interface CourseRecommendation {
  courseId: CourseId;
  name: string;
  routeType: "primary" | "alternative" | "fallback" | "higher-study-route";
  eligibility: EligibilityStatus;
  eligibilityNotes: string[];
  exams: { examId: ExamId; name: string; requirement: string; difficulty?: string }[];
  feeBand?: string;
}

// A single contributing reason behind a recommendation (traceable to engine).
export interface ScoreFactor {
  dimension: "interest" | "aptitude" | "academic" | "personality" | "aspiration" | "constraint";
  label: string;       // human-readable, e.g. "Strong logical aptitude"
  contribution: number; // 0..1 normalized contribution to the fit score
}

export interface CareerRecommendation {
  careerId: CareerId;
  name: string;
  domain: string;
  fitScore: number;     // 0..1
  confidence: number;   // 0..1
  factors: ScoreFactor[];
  courses: CourseRecommendation[];
  skills: { stage: string; skillName: string; resourceType?: string }[];
  // adjacent / fallback careers shown as alternatives
  alternatives: { careerId: CareerId; name: string; reason: string }[];
}

export interface RecommendationResult {
  sessionId: string;
  kbVersion: string;
  overallConfidence: number;
  top: CareerRecommendation[];
  caveats: string[];        // low-confidence / conflict warnings
  explanation?: string;     // AI prose over the above facts (added by reviewer step)
}
