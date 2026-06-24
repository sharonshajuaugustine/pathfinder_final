import type { ProfileDelta } from "../profile-builder";
import { INTEREST_CLUSTERS, APTITUDES } from "@/types/profile";

export type AdaptiveKind = "interest" | "aptitude" | "personality" | "context";

export interface AdaptiveOption {
  id: string;
  label: string;
}

export interface AdaptiveQuestion {
  id: string;
  text: string;
  kind: AdaptiveKind;
  signalKey?: string;
  freeText?: boolean;       // show free-text input below options?
  freeTextPlaceholder?: string; // context-aware hint for the input
  options: AdaptiveOption[];
  apply: (optionId: string) => ProfileDelta | null;
}

const INTEREST_QUESTION_DATA: Record<string, { text: string; options: { a: string; b: string; c: string } }> = {
  technology_coding: {
    text: "If you could build any digital creation this weekend, what would excite you most?",
    options: {
      a: "Designing and coding a cool mobile app, web game, or automation script",
      b: "Learning how to customize a simple website or use basic digital tools",
      c: "I'd rather do something hands-on offline or build physical things",
    },
  },
  health_medicine: {
    text: "Imagine you're in a situation where someone gets hurt or needs health advice. How do you react?",
    options: {
      a: "Calm and eager to help diagnose, treat, or care for their well-being",
      b: "Eager to help out, but I'd rather let someone else take the lead",
      c: "I'd look away or call for help; dealing with medical stuff isn't for me",
    },
  },
  business_money: {
    text: "If you and your friends were starting a fun local project or stall, which role would you claim?",
    options: {
      a: "Managing the cash flow, pricing, marketing, and running the business side",
      b: "Helping with tasks or setup, but not worrying about the profits/budget",
      c: "I just want to hang out or work on the creative side; no business for me",
    },
  },
  science_research: {
    text: "When you hear about a mystery (like a new disease outbreak or a bizarre natural phenomenon), what do you want to do?",
    options: {
      a: "Set up a hypothesis, research the data, and run tests to find the root cause",
      b: "Read a summary of the findings, but I don't need to dig into the raw science",
      c: "I'm fine just knowing it works; I don't care about the nitty-gritty details",
    },
  },
  design_visual: {
    text: "When you look at posters, website layouts, or spaces, what catches your eye?",
    options: {
      a: "I immediately analyze the colors, layouts, and think of how to make them look stunning",
      b: "I appreciate nice designs, but I don't feel a strong urge to create or tweak them",
      c: "I rarely notice design details; I care only if it functions well",
    },
  },
  helping_teaching: {
    text: "A classmate is struggling to understand a concept that you know well. What is your natural response?",
    options: {
      a: "Patiently sit down and find creative ways to explain it until they understand",
      b: "Point them to a good resource or answer a quick question, then move on",
      c: "I help briefly if I have to, but I don't really enjoy explaining things",
    },
  },
  law_justice: {
    text: "When you see an unfair rule, an argument, or a dispute, how do you tend to behave?",
    options: {
      a: "I want to study the rules, present structured arguments, and stand up for what's right",
      b: "I'd try to help resolve it peacefully, but I don't like getting into debates",
      c: "I'd stay out of it entirely; arguments and rules are exhausting",
    },
  },
  building_engineering: {
    text: "You bought a new piece of furniture or an appliance, and it needs assembly. What do you do?",
    options: {
      a: "Grab the tools and start assembling it myself, curious about how it fits together",
      b: "Follow the manual step-by-step, but only if I absolutely have to",
      c: "Hire a professional or ask someone else to do the assembly",
    },
  },
  media_communication: {
    text: "If you were asked to share a story or message with a large group of people, how would you prefer to do it?",
    options: {
      a: "Write an engaging article, record a podcast, or produce a creative video",
      b: "Share a quick social media post or talk directly, keeping it simple",
      c: "I'd hate being in the spotlight or having to write/create media content",
    },
  },
  nature_agriculture: {
    text: "How do you feel about spending a whole day working outdoors in a garden, farm, or forest?",
    options: {
      a: "I'd love it—working with soil, plants, or animals feels deeply satisfying",
      b: "I enjoy nature walks or pets, but wouldn't want to do physical outdoor labor",
      c: "I prefer staying indoors with air conditioning and screens",
    },
  },
  defence_adventure: {
    text: "What sounds like the perfect weekend adventure?",
    options: {
      a: "Treks, high-energy sports, martial arts, or physically demanding outdoor challenges",
      b: "A casual walk or playing a light game with friends",
      c: "Relaxing at home, gaming, or reading a book",
    },
  },
  numbers_analysis: {
    text: "You're handed a chaotic spreadsheet of data or a complex puzzle. What is your reaction?",
    options: {
      a: "Excited to spot the trends, sort the numbers, and solve the hidden pattern",
      b: "I'll look at the summary charts, but I'd rather not clean or calculate the raw data",
      c: "It looks like a foreign language; I'd close it immediately",
    },
  },
};

const INTEREST_VALUES: Record<string, number> = { a: 0.9, b: 0.5, c: 0.05 };
const APTITUDE_VALUES: Record<string, number> = { a: 85, b: 55, c: 25 };
const PERSONALITY_VALUES: Record<string, number> = { a: 0.8, b: 0.1, c: -0.8 };

const INTEREST_PLACEHOLDERS: Partial<Record<string, string>> = {
  technology_coding:    "e.g. I love building games or fixing devices…",
  health_medicine:      "e.g. I enjoy caring for people or working in a hospital…",
  business_money:       "e.g. I like managing money or running a small business…",
  science_research:     "e.g. I enjoy doing experiments or reading about discoveries…",
  design_visual:        "e.g. I love sketching, photography, or designing things…",
  helping_teaching:     "e.g. I enjoy tutoring friends or volunteering…",
  law_justice:          "e.g. I like debating or standing up for what's right…",
  building_engineering: "e.g. I enjoy assembling things or understanding how machines work…",
  media_communication:  "e.g. I love writing stories, making videos, or podcasting…",
  nature_agriculture:   "e.g. I enjoy gardening, working with animals, or being outdoors…",
  defence_adventure:    "e.g. I love sports, trekking, or physically challenging activities…",
  numbers_analysis:     "e.g. I enjoy solving puzzles, working with data, or spreadsheets…",
};

const interestQuestions: AdaptiveQuestion[] = INTEREST_CLUSTERS.map((key) => {
  const data = INTEREST_QUESTION_DATA[key];
  return {
    id: `int_${key}`,
    text: data?.text ?? `How much would you enjoy ${key}?`,
    kind: "interest",
    signalKey: key,
    freeText: true,
    freeTextPlaceholder: INTEREST_PLACEHOLDERS[key] ?? "Or describe your interest in your own words…",
    options: [
      { id: "a", label: data?.options.a ?? "I'd love it" },
      { id: "b", label: data?.options.b ?? "It's okay" },
      { id: "c", label: data?.options.c ?? "Not really for me" },
    ],
    apply: (opt) => {
      const v = INTEREST_VALUES[opt];
      return v == null ? null : { interests: { [key]: v } };
    },
  };
});

const APTITUDE_QUESTION_DATA: Record<string, { text: string; options: { a: string; b: string; c: string } }> = {
  numerical: {
    text: "When you need to split a restaurant bill, calculate a discount, or estimate costs on the spot:",
    options: {
      a: "I calculate it mentally in seconds with ease",
      b: "I can do it, but usually need to double check or use a calculator",
      c: "I prefer to let someone else handle any mental math",
    },
  },
  logical: {
    text: "When you face a tricky problem — like figuring out why something broke or cracking a brain teaser:",
    options: {
      a: "I enjoy breaking it down step by step until I find the answer",
      b: "I give it a go, but move on if it takes too long",
      c: "I prefer to hand it to someone else; I'd rather not deal with it",
    },
  },
  verbal: {
    text: "How easily can you write a persuasive message, read long articles, or express yourself?",
    options: {
      a: "I express myself clearly, write effortlessly, and catch grammatical details",
      b: "I get my point across fine, but writing takes some effort",
      c: "I struggle to put my thoughts into words or read long texts",
    },
  },
  spatial: {
    text: "If someone describes a route to you verbally (\"turn left at the signal, go straight, take the second right\"), what happens?",
    options: {
      a: "I instantly build a clear map in my head and could draw it out",
      b: "I follow along okay, but need to hear it again to be sure",
      c: "I get confused and would need to see it on a map or in person",
    },
  },
  scientific: {
    text: "When someone explains a complex system (like gravity, engines, or photosynthesis):",
    options: {
      a: "I quickly grasp how the parts interact and ask 'why' it works",
      b: "I understand the basics but don't wonder about the mechanics",
      c: "I find scientific explanations dry and hard to follow",
    },
  },
};

const aptitudeQuestions: AdaptiveQuestion[] = APTITUDES.map((key) => {
  const data = APTITUDE_QUESTION_DATA[key];
  return {
    id: `apt_${key}`,
    text: data?.text ?? `How good are you at ${key}?`,
    kind: "aptitude",
    signalKey: key,
    options: [
      { id: "a", label: data?.options.a ?? "Quite strong" },
      { id: "b", label: data?.options.b ?? "About average" },
      { id: "c", label: data?.options.c ?? "Not my strength" },
    ],
    apply: (opt) => {
      const v = APTITUDE_VALUES[opt];
      return v == null ? null : { aptitude: { [key]: v } };
    },
  };
});

const personalityQuestions: AdaptiveQuestion[] = [
  {
    id: "per_social",
    text: "At a social event or group project, where do you find your energy?",
    kind: "personality",
    signalKey: "social",
    options: [
      { id: "a", label: "Collaborating, talking, and bouncing ideas off people" },
      { id: "b", label: "A balance of team activities and quiet individual time" },
      { id: "c", label: "Working independently in a quiet space without distractions" },
    ],
    apply: (opt) => {
      const v = PERSONALITY_VALUES[opt];
      return v == null ? null : { personality: { social: v } };
    },
  },
  {
    id: "per_practical",
    text: "When learning something new, what style helps it click for you?",
    kind: "personality",
    signalKey: "practical",
    options: [
      { id: "a", label: "Doing it hands-on, building it, or practicing physically" },
      { id: "b", label: "A mix of reading the theory and then trying it out" },
      { id: "c", label: "Understanding the concepts, theories, and thinking it through" },
    ],
    apply: (opt) => {
      const v = PERSONALITY_VALUES[opt];
      return v == null ? null : { personality: { practical: v } };
    },
  },
  {
    id: "per_risk",
    text: "If you're planning a trip or a new project, how do you feel about the unknown?",
    kind: "personality",
    signalKey: "risk_taking",
    options: [
      { id: "a", label: "I love the thrill of taking big risks for massive rewards" },
      { id: "b", label: "I like a balanced path with some safety but room for adventure" },
      { id: "c", label: "I prefer a highly detailed, secure, and steady plan" },
    ],
    apply: (opt) => {
      const v = PERSONALITY_VALUES[opt];
      return v == null ? null : { personality: { risk_taking: v } };
    },
  },
];

// ── Context questions ──────────────────────────────────────────────────────────

const GOAL_MAP: Record<string, string> = {
  a: "higher_study", b: "job_soon", c: "business", d: "government",
};
const OPEN_STREAM_MAP: Record<string, number> = { a: 1, b: 0.5, c: 0 };
const BUDGET_MAP: Record<string, string> = { a: "no_constraint", b: "medium", c: "low" };
const LOCATION_MAP: Record<string, string> = { a: "kerala", b: "india", c: "abroad" };

// Subject → interest clusters + strong subject for derived aptitude.
const SUBJECT_MAP: Record<string, ProfileDelta> = {
  a: { interests: { health_medicine: 0.6, science_research: 0.5 },  academic: { strongSubjects: ["Biology"] } },
  b: { interests: { numbers_analysis: 0.7 },                         academic: { strongSubjects: ["Mathematics"] },    aptitude: { numerical: 70 } },
  c: { interests: { science_research: 0.6, building_engineering: 0.4 }, academic: { strongSubjects: ["Physics"] } },
  d: { interests: { technology_coding: 0.75 },                       academic: { strongSubjects: ["Computer Science"] }, aptitude: { logical: 70 } },
  e: { interests: { business_money: 0.7, numbers_analysis: 0.5 },    academic: { strongSubjects: ["Business Studies"] } },
  f: { interests: { media_communication: 0.6, law_justice: 0.5 },   academic: { strongSubjects: ["English"] } },
  g: { interests: { defence_adventure: 0.85 },                       academic: { strongSubjects: ["Physical Education"] } },
  h: { interests: { design_visual: 0.85 },                           academic: { strongSubjects: ["Fine Arts"] } },
};

// Hobbies → interest cluster. Used as fallback when direct interest Qs get no signal.
const HOBBIES_MAP: Record<string, string> = {
  a: "defence_adventure",
  b: "design_visual",
  c: "technology_coding",
  d: "helping_teaching",
  e: "media_communication",
  f: "nature_agriculture",
  g: "science_research",
  h: "business_money",
};

const contextQuestions: AdaptiveQuestion[] = [
  {
    id: "ctx_goal",
    text: "What's your main plan after Plus Two?",
    kind: "context",
    options: [
      { id: "a", label: "Study a degree" },
      { id: "b", label: "Get a job soon" },
      { id: "c", label: "Start a business" },
      { id: "d", label: "Government exams" },
    ],
    apply: (opt) => {
      const g = GOAL_MAP[opt];
      return g ? { aspiration: { goalOrientation: g as never } } : null;
    },
  },
  {
    id: "ctx_open_stream",
    text: "Are you open to careers outside your chosen stream?",
    kind: "context",
    options: [
      { id: "a", label: "Yes, I'm very open — show me anything that fits" },
      { id: "b", label: "Somewhat — if it really suits me, sure" },
      { id: "c", label: "No, I want to stay within my stream" },
    ],
    apply: (opt) => {
      const v = OPEN_STREAM_MAP[opt];
      return v == null ? null : { aspiration: { openToOutsideStream: v } };
    },
  },
  {
    // Always asked second — strongest early signal before info-gain kicks in.
    id: "ctx_subjects",
    text: "Which subject do you enjoy most or feel strongest in?",
    kind: "context",
    freeText: true,
    freeTextPlaceholder: "e.g. I love Physical Education, or I'm great at Statistics…",
    options: [
      { id: "a", label: "Biology / Life Sciences" },
      { id: "b", label: "Mathematics" },
      { id: "c", label: "Physics or Chemistry" },
      { id: "d", label: "Computer Science / IT" },
      { id: "e", label: "Business Studies / Accountancy" },
      { id: "f", label: "English, History, or Social Science" },
      { id: "g", label: "Physical Education / Sports" },
      { id: "h", label: "Fine Arts, Music, or Design" },
    ],
    apply: (opt) => SUBJECT_MAP[opt] ?? null,
  },
  {
    // Fallback — injected by the engine when 3+ interest Qs yield no signal.
    id: "ctx_hobbies",
    text: "Outside school, what do you enjoy doing most?",
    kind: "context",
    freeText: true,
    freeTextPlaceholder: "e.g. I love cooking, playing chess, or making short films…",
    options: [
      { id: "a", label: "Sports, gym, or outdoor activities" },
      { id: "b", label: "Drawing, design, music, or making art" },
      { id: "c", label: "Coding, gaming tech, or fixing devices" },
      { id: "d", label: "Helping people, volunteering, or tutoring" },
      { id: "e", label: "Writing, videos, photography, or social media" },
      { id: "f", label: "Gardening, animals, or spending time in nature" },
      { id: "g", label: "Reading, science projects, or experimenting" },
      { id: "h", label: "Business ideas, cooking, or organising events" },
    ],
    apply: (opt) => {
      const cluster = HOBBIES_MAP[opt];
      return cluster ? { interests: { [cluster]: 0.85 } } : null;
    },
  },
  {
    id: "ctx_budget",
    text: "Can your family manage private college fees if a course needs it?",
    kind: "context",
    options: [
      { id: "a", label: "Yes, that's fine" },
      { id: "b", label: "Only if reasonable" },
      { id: "c", label: "We need low-cost options" },
    ],
    apply: (opt) => {
      const b = BUDGET_MAP[opt];
      return b ? { constraints: { budgetBand: b as never } } : null;
    },
  },
  {
    id: "ctx_location",
    text: "Are you open to studying outside Kerala?",
    kind: "context",
    options: [
      { id: "a", label: "I'd prefer to stay in Kerala" },
      { id: "b", label: "Anywhere in India is fine" },
      { id: "c", label: "I'm open to abroad too" },
    ],
    apply: (opt) => {
      const l = LOCATION_MAP[opt];
      return l ? { constraints: { locationPref: l as never } } : null;
    },
  },
];

export const ADAPTIVE_QUESTIONS: AdaptiveQuestion[] = [
  ...interestQuestions,
  ...aptitudeQuestions,
  ...personalityQuestions,
  ...contextQuestions,
];

export const ADAPTIVE_BY_ID: Record<string, AdaptiveQuestion> =
  Object.fromEntries(ADAPTIVE_QUESTIONS.map((q) => [q.id, q]));

export interface AdaptiveQuestionPublic {
  id: string;
  text: string;
  options: AdaptiveOption[];
  freeText?: boolean;
  freeTextPlaceholder?: string;
}

export function toPublicQuestion(q: AdaptiveQuestion): AdaptiveQuestionPublic {
  return {
    id: q.id,
    text: q.text,
    options: q.options,
    freeText: q.freeText ?? false,
    freeTextPlaceholder: q.freeTextPlaceholder,
  };
}
