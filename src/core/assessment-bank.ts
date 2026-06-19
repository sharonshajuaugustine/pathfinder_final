import type { AssessmentItem } from "@/types/assessment";

// ---------------------------------------------------------------------------
// Assessment bank — a BLEND of real aptitude tests and interest discovery.
//
// Design rationale:
//   • 5 APTITUDE questions (one per dimension: numerical, logical, verbal,
//     spatial, scientific). Each has exactly one correct answer scored 100 and
//     distractors scored 0. This gives the scoring engine DIRECT, reliable
//     aptitude signals instead of inferring them all from subjects. Aptitude is
//     25% of the fit score, so measuring it directly materially improves
//     recommendation accuracy.
//   • 5 INTEREST questions (the strongest activity/scenario-based ones). These
//     supplement chat interest capture and add personality + RIASEC signals.
//     Each choice maps to interest clusters (0..1), so the engine gets real
//     interest data even if chat capture was thin.
//
// Questions are short and written for a 16–18 year old in Kerala. Aptitude items
// are calibrated to be solvable in ~30s — they distinguish aptitude, not speed
// of complex calculation. Server-only: GET /api/assessment strips signals.
// ---------------------------------------------------------------------------

export const ASSESSMENT_ITEMS: AssessmentItem[] = [

  // ── APTITUDE: NUMERICAL ──────────────────────────────────────────────────────
  {
    id: "apt_numerical",
    dimension: "numerical",
    questionText: "A shop gives 20% off, then another 10% off the new price. What single discount is that overall?",
    choices: [
      { id: "a", text: "28%", signals: [{ score: 100 }] }, // 0.8 * 0.9 = 0.72 → 28% off (correct)
      { id: "b", text: "30%", signals: [{ score: 0 }] },   // naive add
      { id: "c", text: "32%", signals: [{ score: 0 }] },
      { id: "d", text: "26%", signals: [{ score: 0 }] },
    ],
  },

  // ── APTITUDE: LOGICAL ────────────────────────────────────────────────────────
  {
    id: "apt_logical",
    dimension: "logical",
    questionText: "If all 'Blins' are 'Frops', and some 'Frops' are 'Kazz', which MUST be true?",
    choices: [
      { id: "a", text: "Some Blins might be Kazz", signals: [{ score: 0 }] },   // 'might' — not a MUST
      { id: "b", text: "No Blin is a Kazz", signals: [{ score: 0 }] },
      { id: "c", text: "None of these must be true", signals: [{ score: 100 }] }, // overlap need not include Blins
      { id: "d", text: "All Frops are Blins", signals: [{ score: 0 }] },
    ],
  },

  // ── APTITUDE: VERBAL ─────────────────────────────────────────────────────────
  {
    id: "apt_verbal",
    dimension: "verbal",
    questionText: "Pick the word most nearly OPPOSITE in meaning to 'TRANSPARENT' (as in a transparent excuse).",
    choices: [
      { id: "a", text: "Deceptive", signals: [{ score: 100 }] }, // correct antonym in this sense
      { id: "b", text: "Clear", signals: [{ score: 0 }] },
      { id: "c", text: "Visible", signals: [{ score: 0 }] },
      { id: "d", text: "Honest", signals: [{ score: 0 }] },
    ],
  },

  // ── APTITUDE: SPATIAL ────────────────────────────────────────────────────────
  {
    id: "apt_spatial",
    dimension: "spatial",
    questionText: "A square paper is folded once in half, then a small triangle is cut from one corner of the folded edge. Unfolded, how many triangular holes appear?",
    choices: [
      { id: "a", text: "1", signals: [{ score: 0 }] },
      { id: "b", text: "2", signals: [{ score: 100 }] }, // symmetric across the fold → 2 holes
      { id: "c", text: "3", signals: [{ score: 0 }] },
      { id: "d", text: "4", signals: [{ score: 0 }] },
    ],
  },

  // ── APTITUDE: SCIENTIFIC ─────────────────────────────────────────────────────
  {
    id: "apt_scientific",
    dimension: "scientific",
    questionText: "A metal ball and a feather are dropped inside a sealed tube with all air removed. What happens?",
    choices: [
      { id: "a", text: "The ball hits the bottom first", signals: [{ score: 0 }] },
      { id: "b", text: "The feather hits the bottom first", signals: [{ score: 0 }] },
      { id: "c", text: "They hit the bottom at the same time", signals: [{ score: 100 }] }, // no air resistance
      { id: "d", text: "The feather floats and never falls", signals: [{ score: 0 }] },
    ],
  },

  // ── INTEREST: activity scenarios (also yield personality + RIASEC) ───────────

  {
    id: "int_01",
    dimension: "personality",
    questionText: "After a long school day, which would help you relax AND feel productive?",
    choices: [
      {
        id: "a",
        text: "Helping a neighbour or family member with something they're struggling with",
        signals: [
          { interest: "helping_teaching", interestValue: 0.7 },
          { interest: "health_medicine", interestValue: 0.4 },
          { trait: "social", traitValue: 0.8 },
        ],
      },
      {
        id: "b",
        text: "Tinkering with a gadget, app, or something broken that needs fixing",
        signals: [
          { interest: "technology_coding", interestValue: 0.7 },
          { interest: "building_engineering", interestValue: 0.5 },
          { trait: "analytical", traitValue: 0.6 },
          { trait: "practical", traitValue: 0.5 },
        ],
      },
      {
        id: "c",
        text: "Drawing, writing, cooking, or making something creative",
        signals: [
          { interest: "design_visual", interestValue: 0.7 },
          { interest: "media_communication", interestValue: 0.5 },
          { riasec: "artistic", riasecValue: 0.8 },
        ],
      },
      {
        id: "d",
        text: "Reading about how the world works — science, money, news, or nature",
        signals: [
          { interest: "science_research", interestValue: 0.5 },
          { interest: "business_money", interestValue: 0.4 },
          { interest: "nature_agriculture", interestValue: 0.3 },
          { trait: "analytical", traitValue: 0.6 },
        ],
      },
    ],
  },

  {
    id: "int_02",
    dimension: "personality",
    questionText: "A close friend needs help urgently. In which situation do you feel most useful?",
    choices: [
      {
        id: "a",
        text: "They're unwell — you take care of them and try to figure out what's wrong",
        signals: [
          { interest: "health_medicine", interestValue: 0.9 },
          { trait: "social", traitValue: 0.7 },
        ],
      },
      {
        id: "b",
        text: "Their device is broken and they need it working by tomorrow",
        signals: [
          { interest: "technology_coding", interestValue: 0.8 },
          { interest: "building_engineering", interestValue: 0.4 },
          { trait: "analytical", traitValue: 0.7 },
        ],
      },
      {
        id: "c",
        text: "They're stressed and need someone to listen, guide, and help them think clearly",
        signals: [
          { interest: "helping_teaching", interestValue: 0.8 },
          { interest: "law_justice", interestValue: 0.4 },
          { trait: "social", traitValue: 0.9 },
        ],
      },
      {
        id: "d",
        text: "They need an event organised — budget, tasks, and people managed",
        signals: [
          { interest: "business_money", interestValue: 0.8 },
          { trait: "structured", traitValue: 0.7 },
          { riasec: "enterprising", riasecValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "int_03",
    dimension: "personality",
    questionText: "You have ₹10,000 to spend on learning something new. What do you choose?",
    choices: [
      {
        id: "a",
        text: "A first-aid, nutrition, or healthcare short course",
        signals: [
          { interest: "health_medicine", interestValue: 0.9 },
          { interest: "science_research", interestValue: 0.3 },
        ],
      },
      {
        id: "b",
        text: "A coding, digital skills, or electronics workshop",
        signals: [
          { interest: "technology_coding", interestValue: 0.9 },
          { trait: "analytical", traitValue: 0.5 },
        ],
      },
      {
        id: "c",
        text: "An art, photography, music, or creative writing class",
        signals: [
          { interest: "design_visual", interestValue: 0.8 },
          { interest: "media_communication", interestValue: 0.5 },
          { riasec: "artistic", riasecValue: 0.8 },
        ],
      },
      {
        id: "d",
        text: "A business, investing, or public speaking course",
        signals: [
          { interest: "business_money", interestValue: 0.8 },
          { interest: "numbers_analysis", interestValue: 0.4 },
          { riasec: "enterprising", riasecValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "int_04",
    dimension: "personality",
    questionText: "Which person's real-life story would you most enjoy reading about?",
    choices: [
      {
        id: "a",
        text: "Someone who saved hundreds of lives working in difficult conditions",
        signals: [
          { interest: "health_medicine", interestValue: 0.8 },
          { interest: "defence_adventure", interestValue: 0.3 },
          { trait: "social", traitValue: 0.7 },
        ],
      },
      {
        id: "b",
        text: "A scientist whose discovery completely changed how we understand the world",
        signals: [
          { interest: "science_research", interestValue: 0.9 },
          { trait: "analytical", traitValue: 0.7 },
          { riasec: "investigative", riasecValue: 0.8 },
        ],
      },
      {
        id: "c",
        text: "An artist, filmmaker, or writer whose work moved millions of people",
        signals: [
          { interest: "media_communication", interestValue: 0.7 },
          { interest: "design_visual", interestValue: 0.7 },
          { riasec: "artistic", riasecValue: 0.8 },
        ],
      },
      {
        id: "d",
        text: "Someone who built a company from nothing and created thousands of jobs",
        signals: [
          { interest: "business_money", interestValue: 0.9 },
          { trait: "risk_taking", traitValue: 0.8 },
          { riasec: "enterprising", riasecValue: 0.8 },
        ],
      },
    ],
  },

  {
    id: "int_05",
    dimension: "personality",
    questionText: "If you volunteered for a community project, which would feel most meaningful?",
    choices: [
      {
        id: "a",
        text: "Teaching children in an underserved school or tutoring for free",
        signals: [
          { interest: "helping_teaching", interestValue: 0.9 },
          { trait: "social", traitValue: 0.8 },
        ],
      },
      {
        id: "b",
        text: "Setting up a computer lab or fixing digital tools for a local NGO",
        signals: [
          { interest: "technology_coding", interestValue: 0.8 },
          { interest: "helping_teaching", interestValue: 0.3 },
        ],
      },
      {
        id: "c",
        text: "Creating posters, videos, or a campaign to raise awareness",
        signals: [
          { interest: "design_visual", interestValue: 0.6 },
          { interest: "media_communication", interestValue: 0.7 },
          { riasec: "artistic", riasecValue: 0.6 },
        ],
      },
      {
        id: "d",
        text: "Planting trees, cleaning rivers, or protecting animals in the wild",
        signals: [
          { interest: "nature_agriculture", interestValue: 0.9 },
          { trait: "practical", traitValue: 0.5 },
        ],
      },
    ],
  },

];
