import type { StudentProfile, ConflictFlag } from "@/types/profile";

// ---------------------------------------------------------------------------
// Conflict detection. Surfaces tensions between what a student WANTS and what
// the signals SUPPORT. The recommendation engine uses these to lower confidence
// and surface adjacent careers — it never silently overrides the student.
// ---------------------------------------------------------------------------

export function detectConflicts(p: StudentProfile): ConflictFlag[] {
  const flags: ConflictFlag[] = [];

  // 1. High medical/health interest but weak biology / low marks.
  const healthInterest = p.interests.health_medicine ?? 0;
  const weakBio = p.academic.weakSubjects.some((s) => /bio/i.test(s));
  if (healthInterest > 0.6 && (weakBio || (p.academic.percentage ?? 100) < 60)) {
    flags.push({
      type: "interest_vs_academic",
      detail: "Strong interest in health/medicine but weak biology or low marks — consider allied-health routes.",
      severity: "high",
    });
  }

  // 2. High tech/engineering interest but low logical/numerical aptitude.
  const techInterest = (p.interests.technology_coding ?? 0) + (p.interests.building_engineering ?? 0);
  const logical = p.aptitude.logical ?? 100;
  const numerical = p.aptitude.numerical ?? 100;
  if (techInterest > 0.8 && (logical < 40 || numerical < 40)) {
    flags.push({
      type: "interest_vs_aptitude",
      detail: "Interest in tech/engineering but lower logical/numerical aptitude — recommendations weighted accordingly.",
      severity: "medium",
    });
  }

  // 3. Wants job-soon but goal aligns with long higher-study careers.
  if (p.aspiration.goalOrientation === "job_soon" && p.constraints.timeToIncomeNeed === "urgent") {
    flags.push({
      type: "time_to_income",
      detail: "Needs to earn soon — diploma and short-cycle routes prioritized over long degrees.",
      severity: "low",
    });
  }

  // 4. Budget constraint vs high-fee aspirations.
  if (p.constraints.budgetBand === "low") {
    flags.push({
      type: "budget",
      detail: "Tight budget — government-college and low-fee pathways surfaced first.",
      severity: "low",
    });
  }

  return flags;
}
