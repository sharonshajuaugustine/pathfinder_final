// Human-readable labels for profile field values.
// Shared between the admin UI (_components.tsx) and the CSV export route.
// No React imports — pure data, safe to import anywhere.

export const INTEREST_LABELS: Record<string, string> = {
  technology_coding:   "Technology & Coding",
  health_medicine:     "Health & Medicine",
  business_money:      "Business & Finance",
  science_research:    "Science & Research",
  design_visual:       "Design & Visual Arts",
  helping_teaching:    "Helping & Teaching",
  law_justice:         "Law & Justice",
  building_engineering:"Engineering & Building",
  media_communication: "Media & Communication",
  nature_agriculture:  "Nature & Agriculture",
  defence_adventure:   "Defence & Adventure",
  numbers_analysis:    "Numbers & Analysis",
};

export const GOAL_LABELS: Record<string, string> = {
  job_soon:     "Get a job soon",
  higher_study: "Pursue higher studies",
  business:     "Start a business",
  government:   "Government / PSU job",
};

export const STREAM_LABELS: Record<string, string> = {
  science_bio:   "Science (Bio)",
  science_maths: "Science (Maths)",
  science_cs:    "Science (CS)",
  commerce:      "Commerce",
  humanities:    "Humanities",
};

export const FUNNEL_LABELS: Record<string, string> = {
  new:               "New",
  contacted:         "Contacted",
  counselling_booked:"Booked",
  converted:         "Converted",
  closed:            "Closed",
};

export const BUDGET_LABELS: Record<string, string> = {
  low:           "Low budget",
  medium:        "Medium budget",
  high:          "High budget",
  no_constraint: "No constraint",
};

export const LOCATION_LABELS: Record<string, string> = {
  kerala: "Kerala",
  india:  "Pan-India",
  abroad: "Open to abroad",
};

export function fmtInterest(key: string): string {
  return INTEREST_LABELS[key] ?? key.replace(/_/g, " ");
}

export function fmtGoal(key: string): string {
  return GOAL_LABELS[key] ?? key.replace(/_/g, " ");
}

export function fmtStream(key: string): string {
  return STREAM_LABELS[key] ?? key;
}

export function fmtFunnel(key: string): string {
  return FUNNEL_LABELS[key] ?? key;
}
