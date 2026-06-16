import { ASSESSMENT_ITEMS } from "./assessment-bank";
import type { ProfileDelta } from "./profile-builder";
import type { Aptitude, PersonalityTrait, InterestCluster, Riasec } from "@/types/profile";
import { APTITUDES } from "@/types/profile";

interface StoredResponse {
  item_id: string;
  answer: string; // choiceId ('a'|'b'|'c'|'d')
}

// Recompute the full profile delta implied by all assessment responses collected
// so far. Called after each answer so the profile stays current. Overwrites aptitude
// (more reliable than chat extraction) and supplements personality/interests.
export function computeAssessmentDelta(responses: StoredResponse[]): ProfileDelta {
  const aptitudeAccum: Partial<Record<Aptitude, number[]>> = {};
  const personalityAccum: Partial<Record<PersonalityTrait, number[]>> = {};
  const interestAccum: Partial<Record<InterestCluster, number[]>> = {};
  const riasecAccum: Partial<Record<Riasec, number[]>> = {};

  for (const resp of responses) {
    const item = ASSESSMENT_ITEMS.find((i) => i.id === resp.item_id);
    if (!item) continue;
    const choice = item.choices.find((c) => c.id === resp.answer);
    if (!choice) continue;

    for (const sig of choice.signals) {
      // Aptitude score (0 or 100) on aptitude-dimension items.
      if (sig.score !== undefined && APTITUDES.includes(item.dimension as Aptitude)) {
        const dim = item.dimension as Aptitude;
        (aptitudeAccum[dim] ??= []).push(sig.score);
      }

      // Personality trait signal.
      if (sig.trait !== undefined && sig.traitValue !== undefined) {
        (personalityAccum[sig.trait] ??= []).push(sig.traitValue);
      }

      // Interest cluster signal.
      if (sig.interest !== undefined && sig.interestValue !== undefined) {
        (interestAccum[sig.interest] ??= []).push(sig.interestValue);
      }

      // RIASEC signal.
      if (sig.riasec !== undefined && sig.riasecValue !== undefined) {
        (riasecAccum[sig.riasec] ??= []).push(sig.riasecValue);
      }
    }
  }

  const delta: ProfileDelta = {};

  // Aptitude: average score per dimension (0–100).
  const aptitude: Partial<Record<Aptitude, number>> = {};
  for (const dim of APTITUDES) {
    const vals = aptitudeAccum[dim];
    if (vals?.length) aptitude[dim] = avg(vals);
  }
  if (Object.keys(aptitude).length) delta.aptitude = aptitude;

  // Personality: average trait value per trait (-1..1, all positive from MCQ).
  const personality: Partial<Record<PersonalityTrait, number>> = {};
  for (const [trait, vals] of Object.entries(personalityAccum) as [PersonalityTrait, number[]][]) {
    if (vals.length) personality[trait] = avg(vals);
  }
  if (Object.keys(personality).length) delta.personality = personality;

  // Interests from personality questions (supplement chat extraction).
  const interests: Partial<Record<InterestCluster, number>> = {};
  for (const [cluster, vals] of Object.entries(interestAccum) as [InterestCluster, number[]][]) {
    if (vals.length) interests[cluster] = avg(vals);
  }
  if (Object.keys(interests).length) delta.interests = interests;

  // RIASEC from personality questions.
  const riasec: Partial<Record<Riasec, number>> = {};
  for (const [r, vals] of Object.entries(riasecAccum) as [Riasec, number[]][]) {
    if (vals.length) riasec[r] = avg(vals);
  }
  if (Object.keys(riasec).length) delta.riasec = riasec;

  return delta;
}

function avg(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
