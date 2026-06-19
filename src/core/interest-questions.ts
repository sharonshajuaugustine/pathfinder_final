// ---------------------------------------------------------------------------
// Two-phase, stream-tailored interest capture.
//
// Interest is 30% of the fit score — the single highest-weighted dimension — so
// we capture it from TWO angles instead of one:
//
//   PHASE 1 — "what activities do you enjoy doing?" — concrete daily-work
//   activities. Choices are STREAM-TAILORED: a Biology student sees activities
//   realistic for the medical/bio path; a Commerce student sees business/
//   finance activities. This makes each option a realistic, answerable clue.
//
//   PHASE 2 — "what are you drawn to watching, reading, or following?" — a
//   different angle (aspiration/attention rather than action). Same cluster
//   vocabulary so the two answers REINFORCE or triangulate. This catches
//   students whose actions don't yet match their pull (e.g. a bio student who
//   loves watching startup/build videos → surfaces business_money).
//
// The two phases are NOT two separate gaps; they are two ATTEMPTS on the single
// `interest` gap (managed by the server gap state). The gap closes once a
// cluster ≥ 0.3 is captured OR both phases have run. Because the choices are
// pinned, a button click maps DIRECTLY to a profile delta — no LLM extraction,
// no hallucination, ~600ms saved per turn, and zero ambiguity.
//
// Each activity/drawn-to label maps to an interest cluster at 0.8 strength —
// strong enough to clear the 0.3 capture threshold on its own, but two answers
// on the same cluster reinforce to ~0.9+ via mergeProfile's spread merge.
// ---------------------------------------------------------------------------

import type { Stream } from "@/types/onboarding";
import type { InterestCluster } from "@/types/profile";

export type InterestPhase = "activities" | "drawnTo";

export interface InterestChoiceSet {
  phase: InterestPhase;
  question: string;
  choices: Array<{ label: string; cluster: InterestCluster }>;
}

// ── PHASE 1: stream-tailored daily-work activities ───────────────────────────
// Four realistic activities per stream, each mapping to a distinct cluster so
// the student's pick is a clean signal. Order clusters so no two adjacent
// options overlap confusingly.
const ACTIVITIES_BY_STREAM: Record<Stream, Array<{ label: string; cluster: InterestCluster }>> = {
  science_bio: [
    { label: "Caring for sick people or animals", cluster: "health_medicine" },
    { label: "Running experiments and lab work", cluster: "science_research" },
    { label: "Growing plants or working with nature", cluster: "nature_agriculture" },
    { label: "Studying how the human body or mind works", cluster: "health_medicine" },
  ],
  science_maths: [
    { label: "Solving puzzles and logical problems", cluster: "numbers_analysis" },
    { label: "Building apps or writing code", cluster: "technology_coding" },
    { label: "Understanding how machines and systems work", cluster: "building_engineering" },
    { label: "Analysing data and finding patterns", cluster: "numbers_analysis" },
  ],
  science_cs: [
    { label: "Building apps, games, or websites", cluster: "technology_coding" },
    { label: "Fixing gadgets or electronics", cluster: "building_engineering" },
    { label: "Working with data and algorithms", cluster: "numbers_analysis" },
    { label: "Designing how things look and work on screen", cluster: "design_visual" },
  ],
  commerce: [
    { label: "Running or growing a small business idea", cluster: "business_money" },
    { label: "Working with numbers, accounts, or money", cluster: "numbers_analysis" },
    { label: "Selling, marketing, or persuading people", cluster: "business_money" },
    { label: "Organising events or leading a team", cluster: "business_money" },
  ],
  humanities: [
    { label: "Teaching or helping others learn", cluster: "helping_teaching" },
    { label: "Writing, speaking, or creating content", cluster: "media_communication" },
    { label: "Debating rules, rights, or justice", cluster: "law_justice" },
    { label: "Designing, drawing, or making things look good", cluster: "design_visual" },
  ],
};

// Fallback when the stream is unknown (shouldn't normally happen — onboarding
// always seeds stream — but keeps capture robust). Cross-domain activities.
const ACTIVITIES_GENERIC: Array<{ label: string; cluster: InterestCluster }> = [
  { label: "Building apps or fixing technology", cluster: "technology_coding" },
  { label: "Caring for people or helping them", cluster: "helping_teaching" },
  { label: "Running or growing a business idea", cluster: "business_money" },
  { label: "Creating art, design, or content", cluster: "design_visual" },
];

// ── PHASE 2: what they're drawn to watching/reading (cross-domain, aspirational)
// These are deliberately NOT stream-tailored — the whole point of phase 2 is to
// surface pulls OUTSIDE the stream's obvious path. A bio student drawn to startup
// content should surface business_money even though phase 1 wouldn't offer it.
const DRAWN_TO: Array<{ label: string; cluster: InterestCluster }> = [
  { label: "Medical breakthroughs or health stories", cluster: "health_medicine" },
  { label: "New tech, AI, or coding projects", cluster: "technology_coding" },
  { label: "Startups, business, or money", cluster: "business_money" },
  { label: "Science discoveries or research", cluster: "science_research" },
  { label: "Art, design, films, or music", cluster: "design_visual" },
  { label: "Law, debates, or social justice", cluster: "law_justice" },
  { label: "Teaching, coaching, or guiding people", cluster: "helping_teaching" },
  { label: "Nature, wildlife, or farming", cluster: "nature_agriculture" },
];

const ACTIVITIES_QUESTION = "Out of these, which activity would you most enjoy doing regularly?";
const DRAWN_TO_QUESTION = "Which of these do you naturally get drawn to watching, reading, or following?";

export function activitiesForStream(stream?: Stream): InterestChoiceSet {
  const choices = (stream && ACTIVITIES_BY_STREAM[stream]) || ACTIVITIES_GENERIC;
  return { phase: "activities", question: ACTIVITIES_QUESTION, choices };
}

export function drawnToChoices(): InterestChoiceSet {
  return { phase: "drawnTo", question: DRAWN_TO_QUESTION, choices: DRAWN_TO };
}

// Build a label → cluster lookup across BOTH phases so the route's direct-delta
// mapper can resolve any pinned choice click without an LLM call. Phase-2 labels
// are global; phase-1 labels are stream-specific but all distinct strings.
export function choiceLabelToCluster(label: string): InterestCluster | null {
  for (const c of DRAWN_TO) if (c.label === label) return c.cluster;
  for (const list of Object.values(ACTIVITIES_BY_STREAM)) {
    for (const c of list) if (c.label === label) return c.cluster;
  }
  for (const c of ACTIVITIES_GENERIC) if (c.label === label) return c.cluster;
  return null;
}

// Does a given message string match any pinned interest choice label? Used by
// the route to know whether a choice click is one of OUR pinned options (and
// therefore maps directly to a delta) vs. an AI-generated free label.
export function isPinnedInterestChoice(label: string): boolean {
  return choiceLabelToCluster(label) !== null;
}
