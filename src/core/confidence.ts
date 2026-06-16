import { clamp } from "@/lib/utils";
import type { ConflictFlag } from "@/types/profile";

// ---------------------------------------------------------------------------
// Confidence calculator. Confidence is SEPARATE from fit score. It answers
// "how much should the student trust this ranking?" and is honestly lowered
// when the profile is thin, signals are weak, the top candidates are tied, or
// conflicts exist.
// ---------------------------------------------------------------------------

export interface ConfidenceInput {
  completenessPct: number;        // 0..100
  topScore: number;               // 0..1, best career fit score
  runnerUpScore: number;          // 0..1, second-best fit score
  conflictFlags: ConflictFlag[];
}

export function computeConfidence(input: ConfidenceInput): number {
  const completeness = clamp(input.completenessPct / 100);

  // Signal strength: how strong is the top match in absolute terms.
  const signalStrength = clamp(input.topScore);

  // Separation: a clear winner is more trustworthy than a near-tie.
  const margin = clamp((input.topScore - input.runnerUpScore) / 0.3); // 0.3 gap => full

  // Conflict penalty.
  const penalty = input.conflictFlags.reduce((acc, f) => {
    return acc + (f.severity === "high" ? 0.15 : f.severity === "medium" ? 0.08 : 0.03);
  }, 0);

  const base = 0.45 * completeness + 0.30 * signalStrength + 0.25 * margin;
  return Number(clamp(base - penalty).toFixed(3));
}
