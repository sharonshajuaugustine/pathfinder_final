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
  freeText?: boolean;
  freeTextPlaceholder?: string;
  multiSelect?: boolean;    // student can pick multiple options; each is applied in turn
  whyWeAsk?: string;        // shown as a subtle hint so students understand the purpose
  options: AdaptiveOption[];
  apply: (optionId: string) => ProfileDelta | null;
}

const INTEREST_QUESTION_DATA: Record<string, { text: string; options: { a: string; b: string; c: string } }> = {
  technology_coding: {
    text: "How do you feel about building apps, websites, or writing code?",
    options: {
      a: "I love it — building digital things really excites me",
      b: "It's okay, I can manage basic tools but it's not my passion",
      c: "Not for me — I'd rather do something hands-on or offline",
    },
  },
  health_medicine: {
    text: "When you picture yourself working in healthcare, what feels true?",
    options: {
      a: "I'd love it — caring for patients and being in a clinical environment feels meaningful",
      b: "I'm more drawn to the science or research side than direct patient care",
      c: "Not really my path — I'd rather work in a different field entirely",
    },
  },
  business_money: {
    text: "If you and friends were running a small stall or project, which role fits you best?",
    options: {
      a: "Managing the money, pricing, marketing — the business side",
      b: "Helping with tasks, but not worried about profits",
      c: "I'd rather just do the creative or fun parts, not the business",
    },
  },
  science_research: {
    text: "When you hear about a scientific mystery or new discovery, what do you want to do?",
    options: {
      a: "Dig into the data, form a hypothesis, figure out why it works",
      b: "Read the summary — interesting, but I don't need the details",
      c: "I'm fine not knowing; science details don't interest me",
    },
  },
  design_visual: {
    text: "When you see a poster, room layout, or website design, what do you notice?",
    options: {
      a: "I immediately think about colours, composition, and how to improve it",
      b: "I appreciate good design but don't feel the urge to create",
      c: "I rarely notice — I only care if something works",
    },
  },
  helping_teaching: {
    text: "A friend struggles with a topic you understand well. What do you do?",
    options: {
      a: "I sit with them and patiently explain until they get it",
      b: "I give a quick answer or point them to a resource, then move on",
      c: "I'd help if I had to, but explaining things isn't really my thing",
    },
  },
  law_justice: {
    text: "When you see an unfair rule or a dispute, what's your instinct?",
    options: {
      a: "Study the rules, build an argument, and stand up for what's right",
      b: "Try to settle things peacefully, but avoid debates",
      c: "Stay out of it — arguments and rules drain me",
    },
  },
  building_engineering: {
    text: "A new appliance arrives and needs assembling. What do you do?",
    options: {
      a: "Grab the tools and start — I'm curious about how it all fits together",
      b: "Follow the manual step by step, but only if I have to",
      c: "Call someone else — I'd rather not deal with it",
    },
  },
  media_communication: {
    text: "If you had to share a message with a large audience, how would you do it?",
    options: {
      a: "Write an article, record a video, or make a podcast — I enjoy creating content",
      b: "Post something quick on social media or just talk to them directly",
      c: "I'd avoid it — being in the spotlight or creating content isn't for me",
    },
  },
  nature_agriculture: {
    text: "How do you feel about spending a day working outdoors on a farm or in nature?",
    options: {
      a: "I'd love it — working with plants, animals, or soil is satisfying",
      b: "I enjoy nature as a hobby but wouldn't want it as work",
      c: "I prefer indoors — outdoor physical work isn't for me",
    },
  },
  defence_adventure: {
    text: "Which type of career environment appeals to you most?",
    options: {
      a: "Physically demanding, high-discipline roles — army, police, sports, or emergency services",
      b: "Active but less intense — coaching, adventure tourism, or outdoor fieldwork",
      c: "I prefer a desk-based or less physically demanding career",
    },
  },
  numbers_analysis: {
    text: "Someone hands you a messy table of numbers or a logic puzzle. Your reaction?",
    options: {
      a: "Excited — I want to find the pattern and solve it",
      b: "I'll glance at the summary, but won't dig into the raw numbers",
      c: "I'd close it — numbers and data aren't my thing",
    },
  },
};

// b = 0.3 (mild interest), not 0.5 — prevents "okay" answers from inflating all clusters equally
// x = "not sure" → apply() returns null → cluster stays at default; isStuck() handles fallback
const INTEREST_VALUES: Record<string, number> = { a: 0.9, b: 0.3, c: 0.05 };
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
    // No freeText on interest questions — MCQ-only keeps the flow clean and
    // avoids confusing students into thinking they must type something.
    options: [
      { id: "a", label: data?.options.a ?? "I'd love it" },
      { id: "b", label: data?.options.b ?? "Sort of — it's okay but not my first choice" },
      { id: "c", label: data?.options.c ?? "Not really for me" },
      { id: "x", label: "I'm honestly not sure" },
    ],
    apply: (opt) => {
      if (opt === "x") return null; // neutral — leave cluster at default, isStuck() handles fallback
      const v = INTEREST_VALUES[opt];
      return v == null ? null : { interests: { [key]: v } };
    },
  };
});

const APTITUDE_QUESTION_DATA: Record<string, { text: string; options: { a: string; b: string; c: string } }> = {
  numerical: {
    text: "Splitting a bill or calculating a discount in your head — how does that feel?",
    options: {
      a: "Easy — I do it in seconds without thinking",
      b: "I can manage, but I usually double-check with a calculator",
      c: "I'd rather let someone else handle the numbers",
    },
  },
  logical: {
    text: "When something breaks or you hit a tricky puzzle, what do you do?",
    options: {
      a: "I enjoy breaking it down step by step until I find the answer",
      b: "I give it a try, but move on if it takes too long",
      c: "I'd rather hand it to someone else",
    },
  },
  verbal: {
    text: "How comfortable are you writing a message, reading long passages, or expressing ideas?",
    options: {
      a: "Very comfortable — I write clearly and express myself well",
      b: "Fine enough, but writing does take me some effort",
      c: "I struggle to put thoughts into words or read long texts",
    },
  },
  spatial: {
    text: "Someone gives you directions verbally — left at the signal, then second right. What happens?",
    options: {
      a: "I picture it instantly and could sketch the route",
      b: "I follow along okay, but need to hear it again to be sure",
      c: "I get confused — I need a map or to see it in person",
    },
  },
  scientific: {
    text: "When someone explains how something works — like an engine or a plant's growth — what do you do?",
    options: {
      a: "I grasp it quickly and want to know why it works that way",
      b: "I get the basic idea but don't wonder about the details",
      c: "I find these explanations hard to follow",
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
    text: "In a group project or social situation, where do you naturally fit?",
    kind: "personality",
    signalKey: "social",
    whyWeAsk: "This tells us whether people-facing roles or independent focused work suits you better.",
    options: [
      { id: "a", label: "Taking charge, talking, bouncing ideas — I'm energised by people" },
      { id: "b", label: "I can do both — team time and quiet solo work" },
      { id: "c", label: "I do my best work alone in a quiet space" },
    ],
    apply: (opt) => {
      const v = PERSONALITY_VALUES[opt];
      return v == null ? null : { personality: { social: v } };
    },
  },
  {
    id: "per_practical",
    text: "When you learn something new, what works best for you?",
    kind: "personality",
    signalKey: "practical",
    whyWeAsk: "This helps us separate hands-on practical careers from desk-based thinking roles.",
    options: [
      { id: "a", label: "Doing it — hands-on, building, or practising in real life" },
      { id: "b", label: "A mix — some theory, then trying it out" },
      { id: "c", label: "Understanding concepts and thinking it through first" },
    ],
    apply: (opt) => {
      const v = PERSONALITY_VALUES[opt];
      return v == null ? null : { personality: { practical: v } };
    },
  },
  {
    id: "per_risk",
    text: "When starting something new with uncertain outcomes, how do you feel?",
    kind: "personality",
    signalKey: "risk_taking",
    whyWeAsk: "This helps us gauge your fit for entrepreneurial paths vs stable, structured careers.",
    options: [
      { id: "a", label: "Excited — I like taking big bets for big rewards" },
      { id: "b", label: "Open to some risk, but I want a safety net" },
      { id: "c", label: "I prefer a clear, stable, well-planned path" },
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
const BUDGET_MAP: Record<string, string> = { a: "no_constraint", b: "medium", c: "low" };
const LOCATION_MAP: Record<string, string> = { a: "kerala", b: "india", c: "gulf", d: "abroad" };

const STREAM_MAP: Record<string, ProfileDelta> = {
  a: { academic: { stream: "science_bio" as never } },
  b: { academic: { stream: "science_maths" as never } },
  c: { academic: { stream: "commerce" as never } },
  d: { academic: { stream: "humanities" as never } },
  e: {}, // vocational — no formal stream, subjects question will add strongSubjects
};

// Per-stream subject → interest clusters + strong subject for derived aptitude.
const SUBJECTS_BIO: Record<string, ProfileDelta> = {
  a: { interests: { health_medicine: 0.6, science_research: 0.5 }, academic: { strongSubjects: ["Biology"] } },
  b: { interests: { science_research: 0.6, health_medicine: 0.3 }, academic: { strongSubjects: ["Chemistry"] } },
  c: { interests: { science_research: 0.5, building_engineering: 0.4 }, academic: { strongSubjects: ["Physics"] } },
  d: { interests: { numbers_analysis: 0.7 }, academic: { strongSubjects: ["Mathematics"] }, aptitude: { numerical: 70 } },
  e: { interests: { technology_coding: 0.75 }, academic: { strongSubjects: ["Computer Science"] }, aptitude: { logical: 70 } },
};

const SUBJECTS_MATHS: Record<string, ProfileDelta> = {
  a: { interests: { numbers_analysis: 0.7 }, academic: { strongSubjects: ["Mathematics"] }, aptitude: { numerical: 70 } },
  b: { interests: { science_research: 0.5, building_engineering: 0.5 }, academic: { strongSubjects: ["Physics"] } },
  c: { interests: { science_research: 0.6 }, academic: { strongSubjects: ["Chemistry"] } },
  d: { interests: { technology_coding: 0.75 }, academic: { strongSubjects: ["Computer Science"] }, aptitude: { logical: 70 } },
  e: { interests: { health_medicine: 0.5, science_research: 0.4 }, academic: { strongSubjects: ["Biology"] } },
};

const SUBJECTS_COMMERCE: Record<string, ProfileDelta> = {
  a: { interests: { business_money: 0.7, numbers_analysis: 0.4 }, academic: { strongSubjects: ["Business Studies"] } },
  b: { interests: { numbers_analysis: 0.7 }, academic: { strongSubjects: ["Accountancy"] }, aptitude: { numerical: 80 } },
  c: { interests: { numbers_analysis: 0.5, law_justice: 0.3 }, academic: { strongSubjects: ["Economics"] } },
  d: { interests: { numbers_analysis: 0.7 }, academic: { strongSubjects: ["Mathematics"] }, aptitude: { numerical: 70 } },
  e: { interests: { technology_coding: 0.75 }, academic: { strongSubjects: ["Computer Science"] }, aptitude: { logical: 70 } },
};

const SUBJECTS_HUMANITIES: Record<string, ProfileDelta> = {
  a: { interests: { media_communication: 0.6, law_justice: 0.4 }, academic: { strongSubjects: ["English"] }, aptitude: { verbal: 80 } },
  b: { interests: { law_justice: 0.5, media_communication: 0.3 }, academic: { strongSubjects: ["History"] } },
  c: { interests: { nature_agriculture: 0.4, science_research: 0.3 }, academic: { strongSubjects: ["Geography"] } },
  d: { interests: { helping_teaching: 0.6, science_research: 0.3 }, academic: { strongSubjects: ["Psychology"] } },
  e: { interests: { media_communication: 0.4 }, academic: { strongSubjects: ["Malayalam"] }, aptitude: { verbal: 70 } },
};

const SUBJECTS_VOCATIONAL: Record<string, ProfileDelta> = {
  a: { interests: { building_engineering: 0.7, technology_coding: 0.3 }, academic: { strongSubjects: ["Electronics"] } },
  b: { interests: { building_engineering: 0.8 }, academic: { strongSubjects: ["Mechanical"] } },
  c: { interests: { design_visual: 0.7, helping_teaching: 0.3 }, academic: { strongSubjects: ["Beauty"] } },
  d: { interests: { health_medicine: 0.7 }, academic: { strongSubjects: ["Healthcare"] } },
  e: { interests: { helping_teaching: 0.5, business_money: 0.4 }, academic: { strongSubjects: ["Hospitality"] } },
};

// Hobbies → interest cluster. Fallback when 3+ interest Qs yield no signal.
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
    whyWeAsk: "Your timeline shapes everything — short-term job paths and long-term degree paths are very different.",
    options: [
      { id: "a", label: "Study a degree or diploma" },
      { id: "b", label: "Get a job as soon as possible" },
      { id: "c", label: "Start my own business / family business" },
      { id: "d", label: "Prepare for government / PSC exams" },
      { id: "e", label: "Not sure yet — show me all options" },
    ],
    apply: (opt) => {
      const g = GOAL_MAP[opt];
      return g ? { aspiration: { goalOrientation: g as never } } : null; // 'e' → null → neutral 0.5 score
    },
  },
  {
    id: "ctx_stream",
    text: "Which stream are you studying in Plus Two?",
    kind: "context",
    options: [
      { id: "a", label: "Science — Biology group (PCB / PCMB)" },
      { id: "b", label: "Science — Maths group (PCM / PCMC)" },
      { id: "c", label: "Commerce (Business Studies, Accountancy, Economics)" },
      { id: "d", label: "Humanities / Arts (English, History, Social Science)" },
      { id: "e", label: "Vocational / ITI / Open School" },
    ],
    apply: (opt) => STREAM_MAP[opt] ?? null,
  },
  {
    id: "ctx_subjects_bio",
    text: "Which subjects do you enjoy or do best in? Pick all that apply.",
    kind: "context",
    multiSelect: true,
    options: [
      { id: "a", label: "Biology" },
      { id: "b", label: "Chemistry" },
      { id: "c", label: "Physics" },
      { id: "d", label: "Mathematics" },
      { id: "e", label: "Computer Science" },
    ],
    apply: (opt) => SUBJECTS_BIO[opt] ?? null,
  },
  {
    id: "ctx_subjects_maths",
    text: "Which subjects do you enjoy or do best in? Pick all that apply.",
    kind: "context",
    multiSelect: true,
    options: [
      { id: "a", label: "Mathematics" },
      { id: "b", label: "Physics" },
      { id: "c", label: "Chemistry" },
      { id: "d", label: "Computer Science" },
      { id: "e", label: "Biology" },
    ],
    apply: (opt) => SUBJECTS_MATHS[opt] ?? null,
  },
  {
    id: "ctx_subjects_commerce",
    text: "Which subjects do you enjoy or do best in? Pick all that apply.",
    kind: "context",
    multiSelect: true,
    options: [
      { id: "a", label: "Business Studies" },
      { id: "b", label: "Accountancy" },
      { id: "c", label: "Economics" },
      { id: "d", label: "Mathematics" },
      { id: "e", label: "Computer Science" },
    ],
    apply: (opt) => SUBJECTS_COMMERCE[opt] ?? null,
  },
  {
    id: "ctx_subjects_humanities",
    text: "Which subjects do you enjoy or do best in? Pick all that apply.",
    kind: "context",
    multiSelect: true,
    options: [
      { id: "a", label: "English / Literature" },
      { id: "b", label: "History / Political Science" },
      { id: "c", label: "Geography" },
      { id: "d", label: "Psychology / Sociology" },
      { id: "e", label: "Malayalam / Hindi / Second Language" },
    ],
    apply: (opt) => SUBJECTS_HUMANITIES[opt] ?? null,
  },
  {
    id: "ctx_subjects_vocational",
    text: "Which area is your vocational / ITI course in? Pick all that apply.",
    kind: "context",
    multiSelect: true,
    options: [
      { id: "a", label: "Electronics / Electrical" },
      { id: "b", label: "Mechanical / Automobile" },
      { id: "c", label: "Beauty & Wellness / Fashion / Tailoring" },
      { id: "d", label: "Healthcare / Lab Technician" },
      { id: "e", label: "Hospitality / Catering / Tourism" },
    ],
    apply: (opt) => SUBJECTS_VOCATIONAL[opt] ?? null,
  },
  {
    // Fallback — injected by the engine when 3+ interest Qs yield no signal.
    id: "ctx_hobbies",
    text: "Outside school, what do you enjoy doing most?",
    kind: "context",
    whyWeAsk: "What you do for fun often points directly to the right career — it's a strong signal we don't want to miss.",
    freeText: true,
    freeTextPlaceholder: "e.g. I love cooking, playing chess, or making short films…",
    options: [
      { id: "a", label: "Sports, gym, or outdoor activities" },
      { id: "b", label: "Drawing, design, music, or making art" },
      { id: "c", label: "Coding, gaming, or fixing tech devices" },
      { id: "d", label: "Helping people, volunteering, or tutoring" },
      { id: "e", label: "Writing, videos, photography, or social media" },
      { id: "f", label: "Gardening, animals, or spending time in nature" },
      { id: "g", label: "Reading, science projects, or experimenting" },
      { id: "h", label: "Business ideas, events, or organising things" },
    ],
    apply: (opt) => {
      const cluster = HOBBIES_MAP[opt];
      return cluster ? { interests: { [cluster]: 0.85 } } : null;
    },
  },
  {
    id: "ctx_budget",
    text: "Can your family manage private college fees if needed?",
    kind: "context",
    whyWeAsk: "We use this to filter courses and highlight government seats and scholarship-friendly options.",
    options: [
      { id: "a", label: "Yes — fees aren't a concern" },
      { id: "b", label: "Up to around ₹1 lakh per year is okay" },
      { id: "c", label: "We need very low-cost or government college options" },
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
    whyWeAsk: "This helps us show courses that are actually reachable for you.",
    options: [
      { id: "a", label: "I'd prefer to stay in Kerala" },
      { id: "b", label: "Anywhere in India is fine" },
      { id: "c", label: "Gulf / Middle East is an option for me" },
      { id: "d", label: "Open to anywhere including abroad" },
    ],
    apply: (opt) => {
      const l = LOCATION_MAP[opt];
      return l ? { constraints: { locationPref: l as never } } : null;
    },
  },
];

// ── Domain drill questions ─────────────────────────────────────────────────────
// Fired by the engine (once) when a parent interest cluster is confirmed ≥ 0.7.
// Each drill narrows within the domain so the engine can separate closely-related
// careers (e.g. marketing_manager vs accountant vs event_manager).

const drillQuestions: AdaptiveQuestion[] = [
  {
    id: "int_business_drill",
    text: "You enjoy the business side — which part appeals to you most?",
    kind: "interest",
    options: [
      { id: "a", label: "Sales, marketing, or building a brand" },
      { id: "b", label: "Finance, investments, or managing money" },
      { id: "c", label: "Running operations and managing teams" },
      { id: "d", label: "Starting something new / entrepreneurship" },
    ],
    apply: (opt) => {
      if (opt === "a") return { interests: { media_communication: 0.7 }, aspiration: { careerPriorities: ["sales"] } };
      if (opt === "b") return { interests: { numbers_analysis: 0.75 }, aptitude: { numerical: 75 } };
      if (opt === "c") return { interests: { helping_teaching: 0.6 } };
      if (opt === "d") return { personality: { risk_taking: 0.6 }, aspiration: { careerPriorities: ["entrepreneurship"] } };
      return null;
    },
  },
  {
    id: "int_health_drill",
    text: "You're interested in health — what draws you to it most?",
    kind: "interest",
    options: [
      { id: "a", label: "Treating patients — doctor, nurse, or paramedic" },
      { id: "b", label: "Lab work, diagnosis, or medical testing" },
      { id: "c", label: "Mental health, counselling, or psychology" },
      { id: "d", label: "Healthcare management or hospital admin" },
    ],
    apply: (opt) => {
      if (opt === "a") return { interests: { helping_teaching: 0.7 }, aspiration: { careerPriorities: ["patient_care"] } };
      if (opt === "b") return { interests: { science_research: 0.8 }, aptitude: { scientific: 80 } };
      if (opt === "c") return { interests: { helping_teaching: 0.8 }, aptitude: { verbal: 70 } };
      if (opt === "d") return { interests: { business_money: 0.6 }, aspiration: { careerPriorities: ["management"] } };
      return null;
    },
  },
  {
    id: "int_tech_drill",
    text: "You enjoy tech — which area excites you most?",
    kind: "interest",
    options: [
      { id: "a", label: "Building apps, websites, or software" },
      { id: "b", label: "Hardware, electronics, or networking" },
      { id: "c", label: "Data, AI, or machine learning" },
      { id: "d", label: "IT support, systems, or computer repair" },
    ],
    apply: (opt) => {
      if (opt === "a") return { interests: { technology_coding: 0.9 }, aptitude: { logical: 80 } };
      if (opt === "b") return { interests: { building_engineering: 0.75 }, aptitude: { spatial: 70 } };
      if (opt === "c") return { interests: { numbers_analysis: 0.75, technology_coding: 0.75, science_research: 0.3 }, aptitude: { logical: 75 } };
      if (opt === "d") return { interests: { technology_coding: 0.7, building_engineering: 0.5 } };
      return null;
    },
  },
  {
    id: "int_science_drill",
    text: "You enjoy science — which direction pulls you most?",
    kind: "interest",
    options: [
      { id: "a", label: "Lab experiments, chemistry, or biology" },
      { id: "b", label: "Maths, physics, or theoretical concepts" },
      { id: "c", label: "Environment, ecology, or field research" },
      { id: "d", label: "Data, computing, or applied R&D" },
    ],
    apply: (opt) => {
      if (opt === "a") return { interests: { health_medicine: 0.5, science_research: 0.9 }, aspiration: { careerPriorities: ["lab_science"] } };
      if (opt === "b") return { interests: { numbers_analysis: 0.7, science_research: 0.9 }, aptitude: { numerical: 75, scientific: 80 } };
      if (opt === "c") return { interests: { nature_agriculture: 0.6, science_research: 0.85 }, aspiration: { careerPriorities: ["environment"] } };
      if (opt === "d") return { interests: { numbers_analysis: 0.7, technology_coding: 0.5, science_research: 0.85 }, aptitude: { logical: 75 } };
      return null;
    },
  },
  {
    id: "int_design_drill",
    text: "You have an eye for design — what kind of work excites you?",
    kind: "interest",
    options: [
      { id: "a", label: "Graphic design, branding, or visual content" },
      { id: "b", label: "Interior design, architecture, or spaces" },
      { id: "c", label: "Fashion, jewellery, or product design" },
      { id: "d", label: "Events, weddings, or experience design" },
    ],
    apply: (opt) => {
      if (opt === "a") return { interests: { media_communication: 0.65 }, aspiration: { careerPriorities: ["graphic_design"] } };
      if (opt === "b") return { interests: { building_engineering: 0.6, science_research: 0.3 }, aspiration: { careerPriorities: ["interior_design"] } };
      if (opt === "c") return { interests: { design_visual: 0.9 }, aspiration: { careerPriorities: ["fashion"] } };
      if (opt === "d") return { interests: { business_money: 0.65, helping_teaching: 0.5 }, aspiration: { careerPriorities: ["events"] } };
      return null;
    },
  },
];

// ── Stated career question ─────────────────────────────────────────────────────
// Asked right after goal — a student who already has a target career in mind
// gives the engine an enormous head-start. Free text goes through AI extraction
// and sets aspiration.statedCareer. The MCQ "not sure" option applies nothing.

const statedCareerQuestion: AdaptiveQuestion = {
  id: "ctx_stated_career",
  text: "Do you already have a career in mind? Type it below — or pick an option.",
  kind: "context",
  whyWeAsk: "If you have a goal in mind, we can tell you exactly what steps to take to get there.",
  freeText: true,
  freeTextPlaceholder: "e.g. CA, nurse, software engineer, pilot…",
  options: [
    { id: "a", label: "I have a rough idea but nothing specific" },
    { id: "b", label: "No idea yet — just exploring" },
  ],
  apply: () => null, // free text handled by AI extractor; MCQ options → null (neutral)
};

export const ADAPTIVE_QUESTIONS: AdaptiveQuestion[] = [
  ...interestQuestions,
  ...drillQuestions,
  ...aptitudeQuestions,
  ...personalityQuestions,
  ...contextQuestions,
  statedCareerQuestion,
];

export const ADAPTIVE_BY_ID: Record<string, AdaptiveQuestion> =
  Object.fromEntries(ADAPTIVE_QUESTIONS.map((q) => [q.id, q]));

export interface AdaptiveQuestionPublic {
  id: string;
  text: string;
  options: AdaptiveOption[];
  freeText?: boolean;
  freeTextPlaceholder?: string;
  multiSelect?: boolean;
  whyWeAsk?: string;
}

export function toPublicQuestion(q: AdaptiveQuestion): AdaptiveQuestionPublic {
  return {
    id: q.id,
    text: q.text,
    options: q.options,
    freeText: q.freeText ?? false,
    freeTextPlaceholder: q.freeTextPlaceholder,
    multiSelect: q.multiSelect ?? false,
    whyWeAsk: q.whyWeAsk,
  };
}
