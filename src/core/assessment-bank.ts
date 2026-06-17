import type { AssessmentItem } from "@/types/assessment";

// 18-question item bank:
//   Aptitude (right/wrong, score 0 or 100):
//     4 numerical, 4 logical, 2 verbal, 2 spatial, 2 scientific
//   Personality/work-preference (no correct answer — each choice maps to signals):
//     4 personality items
//
// The answer key (signals) lives here on the server only.
// GET /api/assessment strips signals before sending to the client.
export const ASSESSMENT_ITEMS: AssessmentItem[] = [

  // ─────────────────────── NUMERICAL ABILITY (4) ────────────────────────────

  {
    id: "num_01",
    dimension: "numerical",
    questionText:
      "A shopkeeper buys an item for ₹80 and sells it for ₹100. What is the profit percentage?",
    choices: [
      { id: "a", text: "25%", signals: [{ score: 100 }] },
      { id: "b", text: "20%", signals: [{ score: 0 }] },
      { id: "c", text: "15%", signals: [{ score: 0 }] },
      { id: "d", text: "10%", signals: [{ score: 0 }] },
    ],
  },

  {
    id: "num_02",
    dimension: "numerical",
    questionText:
      "6 workers can complete a task in 10 days. How many days will 10 workers take to complete the same task?",
    choices: [
      { id: "a", text: "4 days", signals: [{ score: 0 }] },
      { id: "b", text: "6 days", signals: [{ score: 100 }] },
      { id: "c", text: "8 days", signals: [{ score: 0 }] },
      { id: "d", text: "5 days", signals: [{ score: 0 }] },
    ],
  },

  {
    id: "num_03",
    dimension: "numerical",
    questionText: "What comes next in the series?   2, 6, 12, 20, 30, __",
    choices: [
      { id: "a", text: "40", signals: [{ score: 0 }] },
      { id: "b", text: "42", signals: [{ score: 100 }] },
      { id: "c", text: "44", signals: [{ score: 0 }] },
      { id: "d", text: "36", signals: [{ score: 0 }] },
    ],
  },

  {
    id: "num_04",
    dimension: "numerical",
    questionText:
      "In a school, 120 students chose their stream: 60 chose Science, 40 chose Commerce, and 20 chose Humanities. What percentage of students chose Science?",
    choices: [
      { id: "a", text: "40%", signals: [{ score: 0 }] },
      { id: "b", text: "45%", signals: [{ score: 0 }] },
      { id: "c", text: "50%", signals: [{ score: 100 }] },
      { id: "d", text: "60%", signals: [{ score: 0 }] },
    ],
  },

  // ─────────────────────── LOGICAL REASONING (4) ────────────────────────────

  {
    id: "log_01",
    dimension: "logical",
    questionText: "In a code, MANGO is written as OCPIQ. How is GRAPE coded?",
    choices: [
      { id: "a", text: "ITCRG", signals: [{ score: 100 }] },
      { id: "b", text: "HSCRG", signals: [{ score: 0 }] },
      { id: "c", text: "ITBRF", signals: [{ score: 0 }] },
      { id: "d", text: "JUCSH", signals: [{ score: 0 }] },
    ],
  },

  {
    id: "log_02",
    dimension: "logical",
    questionText: "Pen is to Writer as Brush is to ___?",
    choices: [
      { id: "a", text: "Canvas",  signals: [{ score: 0 }] },
      { id: "b", text: "Painter", signals: [{ score: 100 }] },
      { id: "c", text: "Art",     signals: [{ score: 0 }] },
      { id: "d", text: "Colour",  signals: [{ score: 0 }] },
    ],
  },

  {
    id: "log_03",
    dimension: "logical",
    questionText:
      "All doctors are engineers. Some engineers are scientists. Which statement is DEFINITELY true?",
    choices: [
      { id: "a", text: "All doctors are scientists",  signals: [{ score: 0 }] },
      { id: "b", text: "Some engineers are doctors",  signals: [{ score: 100 }] },
      { id: "c", text: "All scientists are doctors",  signals: [{ score: 0 }] },
      { id: "d", text: "No doctor is a scientist",    signals: [{ score: 0 }] },
    ],
  },

  {
    id: "log_04",
    dimension: "logical",
    questionText:
      "Four students — Arya, Binu, Ciya, and Dinu — sit in a row. Binu sits between Ciya and Dinu. Arya is NOT next to Dinu. Who is sitting next to Arya?",
    choices: [
      { id: "a", text: "Binu",              signals: [{ score: 0 }] },
      { id: "b", text: "Ciya",              signals: [{ score: 100 }] },
      { id: "c", text: "Dinu",              signals: [{ score: 0 }] },
      { id: "d", text: "Both Binu and Dinu", signals: [{ score: 0 }] },
    ],
  },

  // ─────────────────────────── VERBAL ABILITY (2) ───────────────────────────

  {
    id: "ver_01",
    dimension: "verbal",
    questionText: "Choose the word CLOSEST in meaning to 'Meticulous':",
    choices: [
      { id: "a", text: "Careless", signals: [{ score: 0 }] },
      { id: "b", text: "Brave",    signals: [{ score: 0 }] },
      { id: "c", text: "Precise",  signals: [{ score: 100 }] },
      { id: "d", text: "Lazy",     signals: [{ score: 0 }] },
    ],
  },

  {
    id: "ver_02",
    dimension: "verbal",
    questionText:
      "Read the sentence: 'Despite the lack of resources, the young scientist produced groundbreaking results through sheer determination.' What does 'groundbreaking' mean here?",
    choices: [
      { id: "a", text: "Literally breaking the ground",  signals: [{ score: 0 }] },
      { id: "b", text: "Pioneering and highly original", signals: [{ score: 100 }] },
      { id: "c", text: "Very tiring and exhausting",     signals: [{ score: 0 }] },
      { id: "d", text: "Carefully planned in advance",   signals: [{ score: 0 }] },
    ],
  },

  // ─────────────────────── SPATIAL REASONING (2) ────────────────────────────

  {
    id: "spa_01",
    dimension: "spatial",
    questionText:
      "A square sheet of paper is folded in half, then folded in half again. A hole is punched through all layers. How many holes appear when the paper is fully unfolded?",
    choices: [
      { id: "a", text: "2", signals: [{ score: 0 }] },
      { id: "b", text: "4", signals: [{ score: 100 }] },
      { id: "c", text: "6", signals: [{ score: 0 }] },
      { id: "d", text: "8", signals: [{ score: 0 }] },
    ],
  },

  {
    id: "spa_02",
    dimension: "spatial",
    questionText:
      "A solid cube is painted red on all 6 faces and then cut into 27 equal smaller cubes. How many of the smaller cubes have exactly 2 faces painted red?",
    choices: [
      { id: "a", text: "6",  signals: [{ score: 0 }] },
      { id: "b", text: "8",  signals: [{ score: 0 }] },
      { id: "c", text: "12", signals: [{ score: 100 }] },
      { id: "d", text: "18", signals: [{ score: 0 }] },
    ],
  },

  // ───────────────────── SCIENTIFIC REASONING (2) ───────────────────────────

  {
    id: "sci_01",
    dimension: "scientific",
    questionText: "Which of the following is a PHYSICAL change?",
    choices: [
      { id: "a", text: "Burning wood",     signals: [{ score: 0 }] },
      { id: "b", text: "Melting ice",      signals: [{ score: 100 }] },
      { id: "c", text: "Rusting of iron",  signals: [{ score: 0 }] },
      { id: "d", text: "Curdling of milk", signals: [{ score: 0 }] },
    ],
  },

  {
    id: "sci_02",
    dimension: "scientific",
    questionText: "Which of the following is NOT a renewable energy source?",
    choices: [
      { id: "a", text: "Solar energy",  signals: [{ score: 0 }] },
      { id: "b", text: "Wind energy",   signals: [{ score: 0 }] },
      { id: "c", text: "Natural gas",   signals: [{ score: 100 }] },
      { id: "d", text: "Tidal energy",  signals: [{ score: 0 }] },
    ],
  },

  // ─────────────────── PERSONALITY / WORK PREFERENCE (4) ───────────────────
  // No correct answer. Each choice maps to personality traits, RIASEC, and
  // interest clusters. All signal values are positive — absence signals nothing.

  {
    id: "per_01",
    dimension: "personality",
    questionText: "You have free time after school. You would most enjoy:",
    choices: [
      {
        id: "a",
        text: "Solving a maths puzzle or logic game",
        signals: [
          { trait: "analytical", traitValue: 0.8 },
          { riasec: "investigative", riasecValue: 0.7 },
          { interest: "numbers_analysis", interestValue: 0.6 },
        ],
      },
      {
        id: "b",
        text: "Helping a friend study or work through a problem",
        signals: [
          { trait: "social", traitValue: 0.8 },
          { riasec: "social", riasecValue: 0.7 },
          { interest: "helping_teaching", interestValue: 0.6 },
        ],
      },
      {
        id: "c",
        text: "Building, fixing, or making something with your hands",
        signals: [
          { trait: "practical", traitValue: 0.8 },
          { riasec: "realistic", riasecValue: 0.7 },
          { interest: "building_engineering", interestValue: 0.6 },
        ],
      },
      {
        id: "d",
        text: "Drawing, writing, or creating something artistic",
        signals: [
          { riasec: "artistic", riasecValue: 0.7 },
          { interest: "design_visual", interestValue: 0.8 },
        ],
      },
    ],
  },

  {
    id: "per_02",
    dimension: "personality",
    questionText: "In a group project, your natural role is usually:",
    choices: [
      {
        id: "a",
        text: "The planner who organises tasks and keeps track of deadlines",
        signals: [
          { trait: "structured", traitValue: 0.8 },
          { riasec: "conventional", riasecValue: 0.6 },
        ],
      },
      {
        id: "b",
        text: "The creative one who generates ideas and designs solutions",
        signals: [
          { riasec: "artistic", riasecValue: 0.8 },
          { interest: "design_visual", interestValue: 0.7 },
        ],
      },
      {
        id: "c",
        text: "The leader who motivates the team and keeps everyone on board",
        signals: [
          { trait: "social", traitValue: 0.7 },
          { riasec: "enterprising", riasecValue: 0.8 },
          { interest: "business_money", interestValue: 0.5 },
        ],
      },
      {
        id: "d",
        text: "The analyst who researches options and finds the best approach",
        signals: [
          { trait: "analytical", traitValue: 0.8 },
          { riasec: "investigative", riasecValue: 0.7 },
        ],
      },
    ],
  },

  {
    id: "per_03",
    dimension: "personality",
    questionText: "Your ideal career would mainly involve:",
    choices: [
      {
        id: "a",
        text: "Working with data, numbers, and logical systems",
        signals: [
          { interest: "numbers_analysis", interestValue: 0.9 },
          { trait: "analytical", traitValue: 0.7 },
        ],
      },
      {
        id: "b",
        text: "Helping, supporting, or teaching other people",
        signals: [
          { interest: "helping_teaching", interestValue: 0.9 },
          { trait: "social", traitValue: 0.8 },
        ],
      },
      {
        id: "c",
        text: "Taking risks and building something of your own",
        signals: [
          { trait: "risk_taking", traitValue: 0.9 },
          { interest: "business_money", interestValue: 0.8 },
          { riasec: "enterprising", riasecValue: 0.7 },
        ],
      },
      {
        id: "d",
        text: "Discovering new knowledge through research and experiments",
        signals: [
          { interest: "science_research", interestValue: 0.9 },
          { riasec: "investigative", riasecValue: 0.8 },
        ],
      },
    ],
  },

  {
    id: "per_04",
    dimension: "personality",
    questionText:
      "If you could spend a year doing one of these roles, which sounds most like you?",
    choices: [
      {
        id: "a",
        text: "Writing news stories or creating videos that reach a large audience",
        signals: [
          { interest: "media_communication", interestValue: 0.9 },
          { riasec: "artistic", riasecValue: 0.7 },
          { trait: "social", traitValue: 0.5 },
        ],
      },
      {
        id: "b",
        text: "Protecting wildlife, forests, or working to improve agriculture and food security",
        signals: [
          { interest: "nature_agriculture", interestValue: 0.9 },
          { riasec: "realistic", riasecValue: 0.6 },
          { interest: "science_research", interestValue: 0.4 },
        ],
      },
      {
        id: "c",
        text: "Training and serving in the armed forces, police, or civil services",
        signals: [
          { interest: "defence_adventure", interestValue: 0.9 },
          { riasec: "realistic", riasecValue: 0.7 },
          { trait: "practical", traitValue: 0.6 },
        ],
      },
      {
        id: "d",
        text: "Investigating cases, protecting rights, or working in courts and law",
        signals: [
          { interest: "law_justice", interestValue: 0.9 },
          { riasec: "enterprising", riasecValue: 0.7 },
          { trait: "analytical", traitValue: 0.6 },
        ],
      },
    ],
  },
];
