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
  demandWeight: number;
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
  domainId: string;
  fitScore: number;     // 0..1
  confidence: number;   // 0..1
  factors: ScoreFactor[];
  courses: CourseRecommendation[];
  skills: { stage: string; skillName: string; resourceType?: string }[];
  // adjacent / fallback careers shown as alternatives
  alternatives: { careerId: CareerId; name: string; reason: string }[];
  shortDescription?: string;
  personalInsight?: string;  // AI: why this career fits this specific student
  gapToFix?: string;         // deterministic: most impactful gap to close
  // enriched career metadata from KB
  typicalRoles?: string[];
  earningBand?: "low" | "medium" | "high" | "variable";
  jobMarketKerala?: "weak" | "moderate" | "strong";
  jobMarketIndia?: "weak" | "moderate" | "strong";
  riskLevel?: "stable" | "moderate" | "entrepreneurial";
  minYearsToEarn?: number;
  higherStudyRequired?: "none" | "preferred" | "mandatory";
}

export interface RecommendationResult {
  sessionId: string;
  kbVersion: string;
  overallConfidence: number;
  top: CareerRecommendation[];
  caveats: string[];        // low-confidence / conflict warnings
  explanation?: string;     // AI prose over the above facts (added by reviewer step)
  parentSummary?: string;   // AI: 3-sentence summary written for parents
  streamMismatch?: string;  // deterministic alert if top careers are outside student's stream
}
