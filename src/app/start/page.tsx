"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Stream } from "@/types/onboarding";

// ── Stream-aware choice data ─────────────────────────────────────────────────

const STREAM_CHOICES = [
  { label: "Science (Biology)", value: "science_bio" },
  { label: "Science (Maths)", value: "science_maths" },
  { label: "Science (Computer Science)", value: "science_cs" },
  { label: "Commerce", value: "commerce" },
  { label: "Humanities / Arts", value: "humanities" },
];

const SUBJECT_CHOICES: Record<Stream, Array<{ label: string; value: string }>> = {
  science_bio: [
    { label: "Biology", value: "Biology" },
    { label: "Chemistry", value: "Chemistry" },
    { label: "Physics", value: "Physics" },
    { label: "Mathematics", value: "Mathematics" },
  ],
  science_maths: [
    { label: "Mathematics", value: "Mathematics" },
    { label: "Physics", value: "Physics" },
    { label: "Chemistry", value: "Chemistry" },
    { label: "Computer Science", value: "Computer Science" },
  ],
  science_cs: [
    { label: "Computer Science", value: "Computer Science" },
    { label: "Mathematics", value: "Mathematics" },
    { label: "Physics", value: "Physics" },
    { label: "Chemistry", value: "Chemistry" },
  ],
  commerce: [
    { label: "Accountancy", value: "Accountancy" },
    { label: "Business Studies", value: "Business Studies" },
    { label: "Economics", value: "Economics" },
    { label: "Mathematics", value: "Mathematics" },
  ],
  humanities: [
    { label: "History", value: "History" },
    { label: "English", value: "English" },
    { label: "Psychology", value: "Psychology" },
    { label: "Economics", value: "Economics" },
  ],
};

const INTEREST_CHOICES: Record<Stream, Array<{ label: string; value: string }>> = {
  science_bio: [
    { label: "Caring for patients or diagnosing disease", value: "health_medicine" },
    { label: "Running experiments in a lab", value: "science_research" },
    { label: "Growing crops or working with nature", value: "nature_agriculture" },
    { label: "Teaching or mentoring others", value: "helping_teaching" },
  ],
  science_maths: [
    { label: "Building apps, websites, or programs", value: "technology_coding" },
    { label: "Solving maths or engineering problems", value: "numbers_analysis" },
    { label: "Designing structures or machines", value: "building_engineering" },
    { label: "Analysing data to find patterns", value: "science_research" },
  ],
  science_cs: [
    { label: "Writing code and building software", value: "technology_coding" },
    { label: "Designing apps, games, or interfaces", value: "design_visual" },
    { label: "Working with AI, data, or security", value: "numbers_analysis" },
    { label: "Building hardware or embedded systems", value: "building_engineering" },
  ],
  commerce: [
    { label: "Running or growing a business", value: "business_money" },
    { label: "Managing accounts and investments", value: "numbers_analysis" },
    { label: "Arguing cases or navigating law", value: "law_justice" },
    { label: "Marketing, media, or communications", value: "media_communication" },
  ],
  humanities: [
    { label: "Counselling, teaching, or social work", value: "helping_teaching" },
    { label: "Writing, journalism, or broadcasting", value: "media_communication" },
    { label: "Studying law and advocating for justice", value: "law_justice" },
    { label: "Creating art, design, or visual content", value: "design_visual" },
  ],
};

const SUBJECT_INTEREST_CHOICES: Record<string, Array<{ label: string; value: string }>> = {
  "Biology": [
    { label: "Caring for patients and treating diseases", value: "health_medicine" },
    { label: "Doing experiments in a science lab", value: "science_research" },
    { label: "Farming, agriculture, or working with nature", value: "nature_agriculture" },
    { label: "Teaching or mentoring others", value: "helping_teaching" },
    { label: "Working with animals or veterinary care", value: "nature_agriculture" },
    { label: "Working in medicine research or pharma sales", value: "health_medicine" },
  ],
  "Chemistry": [
    { label: "Doing experiments in a science lab", value: "science_research" },
    { label: "Making new medicines or chemical products", value: "health_medicine" },
    { label: "Working with materials and chemical processes", value: "building_engineering" },
    { label: "Studying environmental pollution or green energy", value: "nature_agriculture" },
    { label: "Solving crimes as a lab expert (forensics)", value: "science_research" },
  ],
  "Physics": [
    { label: "Solving complex science and physics questions", value: "science_research" },
    { label: "Designing machines, electronics, or gadgets", value: "building_engineering" },
    { label: "Working with numbers and space data", value: "numbers_analysis" },
    { label: "Developing new tech like robotics or microchips", value: "technology_coding" },
    { label: "Designing buildings, aircraft, or vehicles", value: "building_engineering" },
  ],
  "Mathematics": [
    { label: "Solving complex math puzzles and equations", value: "numbers_analysis" },
    { label: "Building finance and investment plans", value: "business_money" },
    { label: "Writing code, computer math, or cryptography", value: "technology_coding" },
    { label: "Teaching math or doing academic research", value: "helping_teaching" },
    { label: "Analyzing data, charts, and statistics", value: "numbers_analysis" },
    { label: "Working in insurance math (calculating risk)", value: "business_money" },
  ],
  "Computer Science": [
    { label: "Writing code and building software", value: "technology_coding" },
    { label: "Designing mobile apps, video games, or websites", value: "design_visual" },
    { label: "Working with AI, smart databases, and big data", value: "numbers_analysis" },
    { label: "Managing IT systems, networks, and cyber security", value: "building_engineering" },
    { label: "Creating animations or digital visual effects", value: "design_visual" },
    { label: "Developing computer hardware and microchips", value: "building_engineering" },
  ],
  "Accountancy": [
    { label: "Managing financial records and business accounts", value: "business_money" },
    { label: "Analyzing budgets, taxes, and expenses", value: "numbers_analysis" },
    { label: "Teaching commerce or finance in school/college", value: "helping_teaching" },
    { label: "Auditing business accounts to check rules", value: "law_justice" },
    { label: "Investigating financial fraud (money forensic)", value: "law_justice" },
    { label: "Consulting companies on growth and deals", value: "business_money" },
  ],
  "Business Studies": [
    { label: "Starting and running a new business/startup", value: "business_money" },
    { label: "Marketing, advertising, and selling products", value: "media_communication" },
    { label: "Managing teams, operations, and office staff", value: "helping_teaching" },
    { label: "Developing business plans and market research", value: "numbers_analysis" },
    { label: "Working in public relations or event management", value: "media_communication" },
  ],
  "Economics": [
    { label: "Analyzing market trends, prices, and inflation", value: "numbers_analysis" },
    { label: "Advising banks and government on finance policies", value: "business_money" },
    { label: "Researching how markets and societies function", value: "science_research" },
    { label: "Working on government policies and planning", value: "law_justice" },
    { label: "Working as a financial advisor or investment researcher", value: "business_money" },
  ],
  "History": [
    { label: "Researching past events, old scripts, and records", value: "science_research" },
    { label: "Teaching history or social science", value: "helping_teaching" },
    { label: "Working in museums and preserving heritage sites", value: "design_visual" },
    { label: "Preparing for civil services (IAS/IPS) or government administration", value: "law_justice" },
    { label: "Archaeology (digging up old history sites)", value: "nature_agriculture" },
    { label: "Writing history books or scripts for movies/documentaries", value: "media_communication" },
  ],
  "English": [
    { label: "Writing articles, books, or news journalism", value: "media_communication" },
    { label: "Teaching literature or English language", value: "helping_teaching" },
    { label: "Creating ads, social media posts, and creative copy", value: "design_visual" },
    { label: "Researching language science and how we speak", value: "science_research" },
    { label: "Working in book publishing or editing", value: "media_communication" },
    { label: "Translating languages or corporate communications", value: "media_communication" },
  ],
  "Psychology": [
    { label: "Counselling people and helping mental health", value: "health_medicine" },
    { label: "Researching human behavior and brain science", value: "science_research" },
    { label: "Working in corporate HR (recruiting and hiring staff)", value: "business_money" },
    { label: "Social work and helping local communities", value: "helping_teaching" },
    { label: "Analyzing consumer habits and marketing psychology", value: "numbers_analysis" },
  ],
};

function getDynamicInterestChoices(subject: string, stream: Stream) {
  if (SUBJECT_INTEREST_CHOICES[subject]) {
    return SUBJECT_INTEREST_CHOICES[subject];
  }

  const s = subject.toLowerCase();

  // Keyword matching
  if (s.includes("art") || s.includes("design") || s.includes("draw") || s.includes("paint") || s.includes("music") || s.includes("dance") || s.includes("sing") || s.includes("acting") || s.includes("drama") || s.includes("photo")) {
    return [
      { label: "Creating original artwork or performances", value: "design_visual" },
      { label: "Teaching or mentoring students in the arts", value: "helping_teaching" },
      { label: "Working in media, film, or broadcasting", value: "media_communication" },
      { label: "Managing an arts or entertainment business", value: "business_money" },
    ];
  }

  if (
    s.includes("sport") || s.includes("athlet") || s.includes("fitness") || s.includes("gym") ||
    s.includes("coach") || s.includes("physical") || s.includes("trainer") || s.includes("football") ||
    s.includes("cricket") || s.includes("basketball") || s.includes("badminton") || s.includes("hockey") ||
    s.includes("volleyball") || s.includes("tennis") || s.includes("kabaddi") || s.includes("swim") ||
    s.includes("running") || s.includes("athletics") || s.includes("martial") || s.includes("karate") ||
    s.includes("yoga") || s.includes("skating") || s.includes("play")
  ) {
    return [
      { label: "Training athletes, fitness coaching, or gym training", value: "defence_adventure" },
      { label: "Teaching physical education or sports coaching", value: "helping_teaching" },
      { label: "Managing a gym, sports team, or fitness facility", value: "business_money" },
      { label: "Working in sports media, journalism, or events", value: "media_communication" },
    ];
  }

  if (s.includes("cook") || s.includes("food") || s.includes("chef") || s.includes("bakery") || s.includes("baking") || s.includes("culinary") || s.includes("hotel") || s.includes("hospitality")) {
    return [
      { label: "Working as a professional chef or baker", value: "design_visual" },
      { label: "Managing a restaurant, hotel, or food business", value: "business_money" },
      { label: "Developing new food products or culinary arts", value: "design_visual" },
      { label: "Promoting food blogs, media, or hospitality events", value: "media_communication" },
    ];
  }

  if (s.includes("lang") || s.includes("lit") || s.includes("read") || s.includes("write")) {
    return [
      { label: "Writing, editing, or publishing", value: "media_communication" },
      { label: "Teaching languages or literature", value: "helping_teaching" },
      { label: "Researching texts and history", value: "science_research" },
      { label: "Translating or working in public relations", value: "media_communication" },
    ];
  }

  if (s.includes("comp") || s.includes("tech") || s.includes("code") || s.includes("program") || s.includes("it")) {
    return [
      { label: "Writing code and building software", value: "technology_coding" },
      { label: "Designing apps, games, or interfaces", value: "design_visual" },
      { label: "Working with AI and data", value: "numbers_analysis" },
      { label: "Managing IT systems and security", value: "building_engineering" },
    ];
  }
  
  if (s.includes("soci") || s.includes("politic") || s.includes("civic")) {
    return [
      { label: "Working in public policy or government", value: "law_justice" },
      { label: "Researching societal trends", value: "science_research" },
      { label: "Social work and community support", value: "helping_teaching" },
      { label: "Journalism or political communication", value: "media_communication" },
    ];
  }

  // Dynamic fallback using the custom subject name itself
  const capitalizedSubject = subject.charAt(0).toUpperCase() + subject.slice(1);
  return [
    { label: `Researching and studying ${capitalizedSubject} in-depth`, value: "science_research" },
    { label: `Teaching or mentoring others in ${capitalizedSubject}`, value: "helping_teaching" },
    { label: `Applying ${capitalizedSubject} to build new solutions`, value: "building_engineering" },
    { label: `Using ${capitalizedSubject} in a business setting`, value: "business_money" },
  ];
}

const COMBINED_SUBJECT_INTERESTS: Record<string, Array<{ label: string; value: string }>> = {
  "Chemistry+Computer Science": [
    { label: "Using computer AI to discover new medicines", value: "health_medicine" },
    { label: "Using computer models to test chemical and molecular reactions", value: "science_research" },
    { label: "Building computer programs for biotech labs or chemical factories", value: "building_engineering" },
    { label: "Analyzing chemical data using data science tools", value: "numbers_analysis" },
  ],
  "Biology+Computer Science": [
    { label: "Analyzing DNA and genetic data using coding (Bioinformatics)", value: "science_research" },
    { label: "Building health apps and medical software for hospitals", value: "health_medicine" },
    { label: "Modeling biological cells and diseases on computers", value: "science_research" },
    { label: "Building software for robotic surgeries or health gadgets", value: "building_engineering" },
  ],
  "Mathematics+Physics": [
    { label: "Solving astrophysics math and modeling space data", value: "science_research" },
    { label: "Building physics logic/engines for video games and simulations", value: "technology_coding" },
    { label: "Using math and statistical models to analyze money markets", value: "numbers_analysis" },
    { label: "Designing aerospace systems, rockets, or structural models", value: "building_engineering" },
  ],
  "Computer Science+Mathematics": [
    { label: "Building AI, machine learning models, and smart code", value: "technology_coding" },
    { label: "Building secure systems, cryptography, and cyber protection", value: "technology_coding" },
    { label: "Working as a data analyst studying big statistics datasets", value: "numbers_analysis" },
    { label: "Creating mathematical algorithms for financial markets", value: "business_money" },
  ],
  "Biology+Chemistry": [
    { label: "Developing new vaccines, medicines, and medical therapies", value: "health_medicine" },
    { label: "Researching genetics and biotechnology in a science lab", value: "science_research" },
    { label: "Testing food safety, agriculture science, or soil quality", value: "nature_agriculture" },
    { label: "Solving crimes by testing chemical/biological evidence (forensics)", value: "science_research" },
  ],
  "Accountancy+Economics": [
    { label: "Analyzing business financial reports and investment risks", value: "business_money" },
    { label: "Researching economic trends and banking policies", value: "numbers_analysis" },
    { label: "Advising businesses on taxes and growth plans", value: "business_money" },
    { label: "Checking government spending or business compliance", value: "law_justice" },
  ],
  "Business Studies+Economics": [
    { label: "Advising companies on growth and business strategies", value: "business_money" },
    { label: "Studying market demand, price trends, and consumer habits", value: "numbers_analysis" },
    { label: "Managing international trade, shipping, and supply chains", value: "business_money" },
    { label: "Working in PR (public relations) or writing economic news", value: "media_communication" },
  ],
  "Chemistry+Physics": [
    { label: "Researching materials science, nanotechnology, or physical chemistry", value: "science_research" },
    { label: "Working in chemical engineering or materials manufacturing", value: "building_engineering" },
    { label: "Studying environmental pollution, green energy, and solar systems", value: "nature_agriculture" },
    { label: "Teaching physics or chemistry at schools/colleges", value: "helping_teaching" },
  ],
  "Accountancy+Business Studies": [
    { label: "Starting and managing a business venture or franchise", value: "business_money" },
    { label: "Analyzing business accounts and company financial health", value: "numbers_analysis" },
    { label: "Advising companies on growth, management, and team building", value: "helping_teaching" },
    { label: "Checking bookkeeping practices and tax compliance", value: "law_justice" },
  ],
  "Economics+Mathematics": [
    { label: "Using math to study economic trends and make charts", value: "numbers_analysis" },
    { label: "Analyzing stock markets and corporate investments", value: "business_money" },
    { label: "Researching social behaviors and population databases", value: "science_research" },
    { label: "Working in government planning, policy design, or IAS prep", value: "law_justice" },
  ],
  "History+English": [
    { label: "Creative writing, book publishing, or journalism", value: "media_communication" },
    { label: "Teaching history, literature, or languages", value: "helping_teaching" },
    { label: "Preparing for civil services (IAS), law, or public administration", value: "law_justice" },
    { label: "Working in museums and preserving historical monuments", value: "design_visual" },
  ],
  "English+Psychology": [
    { label: "Writing self-help blogs, books, or editing mental health content", value: "media_communication" },
    { label: "Counselling students, offering career guidance, or teaching", value: "helping_teaching" },
    { label: "Working in HR (hiring staff), public relations, or marketing", value: "business_money" },
    { label: "Working in clinical psychology and mental health settings", value: "health_medicine" },
  ],
};

// Entrance exams differ by stream — a Commerce student should never see NEET/JEE.
const STREAM_EXAMS: Record<Stream, string> = {
  science_bio: "NEET / KEAM",
  science_maths: "JEE / KEAM",
  science_cs: "JEE / KEAM",
  commerce: "CUET / IPMAT",
  humanities: "CUET / CLAT",
};

// Goal choices are stream-aware: the entrance-exam option names only the exams
// that actually apply to the student's stream.
function getGoalChoices(stream: Stream | null): Array<{ label: string; value: string }> {
  const exams = stream ? STREAM_EXAMS[stream] : "JEE / NEET / CUET";
  return [
    { label: "Study a degree (BTech / BSc / BA / BBA / MBBS)", value: "higher_study" },
    { label: `Crack entrance exams this year (${exams})`, value: "entrance_exams" },
    { label: "Repeat a year (Entrance coaching)", value: "repeat_year" },
    { label: "Prepare for govt exams (PSC / UPSC)", value: "government" },
    { label: "Get a job quickly", value: "job_soon" },
    { label: "Start a business or project", value: "business" },
  ];
}

const PRIORITY_CHOICES = [
  { label: "High salary and fast growth", value: "high_salary" },
  { label: "Stable job and security", value: "job_security" },
  { label: "Work I'm passionate about", value: "passion" },
  { label: "Government or public service", value: "government_service" },
];

const BUDGET_CHOICES = [
  { label: "Yes, cost is not a big problem", value: "no_constraint" },
  { label: "Maybe, but it has to be reasonable", value: "medium" },
  { label: "No, we need a low-cost or government college", value: "low" },
];

const LOCATION_CHOICES = [
  { label: "I'd prefer to stay in Kerala", value: "kerala" },
  { label: "I can move anywhere in India", value: "india" },
  { label: "I'm open to studying abroad too", value: "abroad" },
];

const FAMILY_CHOICES = [
  { label: "No, the choice is fully mine", value: "none" },
  { label: "They have a mild preference", value: "some_preference" },
  { label: "Yes, they strongly prefer a certain path", value: "family_preference" },
];

const WORKSTYLE_CHOICES = [
  { label: "With people — talking, helping, leading", value: "social" },
  { label: "On my own — thinking, solving, focusing", value: "analytical_solo" },
  { label: "Hands-on or outdoors — building, moving", value: "practical_outdoor" },
  { label: "A mix of all of these", value: "mixed" },
];

const TOTAL_QUESTIONS = 10;

// ── UI-only icon maps (Icons8 3D Fluency) ─────────────────────────────────
const i8 = (n: string) => `https://img.icons8.com/3d-fluency/96/${n}.png`;
const STREAM_ICONS: Record<string, string> = {
  science_bio: i8("microscope"), science_maths: i8("math"), science_cs: i8("laptop"),
  commerce: i8("combo-chart"), humanities: i8("paint-palette"),
};
const GOAL_ICONS: Record<string, string> = {
  higher_study: i8("graduation-cap"), entrance_exams: i8("trophy"), repeat_year: i8("books"),
  government: i8("bank"), job_soon: i8("briefcase"), business: i8("rocket"),
};
const PRIORITY_ICONS: Record<string, string> = {
  high_salary: i8("money-bag"), job_security: i8("shield"),
  passion: i8("like"), government_service: i8("bank"),
};
const BUDGET_ICONS: Record<string, string> = {
  no_constraint: i8("money-bag"), medium: i8("wallet"), low: i8("piggy-bank"),
};
const LOCATION_ICONS: Record<string, string> = {
  kerala: i8("home"), india: i8("india"), abroad: i8("airplane-take-off"),
};
const FAMILY_ICONS: Record<string, string> = {
  none: i8("user"), some_preference: i8("conference-call"), family_preference: i8("family"),
};
const WORKSTYLE_ICONS: Record<string, string> = {
  social: i8("conference-call"), analytical_solo: i8("brain"),
  practical_outdoor: i8("hand-tools"), mixed: i8("puzzle"),
};

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "questions" | "loading" | "result";

type MiniRecCourse = {
  courseId: string;
  name: string;       // course name — the next step to take
  leadsTo: string;    // career this course leads toward
  domain: string;
  fitScore: number;
  confidence: number;
};

type MiniRecResult = {
  top: MiniRecCourse[];
  overallConfidence: number;
};

const DOMAIN_COLORS: Record<string, string> = {
  "Health & Medicine": "bg-rose-400",
  "Technology": "bg-violet-400",
  "Technology & Computing": "bg-violet-400",
  "Business & Finance": "bg-amber-400",
  "Science & Research": "bg-cyan-400",
  "Engineering": "bg-blue-400",
  "Design & Media": "bg-pink-400",
  "Law & Justice": "bg-indigo-400",
  "Education & Social Work": "bg-green-400",
  "Agriculture & Nature": "bg-emerald-400",
  "Defence & Security": "bg-slate-400",
};

function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? "bg-primary";
}

function getCareerIcon(name: string, domain: string): string {
  const n = name.toLowerCase();
  const d = domain.toLowerCase();

  // Keyword match on career name
  if (n.includes("cloud") || n.includes("network") || n.includes("system administrator")) {
    return "https://img.icons8.com/3d-fluency/96/cloud.png";
  }
  if (n.includes("cyber") || n.includes("security") || n.includes("ethical hacker")) {
    return "https://img.icons8.com/3d-fluency/96/shield.png";
  }
  if (n.includes("operation") || n.includes("manager") || n.includes("business analyst") || n.includes("project manager") || n.includes("consultant")) {
    return "https://img.icons8.com/3d-fluency/96/briefcase.png";
  }
  if (n.includes("developer") || n.includes("programmer") || n.includes("software") || n.includes("web") || n.includes("app")) {
    return "https://img.icons8.com/3d-fluency/96/code.png";
  }
  if (n.includes("data scientist") || n.includes("data analyst") || n.includes("database") || n.includes("ai") || n.includes("machine learning")) {
    return "https://img.icons8.com/3d-fluency/96/database.png";
  }
  if (n.includes("coach") || n.includes("sport") || n.includes("instructor") || n.includes("athlet")) {
    return "https://img.icons8.com/3d-fluency/96/football.png";
  }
  if (n.includes("trainer") || n.includes("gym") || n.includes("fitness")) {
    return "https://img.icons8.com/3d-fluency/96/dumbbell.png";
  }
  if (n.includes("chef") || n.includes("baker") || n.includes("pastry") || n.includes("cooking") || n.includes("cook")) {
    return "https://img.icons8.com/3d-fluency/96/croissant.png";
  }
  if (n.includes("food") || n.includes("restaurant") || n.includes("hotel") || n.includes("catering")) {
    return "https://img.icons8.com/3d-fluency/96/restaurant.png";
  }
  if (n.includes("photographer") || n.includes("videographer") || n.includes("camera") || n.includes("media") || n.includes("journalist")) {
    return "https://img.icons8.com/3d-fluency/96/camera.png";
  }
  if (n.includes("doctor") || n.includes("physician") || n.includes("surgeon") || n.includes("nurse") || n.includes("medical") || n.includes("clinical")) {
    return "https://img.icons8.com/3d-fluency/96/hospital.png";
  }
  if (n.includes("research") || n.includes("scientist") || n.includes("chemist") || n.includes("physicist")) {
    return "https://img.icons8.com/3d-fluency/96/test-tube.png";
  }
  if (n.includes("design") || n.includes("ui") || n.includes("ux") || n.includes("artist") || n.includes("creative") || n.includes("illustrator")) {
    return "https://img.icons8.com/3d-fluency/96/paint-palette.png";
  }
  if (n.includes("law") || n.includes("advocate") || n.includes("judge") || n.includes("legal")) {
    return "https://img.icons8.com/3d-fluency/96/scales.png";
  }
  if (n.includes("teacher") || n.includes("professor") || n.includes("educat") || n.includes("trainer") || n.includes("tutor")) {
    return "https://img.icons8.com/3d-fluency/96/graduation-cap.png";
  }

  // Fallback by domain
  if (d.includes("tech") || d.includes("comput")) {
    return "https://img.icons8.com/3d-fluency/96/code.png";
  }
  if (d.includes("business") || d.includes("finance") || d.includes("management")) {
    return "https://img.icons8.com/3d-fluency/96/briefcase.png";
  }
  if (d.includes("science") || d.includes("research")) {
    return "https://img.icons8.com/3d-fluency/96/test-tube.png";
  }
  if (d.includes("health") || d.includes("med")) {
    return "https://img.icons8.com/3d-fluency/96/hospital.png";
  }
  if (d.includes("design") || d.includes("media") || d.includes("art")) {
    return "https://img.icons8.com/3d-fluency/96/paint-palette.png";
  }
  if (d.includes("law") || d.includes("justice")) {
    return "https://img.icons8.com/3d-fluency/96/scales.png";
  }
  if (d.includes("education") || d.includes("social")) {
    return "https://img.icons8.com/3d-fluency/96/graduation-cap.png";
  }
  if (d.includes("nature") || d.includes("agri")) {
    return "https://img.icons8.com/3d-fluency/96/sprout.png";
  }
  if (d.includes("hospitality") || d.includes("hotel") || d.includes("food") || d.includes("culinary")) {
    return "https://img.icons8.com/3d-fluency/96/restaurant.png";
  }
  if (d.includes("defence") || d.includes("security")) {
    return "https://img.icons8.com/3d-fluency/96/shield.png";
  }

  return "https://img.icons8.com/3d-fluency/96/star.png";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StartPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("questions");
  const [qIndex, setQIndex] = useState(0);
  const [stream, setStream] = useState<Stream | null>(null);
  const [selectedSubjectsList, setSelectedSubjectsList] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());

  // Q0: name + age + phone + gender
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");

  // Q1: stream + percentage
  const [percentage, setPercentage] = useState("");

  // Q2: subject multi-select
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());

  // Free-text input (Q2–Q5)
  const [textVal, setTextVal] = useState("");
  const textRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [miniRec, setMiniRec] = useState<MiniRecResult | null>(null);
  const [recError, setRecError] = useState(false);

  // Animate question transitions
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (qIndex === 4) {
      const lower = textVal.toLowerCase();
      if (lower.includes("repeat") || lower.includes("re-use") || lower.includes("drop") || lower.includes("one year") || lower.includes("coaching")) {
        setInfoMessage("Taking a drop/repeat year to prep for JEE/NEET/KEAM is challenging but very rewarding. We'll adjust your path to focus on cracking these exams!");
      } else if (lower.includes("jee") || lower.includes("neet") || lower.includes("keam") || lower.includes("entrance") || lower.includes("iit") || lower.includes("aiims")) {
        setInfoMessage("Aptitude is key for cracking entrance exams! We'll make sure your report highlights paths aligned with engineering and medical streams.");
      } else {
        setInfoMessage(null);
      }
    } else {
      setInfoMessage(null);
    }
  }, [textVal, qIndex]);

  useEffect(() => {
    fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "start_quiz" }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.sessionId) setSessionId(d.sessionId);
        else setSessionError(true);
      })
      .catch(() => setSessionError(true));
  }, []);

  function getLabel() {
    return [
      "About You", "Your Stream", "Your Subjects", "Your Interests", "Your Goal",
      "Your Priorities", "Your Budget", "Your Location", "Your Family", "Your Work Style",
    ][qIndex] ?? "";
  }

  function getQuestion() {
    switch (qIndex) {
      case 0: return "Hey there! Let's get started. What is your name, age, and phone number?";
      case 1: return "Which stream are you studying in Plus Two?";
      case 2: return "Which subjects do you enjoy the most or score best in? (pick up to 2)";
      case 3: return "Would you be interested in any of these?";
      case 4: return "What are you planning to do after Plus Two?";
      case 5: return "What matters most to you when choosing a career?";
      case 6: return "Can your family comfortably pay for a private college if needed?";
      case 7: return "Are you open to moving to another city or abroad to study?";
      case 8: return "Does your family have a strong preference about your career?";
      case 9: return "How do you most enjoy working?";
      default: return "";
    }
  }

  function getChoices() {
    const s = stream ?? "science_bio";
    switch (qIndex) {
      case 2: return SUBJECT_CHOICES[s];
      case 3: {
        let baseChoices: Array<{ label: string; value: string }> = [];
        if (selectedSubjectsList.length > 0) {
          if (selectedSubjectsList.length === 1) {
            baseChoices = getDynamicInterestChoices(selectedSubjectsList[0], s);
          } else {
            // Check if there is a predefined combined interest list for this specific combo
            const comboKey = [...selectedSubjectsList].sort().join("+");
            if (COMBINED_SUBJECT_INTERESTS[comboKey]) {
              baseChoices = COMBINED_SUBJECT_INTERESTS[comboKey];
            } else {
              const choices1 = getDynamicInterestChoices(selectedSubjectsList[0], s);
              const choices2 = getDynamicInterestChoices(selectedSubjectsList[1], s);
              
              // Interleave choices so they get even representation of both subjects
              const interleaved: Array<{ label: string; value: string }> = [];
              const maxLen = Math.max(choices1.length, choices2.length);
              for (let i = 0; i < maxLen; i++) {
                if (choices1[i]) interleaved.push(choices1[i]);
                if (choices2[i]) interleaved.push(choices2[i]);
              }
              
              // Deduplicate choices based on labels/values
              const seen = new Set<string>();
              const merged: Array<{ label: string; value: string }> = [];
              for (const c of interleaved) {
                const key = c.label.toLowerCase() + "::" + c.value;
                if (!seen.has(key)) {
                  seen.add(key);
                  merged.push(c);
                }
              }
              baseChoices = merged;
            }
          }
        } else {
          baseChoices = INTEREST_CHOICES[s];
        }

        // Limit options to a maximum of 6 and append unique suffix to ensure selection checkbox works independently
        return baseChoices.slice(0, 6).map((c, idx) => ({
          label: c.label,
          value: `${c.value}::${idx}`,
        }));
      }
      case 4: return getGoalChoices(stream);
      case 5: return PRIORITY_CHOICES;
      case 6: return BUDGET_CHOICES;
      case 7: return LOCATION_CHOICES;
      case 8: return FAMILY_CHOICES;
      case 9: return WORKSTYLE_CHOICES;
      default: return [];
    }
  }

  function getTextPlaceholder() {
    switch (qIndex) {
      case 2: return "e.g. Applied Statistics, Physical Education…";
      case 3: return "e.g. I love designing posters, writing stories…";
      case 4: return "e.g. I want to go abroad for studies…";
      case 5: return "e.g. Work-life balance matters most to me…";
      default: return "Type your answer…";
    }
  }

  function toggleSubject(value: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (next.size >= 2) {
          const first = next.values().next().value as string;
          next.delete(first);
        }
        next.add(value);
      }
      return next;
    });
  }

  async function postAnswer(opts: {
    value?: string;
    values?: string[];
    text?: string;
    name?: string;
    age?: number;
    phone?: string;
    gender?: string;
    percentage?: number;
    isChoice: boolean;
  }) {
    if (!sessionId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, questionIndex: qIndex, ...opts }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
    advance();
  }

  function advance() {
    setVisible(false);
    setTimeout(() => {
      if (qIndex < TOTAL_QUESTIONS - 1) {
        setQIndex((i) => i + 1);
        setSelectedSubjects(new Set());
        setSelectedInterests(new Set());
        setTextVal("");
        setInfoMessage(null);
        setVisible(true);
      } else {
        setPhase("loading");
        fetchMiniRec();
      }
    }, 220);
  }

  async function fetchMiniRec() {
    if (!sessionId) return;
    try {
      const res = await fetch("/api/mini-recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Failed");
      const data: MiniRecResult = await res.json();
      setMiniRec(data);
      setPhase("result");
    } catch {
      setRecError(true);
      setPhase("result");
    }
  }

  // Q0: name + age continue
  function onNameAgeContinue() {
    const parsedAge = parseInt(age, 10);
    if (!name.trim() || isNaN(parsedAge) || parsedAge < 10 || parsedAge > 30 || !/^[6-9]\d{9}$/.test(phone) || !gender) return;
    void postAnswer({ name: name.trim(), age: parsedAge, phone: phone.trim(), gender, isChoice: false });
  }

  // Q1: stream + percentage continue
  function onStreamContinue() {
    if (!stream) return;
    const pct = parseFloat(percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) return;
    void postAnswer({ value: stream, percentage: pct, isChoice: true });
  }

  function onSubjectContinue() {
    if (selectedSubjects.size === 0 && !textVal.trim()) return;
    if (textVal.trim() && selectedSubjects.size === 0) {
      setSelectedSubjectsList([textVal.trim()]);
      void postAnswer({ text: textVal.trim(), isChoice: false });
    } else if (selectedSubjects.size > 0) {
      setSelectedSubjectsList(Array.from(selectedSubjects));
      void postAnswer({ values: Array.from(selectedSubjects), isChoice: true });
    }
  }

  function onInterestContinue() {
    if (selectedInterests.size === 0 && !textVal.trim()) return;
    if (textVal.trim() && selectedInterests.size === 0) {
      void postAnswer({ text: textVal.trim(), isChoice: false });
    } else if (selectedInterests.size > 0) {
      void postAnswer({ values: Array.from(selectedInterests), isChoice: true });
    }
  }

  function toggleInterest(value: string) {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function onChoiceClick(value: string) {
    if (qIndex === 2) {
      toggleSubject(value);
      return; // subjects need explicit Continue
    }
    if (qIndex === 3) {
      toggleInterest(value);
      return; // interests need explicit Continue
    }
    if (qIndex === 4) {
      if (value === "repeat_year") {
        setInfoMessage("Taking a drop/repeat year to prep for JEE/NEET/KEAM is challenging but very rewarding. We'll adjust your path to focus on cracking these exams!");
      } else if (value === "entrance_exams") {
        const exams = stream ? STREAM_EXAMS[stream] : "your entrance exams";
        setInfoMessage(`Aptitude is key for cracking entrance exams! We'll focus your report on paths that need ${exams}.`);
      } else {
        setInfoMessage(null);
      }
      
      // Delay advance slightly so they can read the message
      setBusy(true);
      setTimeout(() => {
        void postAnswer({ value, isChoice: true });
      }, 3000);
      return;
    }
    void postAnswer({ value, isChoice: true });
  }

  function onTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = textVal.trim();
    if (!t || busy) return;
    if (qIndex === 2) {
      setSelectedSubjectsList([t]);
    }
    void postAnswer({ text: t, isChoice: false });
  }

  const nameAgeValid = name.trim().length >= 2 && parseInt(age, 10) >= 10 && parseInt(age, 10) <= 30 && /^[6-9]\d{9}$/.test(phone) && !!gender;
  const streamPctValid = !!stream && parseFloat(percentage) >= 0 && parseFloat(percentage) <= 100;

  if (sessionError) {
    return (
      <div
        className="flex h-screen flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "#F8F3EC" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://img.icons8.com/3d-fluency/96/sad.png" alt="" width={64} height={64} />
        <div className="clay-card w-full max-w-xs p-6">
          <p className="mb-4 text-sm font-semibold" style={{ color: "#374151" }}>
            Could not start a session. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="clay-btn w-full text-sm"
            style={{ height: 48 }}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#F8F3EC" }}>
      <style>{`
        @keyframes cta-pulse-glow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 0px #061A8A, 0 8px 24px rgba(30,111,255,0.3);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 4px 0px #061A8A, 0 16px 36px rgba(30,111,255,0.55);
          }
        }
        .cta-glow-pulse {
          animation: cta-pulse-glow 2s infinite ease-in-out;
        }
      `}</style>

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "rgba(248,243,236,0.9)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(30,111,255,0.07)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div
              style={{
                width: 30, height: 30, borderRadius: 10,
                background: "linear-gradient(145deg, #3B82FF, #1E6FFF)",
                boxShadow: "0 3px 0 rgba(6,26,138,0.4), 0 6px 16px rgba(30,111,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>P</span>
            </div>
            <span className="text-sm font-black tracking-tight" style={{ color: "#111827" }}>
              PathFinder
            </span>
          </Link>
          {phase === "questions" && (
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: "rgba(30,111,255,0.09)", color: "#1E6FFF" }}
            >
              {qIndex + 1} / {TOTAL_QUESTIONS}
            </span>
          )}
        </div>
      </header>

      {/* ── Progress bar ── */}
      {phase === "questions" && (
        <div className="px-5 pt-4 pb-1">
          <div className="mx-auto flex max-w-lg gap-2">
            {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
              <div
                key={i}
                className="transition-all duration-500"
                style={{
                  height: 6,
                  flex: 1,
                  borderRadius: 99,
                  background:
                    i < qIndex
                      ? "#1E6FFF"
                      : i === qIndex
                      ? "rgba(30,111,255,0.35)"
                      : "rgba(30,111,255,0.1)",
                  boxShadow: i < qIndex ? "0 2px 8px rgba(30,111,255,0.3)" : "none",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 py-6">

        {/* ── Questions Phase ── */}
        {phase === "questions" && (
          <div
            className="flex flex-1 flex-col gap-4"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 0.22s ease, transform 0.22s ease",
            }}
          >
            {/* Question heading card */}
            <div className="clay-card px-6 pt-6 pb-5">
              <p
                className="mb-1.5 text-[11px] font-black uppercase tracking-[0.12em]"
                style={{ color: "#1E6FFF" }}
              >
                {getLabel()}
              </p>
              <h2
                className="text-xl font-bold leading-snug sm:text-2xl"
                style={{ color: "#111827" }}
              >
                {getQuestion()}
              </h2>
            </div>

            {/* Q0: Name + Age + Phone */}
            {qIndex === 0 && (
              <div className="clay-card p-6 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold" style={{ color: "#6B7280" }}>
                    Full name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Akhil Kumar"
                    autoFocus
                    className="w-full px-4 py-3.5 text-sm outline-none placeholder:text-gray-400 transition-all"
                    style={{ borderRadius: 16, border: "1.5px solid rgba(30,111,255,0.15)", background: "#F4F6FB", color: "#111827" }}
                    onFocus={(e) => { e.target.style.borderColor = "#1E6FFF"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 3px rgba(30,111,255,0.1)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(30,111,255,0.15)"; e.target.style.background = "#F4F6FB"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-xs font-bold" style={{ color: "#6B7280" }}>Age</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 17"
                      min={10}
                      max={30}
                      className="w-full px-4 py-3.5 text-sm outline-none placeholder:text-gray-400 transition-all"
                      style={{ borderRadius: 16, border: "1.5px solid rgba(30,111,255,0.15)", background: "#F4F6FB", color: "#111827" }}
                      onFocus={(e) => { e.target.style.borderColor = "#1E6FFF"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 3px rgba(30,111,255,0.1)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(30,111,255,0.15)"; e.target.style.background = "#F4F6FB"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold" style={{ color: "#6B7280" }}>Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9XXXXXXXXX"
                      inputMode="numeric"
                      className="w-full px-4 py-3.5 text-sm outline-none placeholder:text-gray-400 transition-all"
                      style={{ borderRadius: 16, border: "1.5px solid rgba(30,111,255,0.15)", background: "#F4F6FB", color: "#111827" }}
                      onFocus={(e) => { e.target.style.borderColor = "#1E6FFF"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 3px rgba(30,111,255,0.1)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(30,111,255,0.15)"; e.target.style.background = "#F4F6FB"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>
                <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                  Your number is only used to share your report with a counsellor.
                </p>
                <div>
                  <label className="mb-2 block text-xs font-bold" style={{ color: "#6B7280" }}>Gender</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Male", value: "male" },
                      { label: "Female", value: "female" },
                      { label: "Other", value: "other" },
                      { label: "Prefer not to say", value: "prefer_not_to_say" },
                    ].map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGender(g.value)}
                        className="px-3 py-2.5 text-xs font-semibold transition-all"
                        style={{
                          borderRadius: 14,
                          border: gender === g.value ? "1.5px solid #1E6FFF" : "1.5px solid rgba(30,111,255,0.15)",
                          background: gender === g.value ? "linear-gradient(135deg, #EEF4FF 0%, #D9E9FF 100%)" : "#F4F6FB",
                          color: gender === g.value ? "#1E6FFF" : "#374151",
                        }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  disabled={!nameAgeValid || busy}
                  onClick={onNameAgeContinue}
                  className="clay-btn w-full text-sm"
                  style={{ height: 52 }}
                >
                  {busy ? "Saving…" : "Continue →"}
                </button>
              </div>
            )}

            {/* Q1: Stream cards + percentage */}
            {qIndex === 1 && (
              <div className="flex flex-col gap-3">
                <div className="clay-card p-4 space-y-2">
                  {STREAM_CHOICES.map((c) => (
                    <button
                      key={c.value}
                      disabled={busy}
                      onClick={() => setStream(c.value as Stream)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold focus:outline-none transition-all duration-150 disabled:cursor-not-allowed"
                      style={{
                        borderRadius: 18,
                        border: stream === c.value ? "1.5px solid #1E6FFF" : "1.5px solid rgba(30,111,255,0.1)",
                        background: stream === c.value ? "linear-gradient(135deg, #EEF4FF 0%, #D9E9FF 100%)" : "#F4F6FB",
                        color: stream === c.value ? "#1E6FFF" : "#374151",
                        boxShadow: stream === c.value ? "0 2px 0 rgba(30,111,255,0.15), 0 4px 16px rgba(30,111,255,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
                        transform: stream === c.value ? "scale(1.01)" : "scale(1)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={STREAM_ICONS[c.value] ?? i8("book")} alt="" width={28} height={28} className="shrink-0" />
                      <span className="flex-1">{c.label}</span>
                      {stream === c.value && (
                        <span className="shrink-0 text-sm font-bold" style={{ color: "#1E6FFF" }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="clay-card p-5 space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-bold" style={{ color: "#6B7280" }}>
                      Plus Two percentage (%)
                    </label>
                    <input
                      type="number"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      placeholder="e.g. 70"
                      min={0}
                      max={100}
                      step="0.01"
                      className="w-full px-4 py-3.5 text-sm outline-none placeholder:text-gray-400 transition-all"
                      style={{ borderRadius: 16, border: "1.5px solid rgba(30,111,255,0.15)", background: "#F4F6FB", color: "#111827" }}
                      onFocus={(e) => { e.target.style.borderColor = "#1E6FFF"; e.target.style.background = "#fff"; e.target.style.boxShadow = "0 0 0 3px rgba(30,111,255,0.1)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "rgba(30,111,255,0.15)"; e.target.style.background = "#F4F6FB"; e.target.style.boxShadow = "none"; }}
                    />
                  </div>
                  {streamPctValid && (
                    <button
                      disabled={busy}
                      onClick={onStreamContinue}
                      className="clay-btn w-full text-sm"
                      style={{ height: 52 }}
                    >
                      {busy ? "Saving…" : "Continue →"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Q2–Q5: Choice buttons */}
            {qIndex >= 2 && (
              <div className="clay-card p-4 space-y-2">
                {getChoices().map((c, i) => {
                  const isSelected =
                    (qIndex === 2 && selectedSubjects.has(c.value)) ||
                    (qIndex === 3 && selectedInterests.has(c.value));
                  const iconMap: Record<number, Record<string, string>> = {
                    4: GOAL_ICONS, 5: PRIORITY_ICONS, 6: BUDGET_ICONS,
                    7: LOCATION_ICONS, 8: FAMILY_ICONS, 9: WORKSTYLE_ICONS,
                  };
                  const iconToShow = iconMap[qIndex] ? (iconMap[qIndex][c.value] ?? i8("star")) : null;

                  return (
                    <button
                      key={`${qIndex}-${c.value}-${i}`}
                      disabled={busy}
                      onClick={() => onChoiceClick(c.value)}
                      className="w-full flex items-center gap-3 px-4 py-4 text-left text-sm font-semibold focus:outline-none transition-all duration-150 disabled:cursor-not-allowed"
                      style={{
                        borderRadius: 18,
                        border: isSelected ? "1.5px solid #1E6FFF" : "1.5px solid rgba(30,111,255,0.1)",
                        background: isSelected ? "linear-gradient(135deg, #EEF4FF 0%, #D9E9FF 100%)" : "#F4F6FB",
                        color: isSelected ? "#1E6FFF" : "#374151",
                        boxShadow: isSelected ? "0 2px 0 rgba(30,111,255,0.15), 0 4px 16px rgba(30,111,255,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
                        opacity: busy && !isSelected ? 0.6 : 1,
                      }}
                    >
                      {iconToShow && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={iconToShow} alt="" width={28} height={28} className="shrink-0" />
                      )}
                      {(qIndex === 2 || qIndex === 3) && (
                        <span
                          className="shrink-0 flex items-center justify-center"
                          style={{
                            width: 18, height: 18, borderRadius: 6,
                            border: isSelected ? "none" : "1.5px solid #D1D5DB",
                            background: isSelected ? "#1E6FFF" : "transparent",
                            color: "#fff", fontSize: 10, fontWeight: 700, flexShrink: 0,
                          }}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                      )}
                      <span className="flex-1 leading-snug">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Subjects/Interests Continue button (Q2 & Q3) */}
            {((qIndex === 2 && (selectedSubjects.size > 0 || textVal.trim())) ||
              (qIndex === 3 && (selectedInterests.size > 0 || textVal.trim()))) && (
              <button
                disabled={busy}
                onClick={qIndex === 2 ? onSubjectContinue : onInterestContinue}
                className="clay-btn w-full text-sm"
                style={{ height: 52 }}
              >
                {busy ? "Saving…" : "Continue →"}
              </button>
            )}

            {/* Chat-style free-text input (open-ended questions only, Q2–Q5) */}
            {qIndex >= 2 && qIndex <= 5 && (
              <form
                onSubmit={onTextSubmit}
                className="flex items-center gap-2.5 px-4 py-3"
                style={{
                  borderRadius: 22,
                  background: "#fff",
                  border: "1.5px solid rgba(30,111,255,0.12)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset, 0 2px 12px rgba(0,0,0,0.05)",
                }}
              >
                <input
                  ref={textRef}
                  value={textVal}
                  onChange={(e) => setTextVal(e.target.value)}
                  placeholder="Or type your own answer…"
                  disabled={busy}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
                  style={{ color: "#111827" }}
                />
                <button
                  type="submit"
                  disabled={busy || !textVal.trim()}
                  className="flex shrink-0 items-center justify-center transition-all disabled:opacity-30 hover:opacity-90"
                  style={{
                    width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: "linear-gradient(145deg, #3B82FF, #1E6FFF)",
                    boxShadow: "0 3px 0 rgba(6,26,138,0.35), 0 6px 16px rgba(30,111,255,0.25)",
                    color: "#fff",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16 }}>
                    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.903 6.557H13.5a.75.75 0 0 1 0 1.5H4.182l-1.903 6.557a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.6-7.386.75.75 0 0 0 0-1.128A28.897 28.897 0 0 0 3.105 2.288Z" />
                  </svg>
                </button>
              </form>
            )}

            {infoMessage && (
              <div
                style={{
                  borderRadius: 20,
                  background: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  padding: "14px 16px",
                  boxShadow: "0 4px 16px rgba(245,158,11,0.1)",
                }}
              >
                <p className="text-xs leading-relaxed" style={{ color: "#92400E" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://img.icons8.com/3d-fluency/48/idea.png" alt="" width={16} height={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  {infoMessage}
                </p>
              </div>
            )}

            {error && (
              <p className="text-xs" style={{ color: "#EF4444" }}>{error}</p>
            )}
          </div>
        )}

        {/* ── Loading ── */}
        {phase === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-8">
            <div
              className="relative flex items-center justify-center"
              style={{ width: 100, height: 100 }}
            >
              <div
                className="absolute inset-0 rounded-full animate-clay-pulse-ring"
                style={{ background: "rgba(30,111,255,0.1)" }}
              />
              <div
                className="absolute animate-clay-spin"
                style={{
                  inset: 10, borderRadius: "50%",
                  border: "3px solid transparent",
                  borderTopColor: "#1E6FFF",
                  borderRightColor: "rgba(30,111,255,0.3)",
                }}
              />
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: 54, height: 54, borderRadius: 18,
                  background: "linear-gradient(145deg, #3B82FF, #1E6FFF)",
                  boxShadow: "0 4px 0 rgba(6,26,138,0.4), 0 8px 24px rgba(30,111,255,0.35)",
                }}
              >
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>P</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-base font-bold" style={{ color: "#111827" }}>
                Calculating your matches…
              </p>
              <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
                Running the recommendation engine
              </p>
            </div>
          </div>
        )}

        {/* ── Mini-rec result ── */}
        {phase === "result" && (
          <div className="flex flex-1 flex-col gap-6">
            {recError || !miniRec ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <p className="text-sm" style={{ color: "#6B7280" }}>
                  We couldn&apos;t generate a preview right now, but your answers are saved.
                </p>
                <button
                  onClick={() => router.push(`/deeper?session=${sessionId}`)}
                  className="clay-btn px-8 text-sm"
                  style={{ height: 52 }}
                >
                  Continue to aptitude check →
                </button>
              </div>
            ) : (
              <>
                <div className="clay-card p-6 relative overflow-hidden" style={{ background: "#FFFFFF", borderRadius: 28 }}>
                  {/* Top-right decoration/illustration */}
                  <div className="absolute -top-4 -right-4 w-24 h-24 opacity-15 pointer-events-none">
                    <img src="https://img.icons8.com/3d-fluency/180/combo-chart.png" alt="" className="object-contain w-full h-full" />
                  </div>

                  <div className="mb-6 flex items-start justify-between gap-3 relative z-10">
                    <div>
                      <span className="inline-block rounded-full bg-[#E5EFFF] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#1E6FFF] mb-1.5">
                        Early Estimate
                      </span>
                      <h2 className="text-2xl font-black tracking-tight" style={{ color: "#111827" }}>
                        Your top course matches
                      </h2>
                      <div className="h-1 w-20 bg-[#FFC72C] rounded-full mt-2" />
                    </div>

                    <div
                      className="shrink-0 rounded-2xl p-2.5 text-center flex flex-col items-center justify-center min-w-[76px]"
                      style={{
                        background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        boxShadow: "0 4px 12px rgba(245,158,11,0.08)",
                      }}
                    >
                      <div className="flex items-center gap-0.5 text-amber-500 mb-0.5">
                        <img src="https://img.icons8.com/3d-fluency/48/combo-chart.png" alt="" width={14} height={14} />
                      </div>
                      <p className="text-xl font-black leading-none text-[#D97706]">
                        {miniRec.overallConfidence}%
                      </p>
                      <p className="text-[8px] font-bold text-[#F59E0B] uppercase tracking-wider mt-1">confidence</p>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10">
                    {miniRec.top.map((c, i) => {
                      const iconUrl = getCareerIcon(c.leadsTo, c.domain);
                      return (
                        <div
                          key={c.courseId}
                          className="flex items-center gap-4 p-4"
                          style={{
                            background: "#F9FAFB",
                            borderRadius: 20,
                            border: "1.5px solid rgba(30,111,255,0.05)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                          }}
                        >
                          {/* Circular Icon Container with Floating Number Badge */}
                          <div className="relative shrink-0">
                            {/* Floating Number Badge */}
                            <span
                              className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center text-[10px] font-black text-white"
                              style={{
                                borderRadius: "50%",
                                background: i === 0 ? "#1E6FFF" : i === 1 ? "#818CF8" : "#F59E0B",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                                border: "1.5px solid #FFF",
                                zIndex: 10,
                              }}
                            >
                              {i + 1}
                            </span>
                            {/* Circle wrapper for 3D icon */}
                            <div
                              className="flex items-center justify-center"
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                                boxShadow: "inset 0 1px 2px rgba(255,255,255,0.8), 0 4px 10px rgba(99,102,241,0.08)",
                              }}
                            >
                              <img src={iconUrl} alt={c.name} width={36} height={36} className="object-contain" />
                            </div>
                          </div>

                          {/* Info and Progress */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 mb-1.5">
                              <h3 className="text-sm font-bold text-[#111827] truncate leading-snug">
                                {c.name}
                              </h3>
                              <span className="text-xs font-black text-[#1E6FFF] shrink-0">
                                {c.fitScore}%
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2.5 overflow-hidden rounded-full mb-2 bg-[#E5EDFF]">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${c.fitScore}%`,
                                  background: "linear-gradient(90deg, #3B82FF 0%, #1E6FFF 100%)",
                                  boxShadow: "0 1px 3px rgba(30,111,255,0.2)"
                                }}
                              />
                            </div>

                            {/* Where this course leads */}
                            <span
                              className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold"
                              style={{
                                background: "#EEF2FF",
                                color: "#6366F1",
                              }}
                            >
                              Leads to {c.leadsTo}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Info Callout */}
                  <div
                    className="mt-6 rounded-2xl p-4 flex gap-3 items-start"
                    style={{
                      background: "#EFF6FF",
                      borderLeft: "4px solid #1E6FFF",
                      boxShadow: "0 4px 12px rgba(30,111,255,0.03)",
                    }}
                  >
                    <img src="https://img.icons8.com/3d-fluency/96/idea.png" alt="" width={24} height={24} className="shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-[#1E6FFF] font-medium">
                      These are early estimates based on your quick answers. A short aptitude check — about 5 minutes —
                      will sharpen them significantly and explain the reasoning behind each match.
                    </p>
                  </div>
                </div>

                {/* Hand-written styled text and arrow pointing to CTA */}
                <div className="flex flex-col items-center justify-center mt-2 mb-1">
                  <span className="text-[#1E6FFF] font-extrabold italic text-sm tracking-wide">
                    Get more accurate results!
                  </span>
                  <div className="animate-bounce mt-1">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 14L12 21L5 14M12 3V20" stroke="#1E6FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Unified CTA Block */}
                <button
                  onClick={() => router.push(`/deeper?session=${sessionId}`)}
                  className="w-full relative overflow-hidden flex flex-col items-center justify-center p-5 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none cta-glow-pulse"
                  style={{
                    borderRadius: 24,
                    background: "linear-gradient(135deg, #3B82FF 0%, #1E6FFF 100%)",
                    border: "none",
                  }}
                >
                  <div className="flex items-center gap-4 w-full">
                    {/* Floating 3D Rocket */}
                    <div className="shrink-0">
                      <img src="https://img.icons8.com/3d-fluency/96/rocket.png" alt="" width={56} height={56} className="animate-pulse" />
                    </div>

                    <div className="flex-1">
                      <h4 className="text-white text-base font-black flex items-center gap-1">
                        Continue for more accurate results →
                      </h4>
                      
                      {/* Sub-badges row inside CTA */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold text-white bg-white/20 backdrop-blur-sm">
                          <img src="https://img.icons8.com/3d-fluency/48/clock.png" alt="" width={10} height={10} />
                          Takes about 5 mins
                        </span>
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold text-white bg-white/20 backdrop-blur-sm">
                          <img src="https://img.icons8.com/3d-fluency/48/present.png" alt="" width={10} height={10} />
                          100% Free
                        </span>
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold text-white bg-white/20 backdrop-blur-sm">
                          <img src="https://img.icons8.com/3d-fluency/48/user.png" alt="" width={10} height={10} />
                          No account needed
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Bottom Trust Badges */}
                <div className="flex items-center justify-center gap-4 mt-4 py-2 border-t border-dashed border-gray-300/40">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                    <img src="https://img.icons8.com/3d-fluency/48/checked.png" alt="" width={12} height={12} />
                    100% free
                  </span>
                  <span className="text-gray-300 text-xs">•</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                    <img src="https://img.icons8.com/3d-fluency/48/present.png" alt="" width={12} height={12} />
                    No spam
                  </span>
                  <span className="text-gray-300 text-xs">•</span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                    <img src="https://img.icons8.com/3d-fluency/48/heart.png" alt="" width={12} height={12} />
                    No commitment
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
