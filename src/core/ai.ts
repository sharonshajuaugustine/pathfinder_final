import "server-only";
import { chat, extractJson, type ChatMessage } from "@/lib/groq";
import type { ProfileDelta } from "./profile-builder";
import type { RecommendationResult } from "@/types/recommendation";
import { INTEREST_CLUSTERS, APTITUDES, PERSONALITY_TRAITS } from "@/types/profile";

// ---------------------------------------------------------------------------
// AI role boundary (enforced here):
//   interviewer  -> asks the next career-counselling question for a target stage
//   extractor    -> maps the student's reply to a STRICT ProfileDelta (JSON)
//   explainer    -> writes prose OVER engine facts; invents nothing
//
// The AI never scores, ranks, or names a career/course/fee/exam of its own.
// ---------------------------------------------------------------------------

const SYSTEM_BASE = `You are a warm, friendly career counsellor chatting with a Plus Two student in Kerala, India (age 16–18). Your ONLY job is to ask questions that uncover which course or field this student should pursue after Plus Two. You do NOT recommend careers — the engine does that at the end.

HARD RULES — follow every single one, every turn:
1. Ask exactly ONE question per turn. Always end with a question mark.
2. Each question must be 30 words or fewer. Simple, everyday words only.
3. ALWAYS build on their last answer — acknowledge it in one short phrase, then go deeper into what they said.
4. Never repeat a topic already answered. Read the full history before forming a question.
5. If the student is vague ("I don't know", "not sure"), give 3–4 concrete everyday examples to help them choose.
6. Use hobbies, activities, school subjects, and scenarios to discover interests. Which subjects they enjoy or score well in is a STRONG, reliable clue — feel free to ask about it directly (e.g. "Which subjects do you enjoy or do best in?").
7. Never mention specific colleges, course fees, or exam cut-offs.
8. Never recommend a career inside the chat — the engine does that.
9. Focus on: (a) which subjects/fields they enjoy and which course excites them, (b) what kind of work they picture doing day-to-day, (c) their plan after school — study further, job, govt exam, or business, and (d) practical limits — budget and location.
10. Use their STREAM (given in your context) to keep questions realistic — a Biology student's options differ from a Commerce student's. Ask within their realistic path, never suggest a path their stream rules out.
11. EXAM RELEVANCE RULE: Only mention entrance exams listed under RELEVANT EXAMS in your context block. Never say CLAT to a bio/science student. Never say NEET to a commerce/law student.`;

const STAGE_GOALS: Record<string, string> = {
  interests: `STAGE — Discover Their Interest and Which Course Fits
Your goal: find out which subjects they enjoy and which specific field or course this student is genuinely drawn to.

KEY APPROACH: Build every question on their previous answer. Keep narrowing down:
• If they say "I like helping people" → ask what kind (caring for the sick, teaching, advising, social work?).
• If they say "technology" → ask what specifically (building apps, games, AI, hardware?).
• If they name a subject → ask what they enjoy about it and what they'd like to do with it.

ASK ABOUT SUBJECTS: Which subjects a student enjoys or scores well in is one of the most reliable signals. Early in the conversation, ask something like "Which subjects do you enjoy most or do best in?" — their answer strongly guides which courses fit.

USE THEIR STREAM (in your context): Keep questions inside their realistic options. A Biology student → medical, allied health, biotech, research, pharmacy, agriculture. A Maths student → engineering, tech, architecture, data. A Commerce student → business, finance, accounting, management, economics. A Humanities student → law, civil services, media, psychology, design, teaching. Never suggest a path their stream rules out.

IMPORTANT: If the student is vague or says "still figuring it out", use subjects and everyday activities — e.g. "Which subjects feel easiest or most enjoyable to you?" or "What do you spend the most time on after school?"

IMPORTANT: If the student said their family has a preference, ask what the STUDENT personally enjoys, not what the family wants.

Signals to collect (first missing one first):
1. Which subjects do they enjoy or do well in? (this also tells us their aptitude)
2. Which specific field excites them, within their stream's realistic options?
3. What kind of daily work appeals to them? (caring for patients, writing code, arguing cases, teaching, building, selling, creating)
4. Have they already named a career? → Ask what draws them to it and what they picture doing daily.

Good question styles:
• "Which subjects do you enjoy most or score best in?"
• "You're in [stream] — out of these paths [give 3-4 realistic to their stream], which feels most like you?"
• "When you help someone, what kind of help do you enjoy giving most?"
• "What's one thing — a subject, hobby, or task — that you lost track of time doing?"

Stop once you know which subjects/field excite them AND what kind of daily work appeals to them.`,

  aspiration: `STAGE — Their Plan, Goals, and Career Values
Find out what the student wants to achieve, how they plan to get there, and what matters most to them.

Signals to collect (first missing one first):
1. Main plan: study for a degree (BTech / BSc / BA / BBA), get a job quickly, prepare for govt exams (PSC / UPSC), or start a business?
2. What matters most in a career: high salary and growth, job stability and security, following their passion, or government/public service?
3. If studying: which course or stream are they thinking about? (e.g. BTech CS, MBBS, BCA, BA Psychology, B.Com)
4. Entrance exam: are they okay preparing for one? Only mention exams from RELEVANT EXAMS in your context. If none listed, ask about CUET only.

Good question styles:
• "After Plus Two, what's your plan — study for a degree, get a job, prepare for PSC/UPSC, or start something of your own?"
• "What matters most to you in a career — high salary, job security, doing work you're passionate about, or a government role?"
• "Do you have a specific course in mind — like BTech, MBBS, BCA, BBA, or something else?"
• "Are you willing to prepare for an entrance exam, or would you prefer a course without one?"`,

  constraints: `STAGE — Practical Limits
Find out budget and location constraints gently.

Signals to collect (first missing one first):
1. Budget: family comfortable paying for a degree, manageable with effort, or need a scholarship/loan?
2. Location: open to studying in another state or abroad, or prefer to stay in Kerala?
3. Family expectations: does the family have strong views on the career choice? SKIP if FAMILY EXPECTATIONS ALREADY CAPTURED in context.

Good question styles:
• "Is your family comfortable paying for a degree, or would you need a scholarship or loan to make it work?"
• "Are you open to studying in another state or abroad, or would you prefer to stay in Kerala?"
• "Does your family have a strong opinion about which direction you should take?"

Be gentle. If they don't want to answer, move on.`,
};

export interface StudentContext {
  stream?: string;
  percentage?: number;
  studentName?: string;
  // Career the student explicitly said they want (e.g. "doctor", "software engineer").
  // When set, the AI must NOT ask "what do you want to be?" — it already knows.
  statedCareer?: string;
  knownGoal?: string;
  knownBudget?: string;
  knownLocation?: string;
  detectedInterests?: string[];
  strongSubjects?: string[];
  careerPriorities?: string[]; // what the student values: high_salary, job_security, passion, government
  // True when at least one personality/work-style signal has been captured.
  // Prevents the AI from asking another alone/team or desk/active question.
  hasPersonalityData?: boolean;
  // Profile sections still empty — the AI uses this to focus its next question.
  remainingGaps?: string[];
  // Raw gap ID of the top remaining gap (e.g. "budget", "location"). Used to
  // look up HARDCODED_CONSTRAINTS without needing to parse the prompt string.
  topGapId?: string;
  // Entrance exams relevant to this student's detected interests. The AI MUST
  // only mention exams from this list — prevents CLAT being asked to bio students.
  relevantExams?: string[];
  // True if at least one family expectation has been captured — prevents re-asking.
  capturedFamilyExpectations?: boolean;
  // Interest cluster known from the 5-question start quiz but not yet deepened
  // via conversation (value 0.2–0.59). AI should explore WHAT SPECIFICALLY draws
  // them to this cluster rather than closing the gap or re-asking the same question.
  shallowInterest?: string;
  // True when the student's previous answer was too vague to capture, so the AI
  // should rephrase the SAME gap with concrete examples rather than move on.
  followUp?: boolean;
}

// Structured choice returned by the AI — label is what the student sees (button
// text), value is the semantic key the server uses to update the profile.
export interface AIChoice {
  label: string;
  value: string;
}

// Constraint-gap questions use fixed choices — no AI call needed.
// Values must match the VALUE SCHEMA in the prompt so the existing extractor still works.
const HARDCODED_CONSTRAINTS: Record<string, { question: string; choices: AIChoice[] }> = {
  budget: {
    question: "College expenses can vary a lot depending on the course. How would your family prefer to handle education costs?",
    choices: [
      { label: "We prefer keeping costs low (looking for scholarships or government colleges)", value: "low" },
      { label: "We can manage moderate fees for a good course", value: "medium" },
      { label: "Budget is flexible if the course is really good", value: "no_constraint" },
      { label: "We haven't decided on a budget yet", value: "medium" },
    ],
  },
  location: {
    question: "Where would you prefer to study for your degree?",
    choices: [
      { label: "I want to study within Kerala only", value: "kerala" },
      { label: "I am open to studying anywhere in India", value: "india" },
      { label: "I would love to go abroad to study", value: "abroad" },
      { label: "It depends on where the best course is", value: "india" },
    ],
  },
  family: {
    question: "Do your parents or family have a specific career path in mind for you?",
    choices: [
      { label: "No, they fully support whatever I choose", value: "none" },
      { label: "They have a few suggestions/preferences", value: "some_preference" },
      { label: "Yes, they have very strong expectations for me", value: "family_preference" },
      { label: "We haven't really discussed it yet", value: "none" },
    ],
  },
  workstyle: {
    question: "What kind of daily work setting matches your vibe the most?",
    choices: [
      { label: "Working directly with people (patients, students, clients)", value: "social" },
      { label: "Working independently (coding, writing, or researching)", value: "analytical_solo" },
      { label: "Being outdoors, doing fieldwork, or working hands-on", value: "practical_outdoor" },
      { label: "A healthy mix of both teamwork and solo work", value: "mixed" },
    ],
  },
};

// --- interviewer ---------------------------------------------------------------
export async function nextQuestion(params: {
  stage: string;
  history: ChatMessage[];
  studentContext?: StudentContext;
}): Promise<{ content: string; choices: AIChoice[]; model: string; promptTokens?: number; outputTokens?: number }> {
  const isFirstQuestion = params.history.length === 0;

  const goal =
    STAGE_GOALS[params.stage] ??
    "Continue understanding the student's direction, goals, and practical constraints after Plus Two.";

  // First question: hardcoded only for cold-start (no prior context).
  // When the student comes from the 5-question start quiz they already gave us
  // stream / subjects / interest / goal / priorities — skip the generic opener
  // and let the AI generate a personalised question that dives deeper.
  const hasStartContext = !!(
    params.studentContext?.shallowInterest ||
    params.studentContext?.detectedInterests?.length ||
    params.studentContext?.strongSubjects?.length
  );
  if (isFirstQuestion && !hasStartContext) {
    return {
      content: "Hi! Do you already have some idea of what you'd like to do after Plus Two, or are you still figuring it out?",
      choices: [
        { label: "I already have a career in mind", value: "has_career" },
        { label: "Still figuring it out", value: "figuring_out" },
        { label: "A few options, not sure which", value: "few_options" },
        { label: "My family has a preference", value: "family_preference" },
      ],
      model: "hardcoded",
    };
  }

  // Constraint gaps (budget / location / family / workstyle) use fixed choices —
  // no AI call needed, answers are predictable and fast.
  const topGap = params.studentContext?.topGapId;
  if (topGap && HARDCODED_CONSTRAINTS[topGap]) {
    const hc = HARDCODED_CONSTRAINTS[topGap];
    return { content: hc.question, choices: hc.choices, model: "hardcoded" };
  }

  // Build context block: what the AI already knows, and what gaps remain.
  // Stream/marks are background only — never the basis of a question.
  const ctx = params.studentContext;
  const contextLines: string[] = [];

  // Most critical first — statedCareer stops the AI from re-asking career choice
  if (ctx?.statedCareer) {
    contextLines.push(
      `ALREADY KNOWN — they said they want to become: "${ctx.statedCareer}". ` +
      `Do NOT ask "what do you want to be?" or "do you have a career in mind?" — you know this. ` +
      `Explore it: what draws them to it, what they picture doing day-to-day, ` +
      `the strengths it needs, or gently widen to closely related fields.`
    );
  }
  if (ctx?.studentName) {
    contextLines.push(`STUDENT NAME: ${ctx.studentName}. You may address them by name once or twice naturally.`);
  }
  if (ctx?.stream) {
    contextLines.push(
      `Their Plus Two stream is ${ctx.stream}. Use this to keep your questions realistic — ` +
      `only ask about fields and courses that someone from this stream can actually pursue. ` +
      `Do NOT suggest paths their stream rules out.`
    );
  }
  if (ctx?.knownGoal) {
    contextLines.push(`Goal orientation already captured (${ctx.knownGoal}) — don't re-ask job-soon vs higher-study.`);
  }
  if (ctx?.knownBudget) {
    contextLines.push(`Budget comfort already captured (${ctx.knownBudget}) — don't re-ask it.`);
  }
  if (ctx?.knownLocation) {
    contextLines.push(`Location preference already captured (${ctx.knownLocation}) — don't re-ask it.`);
  }
  if (ctx?.strongSubjects?.length) {
    contextLines.push(
      `STRONG SUBJECTS ALREADY CAPTURED (${ctx.strongSubjects.join(", ")}) — ` +
      `do NOT ask "which subjects do you enjoy/score best in?" or any variation of it. ` +
      `This gap is CLOSED. Move to the next gap in the GAPS list.`
    );
  }
  if (ctx?.shallowInterest) {
    contextLines.push(
      `INTEREST PARTIALLY KNOWN — the student picked "${ctx.shallowInterest}" in a quick pre-quiz. ` +
      `This is surface-level only. Your job is to DEEPEN it: ask what specifically draws them to ` +
      `"${ctx.shallowInterest}" — e.g. a concrete activity, role, or daily task within that field. ` +
      `Do NOT re-ask "what field do you like?" — you already know. Narrow it down with 4 specific ` +
      `activity-level choices (e.g. "Diagnosing illness" vs "Research in a lab" vs "Working in a pharmacy"). ` +
      `The value for each choice should still be the most fitting interest cluster ID.`
    );
  }
  if (ctx?.detectedInterests?.length) {
    contextLines.push(
      `INTEREST DEEPLY CAPTURED (${ctx.detectedInterests.join(", ")}). ` +
      `Do NOT ask about fields, subjects, or what they enjoy — this gap is CLOSED. ` +
      `Do NOT drill into sub-specialties. Your next question MUST target a different GAP.`
    );
  }
  if (ctx?.careerPriorities?.length) {
    contextLines.push(
      `CAREER PRIORITIES already captured (${ctx.careerPriorities.join(", ")}) — do NOT ask what matters most in a career again.`
    );
  }
  if (ctx?.hasPersonalityData) {
    contextLines.push(
      `Work-style preferences already captured — do NOT ask another alone/team, ` +
      `structured/creative, or desk/active question.`
    );
  }
  if (ctx?.relevantExams?.length) {
    contextLines.push(
      `RELEVANT EXAMS for this student (based on their interests): ${ctx.relevantExams.join(", ")}. ` +
      `Only mention exams from this list. Never mention CLAT unless it appears here. Never mention NEET unless it appears here.`
    );
  } else {
    contextLines.push(
      `No interest-specific exams identified yet. If asking about entrance exams, mention CUET only — do NOT name NEET, JEE, CLAT, or KEAM.`
    );
  }
  if (ctx?.capturedFamilyExpectations) {
    contextLines.push(
      `FAMILY EXPECTATIONS ALREADY CAPTURED — do NOT explore family preferences further. ` +
      `Even if the family has a preference, ask what the STUDENT personally enjoys and wants — not what the family wants.`
    );
  }
  if (ctx?.followUp) {
    contextLines.push(
      `FOLLOW-UP NEEDED — the student's last answer did not fill GAP #1. ` +
      `Do NOT repeat or rephrase the same question. Try a completely different angle that approaches the same gap from another direction:\n` +
      `  • If they said "I don't have any" or "I don't know" about subjects → ask what subject feels LEAST boring to them, or what they are best at even if they don't love it, or what they do after school.\n` +
      `  • If they said "I don't know" about their interest or goal → give a completely different scenario or activity as an example, or ask what kind of people they admire.\n` +
      `  • If they said they are still figuring it out → try narrowing: "What do you spend most time on when you're not studying?"\n` +
      `  A different angle means a DIFFERENT QUESTION TYPE — not just different words for the same question.`
    );
  }
  if (ctx?.remainingGaps?.length) {
    contextLines.push(
      `GAPS — these profile areas are still empty. Your next question should fill ONE of these (most important first):\n` +
      ctx.remainingGaps.map((g, i) => `  ${i + 1}. ${g}`).join("\n")
    );
  }

  const contextBlock = contextLines.length
    ? `\n\n[What you already know — read before forming your next question]\n${contextLines.map((l) => `• ${l}`).join("\n")}`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_BASE}${contextBlock}\n\n${goal}`,
    },
    ...params.history,
    {
      role: "user",
      content:
        'Respond with valid JSON: { "question": "...", "choices": [{ "label": "...", "value": "..." }, ...] }\n\n' +
        "STEP 1 — THE MOST IMPORTANT RULE: Your next question MUST be about GAP #1 ONLY. The GAPS list (above, in priority order) decides your topic. NOT the student's last answer. If GAP #1 is 'goal', you ask about goal. If it is 'budget', you ask about budget. Do not let the conversation drift onto any other topic.\n\n" +
        "STEP 2 — NEVER re-ask a captured topic. If the context says a dimension is ALREADY CAPTURED (interest known, subjects known, goal known), you are FORBIDDEN from asking anything more about it. Even if their last answer was interesting, move to GAP #1. Re-exploring a captured topic is the single worst mistake you can make.\n\n" +
        "STEP 3 — NEVER drill into sub-details. Stay at the level of 'choose a direction'. Do NOT ask 'which hospital ward?', 'which programming language?', 'which type of patients?' — those are too deep. One question per topic, then move on. If GAP #1 is already broadly answered by something they said, treat it as captured and the system will give you the next gap.\n\n" +
        "STEP 4 — FOLLOW-UP mode (only when 'FOLLOW-UP NEEDED' appears in context): the student's last answer to GAP #1 was not enough. Do NOT rephrase the same question — try a genuinely different angle. If they said they have no subjects they like, ask what they are best at even if they don't enjoy it, or what they do after school. If they said 'I don't know' about their interest, give a concrete scenario from a different direction. Build on exactly what they told you — a different question type, not the same question with new words.\n\n" +
        "STEP 5 — Check history: never repeat a question already asked in this conversation. Never repeat a topic.\n\n" +
        'STEP 6 — Write the JSON. Each choice has two fields:\n' +
        '  • "label": the button text the student sees — must be a short, concrete phrase (max 10 words)\n' +
        '  • "value": the semantic key the server uses to update the profile (see VALUE SCHEMA below)\n\n' +
        '  "question": A single, direct question about GAP #1. Max 25 words. MUST end with "?". In FOLLOW-UP mode you may open with one very short phrase that acknowledges what they said (e.g. "That\'s okay —" or "Fair enough —") before asking from the new angle. Otherwise no preamble.\n' +
        '  "choices": exactly 4 options that DIRECTLY answer your question.\n\n' +
        "VALUE SCHEMA — use the correct 'value' for GAP #1:\n" +
        "  GAP: subjects → value = exact subject name. Stream defaults:\n" +
        "    Science (Bio): Biology, Chemistry, Physics, Mathematics\n" +
        "    Science (Maths/CS): Mathematics, Physics, Computer Science, Chemistry\n" +
        "    Commerce: Accountancy, Business Studies, Economics, Mathematics\n" +
        "    Humanities: History, English, Psychology, Economics\n" +
        "  GAP: interest → value = one of these 12 cluster IDs ONLY:\n" +
        "    health_medicine, technology_coding, business_money, science_research,\n" +
        "    design_visual, helping_teaching, law_justice, building_engineering,\n" +
        "    media_communication, nature_agriculture, defence_adventure, numbers_analysis\n" +
        "    IMPORTANT: label must be a concrete activity phrase (e.g. 'Building apps and websites',\n" +
        "    'Caring for sick people', 'Growing crops and farming') — NEVER a bare field name.\n" +
        "    Tailor choices to the student's stream and subjects. Include clusters most likely to fit.\n" +
        "  GAP: goal → value = one of: higher_study, job_soon, business, government\n" +
        "    Suggested labels: 'Study a degree further', 'Get a job quickly',\n" +
        "    'Prepare for govt exams (PSC/UPSC)', 'Start a business or project'\n" +
        "  GAP: priorities → value = one of: high_salary, job_security, passion, government_service\n" +
        "    Suggested labels: 'High salary and fast growth', 'Stable job and security',\n" +
        "    'Work I am passionate about', 'Government or public service'\n" +
        "  GAP: budget → value = one of: no_constraint, medium, low\n" +
        "    Suggested labels: 'Family can manage it', 'Manageable with effort', 'Need a scholarship or loan'\n" +
        "    Add a 4th option with value 'medium' and label 'Not sure about costs'\n" +
        "  GAP: location → value = one of: kerala, india, abroad\n" +
        "    Suggested labels: 'Stay in Kerala', 'Anywhere in India', 'Open to studying abroad'\n" +
        "    Add a 4th option with value 'india' and label 'Depends on the course'\n" +
        "  GAP: family → value = one of: none, some_preference, family_preference\n" +
        "    Suggested labels: 'Fully supportive of my choice', 'They have some preferences',\n" +
        "    'They have strong expectations', 'Haven't discussed it yet'\n" +
        "    4th option: value = 'none', label = \"Haven't discussed it yet\"\n" +
        "  GAP: workstyle → value = one of: social, analytical_solo, practical_outdoor, mixed\n" +
        "    Suggested labels: 'With people (patients / students / clients)',\n" +
        "    'Solo work (coding / writing / research)', 'Outdoors / fieldwork / hands-on', 'Mix of both'\n\n" +
        "GUARDRAILS:\n" +
        "• One question only. Never recommend careers or colleges.\n" +
        "• The GAPS list is authoritative and ordered. GAP #1 is your ONLY topic. Never re-explore a captured topic.\n" +
        "• Never drill into sub-details of a topic (no 'which exact...', 'which specific kind of...').\n" +
        "• If statedCareer is known, do not ask 'what do you want to be?' — target the next gap instead.\n" +
        "• If the student said their FAMILY has a preference: ask what the STUDENT personally enjoys.",
    },
  ];
  const { data, raw, model } = await extractJson<{ question: string; choices?: AIChoice[] }>(messages, { temperature: 0.5 });
  const rawChoices = Array.isArray(data?.choices) ? data.choices : [];
  const choices = rawChoices
    .filter((c): c is AIChoice => c !== null && typeof c === "object" && typeof c.label === "string" && typeof c.value === "string")
    .slice(0, 6);
  return {
    content: data?.question?.trim() || raw.trim() || "Could you share a bit more about what interests you?",
    choices,
    model,
  };
}

// --- extractor -----------------------------------------------------------------
// Returns a ProfileDelta. Caller MUST treat null as "extraction failed" and not
// corrupt the profile. Validation against controlled vocabulary happens here.

// Pure filler / confirmation replies carry no standalone structured signal —
// their meaning lives entirely in the question they answer. Extracting from them
// makes the model HALLUCINATE a full profile (verified: "observing" produced
// fake aptitude scores + strong subjects). We skip extraction for these and let
// the interviewer follow up instead.
const FILLER_REPLIES = new Set([
  "yes", "no", "yeah", "yep", "yup", "nope", "ok", "okay", "k", "sure", "fine",
  "maybe", "idk", "dunno", "nothing", "none", "hmm", "hm", "good", "nice", "cool",
  "i dont know", "i don't know", "i dont knw", "not sure", "no idea", "whatever",
  "anything", "everything", "all", "yes ofcourse", "yes of course", "of course",
]);

// Strip punctuation/digits but keep letters of ANY script (so Malayalam replies
// survive). Avoids unicode property escapes for older compile targets.
function normalizeReply(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`()\[\]{}\-_/\\|@#$%^&*+=~<>0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Decide whether a reply is substantive enough to extract from. A reply must
// either be a full sentence (>= 4 words) OR contain a real word (>= 4 chars)
// that isn't a vague directional filler. The firewall against single-word
// hallucination (e.g. "observing" producing a fake aptitude profile).
function isExtractable(reply: string): boolean {
  const norm = normalizeReply(reply);
  if (!norm) return false;
  if (FILLER_REPLIES.has(norm)) return false;
  const wordCount = norm.split(" ").filter(Boolean).length;
  if (wordCount >= 4) return true;
  // Short replies (1-3 words): extractable only if they contain a real word
  // (4+ non-space chars, any script) that is not a vague directional word like
  // "observing" / "overall" / "indoor" — those only mean something with the
  // question they answer.
  return /\S{4,}/.test(norm) && !VAGUE_SHORT_WORDS.has(norm);
}

// Short directional answers that are meaningless without their question.
const VAGUE_SHORT_WORDS = new Set([
  "observing", "observe", "overall", "indoor", "indoors", "outdoor", "outdoors",
  "alone", "team", "group", "lab", "field", "theory", "practical", "both", "either",
  "university", "college", "first one", "second one", "the first", "the second",
  "this one", "that one", "left", "right", "a", "b", "c", "d", "option a", "option b",
]);

// ---------------------------------------------------------------------------
// FOLLOW-UP — a short (2–3 question) adaptive step shown after the start quiz.
// It reacts to what the student typed/picked and digs one level deeper into
// their interests, so the profile (and the aptitude section after it) is sharper.
// Each choice value is an interest cluster ID; the route saves it at 0.7.
// ---------------------------------------------------------------------------
export async function followUpQuestion(params: {
  index: number; // 0-based: which follow-up question to generate
  streamLabel?: string;
  strongSubjects?: string[];
  statedCareer?: string;
  topInterests?: string[]; // human labels of their strongest interests
  freeTexts?: string[];    // raw phrases the student typed earlier
}): Promise<{ content: string; choices: AIChoice[]; model: string }> {
  const focus = [
    "Build on the interest or activity they showed strongest. Ask which PART of that field they would enjoy doing the most.",
    "Help them compare a few real career directions that fit what they like. Ask which kind of work appeals to them most.",
    "Ask what kind of day-to-day work they picture themselves doing, to confirm their direction.",
  ][Math.min(params.index, 2)];

  const known = [
    params.streamLabel ? `Stream: ${params.streamLabel}` : "",
    params.strongSubjects?.length ? `Strong subjects: ${params.strongSubjects.join(", ")}` : "",
    params.topInterests?.length ? `Interests they showed: ${params.topInterests.join(", ")}` : "",
    params.statedCareer ? `They mentioned wanting to be: ${params.statedCareer}` : "",
    params.freeTexts?.length ? `They typed: "${params.freeTexts.join('"; "')}"` : "",
  ].filter(Boolean).join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a warm career counsellor talking to a Plus Two student (age 16–18) in Kerala, India. " +
        "Use simple, everyday English a 16-year-old understands. Return only valid JSON — no extra text.",
    },
    {
      role: "user",
      content:
        `Here is what we already know about the student:\n${known || "(very little — keep it general)"}\n\n` +
        `Ask ONE friendly follow-up question (a full sentence, about 8–18 words) that builds on what they told us. ` +
        `${focus}\n` +
        `Do NOT re-ask their stream, subjects, budget, or goal — we already have those.\n\n` +
        `RULES FOR THE 4 CHOICES (very important — the bad example below is why):\n` +
        `- Give EXACTLY 4 choices. Each must be a COMPLETE, concrete activity written as a short phrase ` +
        `(about 4–9 words). No one-word fragments.\n` +
        `- All 4 choices must answer the SAME question and be the same KIND of thing (parallel options).\n` +
        `- Make them clearly different from each other so the answer tells us something new.\n` +
        `- Keep them realistic for the student's stream.\n` +
        `GOOD example — Q: "When you build something with code, what do you enjoy most?"\n` +
        `  choices: "Designing how the screen looks" / "Solving tricky logic problems" / ` +
        `"Making the app fast and reliable" / "Working with data and numbers"\n` +
        `BAD example (never do this) — Q: "Code solo or team?" choices: "Solo" / "Team" / "Design" / "Analyse" ` +
        `(too short, and the choices don't all answer the question).\n\n` +
        `Each choice "value" MUST be the single best-fitting interest cluster ID from this list ONLY:\n` +
        `  ${INTEREST_CLUSTERS.join(", ")}\n\n` +
        `Return exactly: { "question": "...", "choices": [ { "label": "...", "value": "technology_coding" }, ... ] }`,
    },
  ];

  const { data, model } = await extractJson<{ question: string; choices: AIChoice[] }>(messages, { temperature: 0.6 });
  const question = data?.question?.trim();
  const choices = Array.isArray(data?.choices) ? data!.choices.filter((c) => c?.label && c?.value) : [];
  if (!question || choices.length < 2) throw new Error("follow-up generation failed");
  return { content: question, choices: choices.slice(0, 4), model };
}

export async function extractProfileDelta(params: {
  reply: string;
  stage?: string;
  precedingQuestion?: string;
}): Promise<{
  delta: ProfileDelta | null;
  raw: string;
  model: string;
}> {
  const { reply, stage, precedingQuestion } = params;

  // Gate: never extract from contentless replies — prevents hallucination.
  if (!isExtractable(reply)) {
    return { delta: null, raw: "", model: "skipped-low-content" };
  }

  const isReflection = stage === "reflection";

  const schemaHint = {
    interests: `object mapping any of [${INTEREST_CLUSTERS.join(", ")}] to 0..1.
PRIMARY RULE: only set from interests the student EXPLICITLY states they enjoy or are drawn to.
ENJOYMENT MAPPING (when they say they LIKE/LOVE/PLAY/ENJOY something, set that cluster ~0.7):
  sports / football / cricket / basketball / badminton / hockey / athletics / gym / fitness / playing games / coaching → defence_adventure
  cooking / baking / food / hospitality → design_visual
  drawing / painting / music / dance / acting / photography / design → design_visual
  helping / teaching / caring for people / social work → helping_teaching
  computers / coding / gaming tech / gadgets → technology_coding
EXCEPTION — stated career inference: if the student says they WANT to BE or BECOME a specific career, you MAY set the PRIMARY interest cluster for that career at 0.7 (even if they didn't say "I enjoy X"). Use ONLY these mappings:
  doctor / nurse / dentist / surgeon / hospital / medical / MBBS → health_medicine
  software / programmer / coder / developer / computer science / IT / game developer / app developer / AI → technology_coding
  lawyer / advocate / judge / legal / law → law_justice
  teacher / educator / professor / coaching → helping_teaching
  civil engineer / mechanical engineer / architect / construction / structural → building_engineering
  scientist / researcher / physicist / chemist / biologist / marine biologist / microbiologist / biotechnologist → science_research
  journalist / media / director / writer / content creator / actor / filmmaker → media_communication
  business / entrepreneur / startup / CA / finance → business_money
  army / navy / air force / police / defence / pilot → defence_adventure
  farmer / botanist / ecologist / wildlife / veterinarian → nature_agriculture
  designer / artist / animator / graphic / UX → design_visual
  accountant / banker / economist / actuary / data analyst / statistician → numbers_analysis
Do this ONLY for explicit "I want to be/become X" statements. For vague mentions, do NOT infer.`,
    aptitude: `object mapping any of [${APTITUDES.join(", ")}] to 0..100 — ONLY if the student literally says they are good or bad at a named subject/skill. Otherwise omit entirely.`,
    personality: `object mapping any of [${PERSONALITY_TRAITS.join(
      ", "
    )}] to -1..1 — ONLY from how they describe their own working style or preferences. Do not invent.`,
    academic: `{ strongSubjects: string[], weakSubjects: string[] } — ONLY subjects the student literally names as easy/hard. If they name no subject, return empty arrays.`,
    aspiration: `{ goalOrientation: 'job_soon'|'higher_study'|'business'|'government', riskAppetite: 0..1, ambitionLevel: 0..1, statedCareer: string }
  goalOrientation: "want a degree / study more / BTech / Masters / willing to take NEET or JEE" → higher_study; "earn quickly / job soon / no big exam / diploma" → job_soon; "own company / business / startup" → business; "government job / PSC / UPSC / civil services" → government.
  Entrance exam willingness: "willing to take NEET/JEE/KEAM/CLAT" → also set ambitionLevel: 0.8 and goalOrientation: higher_study. "prefer no entrance exam / don't want big exams" → set timeToIncomeNeed: 'urgent' in constraints.
  statedCareer: the EXACT job the student says they WANT to become or dream of (e.g. "game developer", "veterinarian", "pilot"). Set ONLY for a career they want — NEVER for one they reject or dislike.`,
    constraints: `{ budgetBand: 'low'|'medium'|'high'|'no_constraint', locationPref: 'kerala'|'india'|'abroad', timeToIncomeNeed: 'urgent'|'flexible', familyExpectations: string[] }
  budgetBand: "comfortable / no problem / family can pay easily" → no_constraint; "manageable / can manage with effort" → medium; "tight / need scholarship / loan" → low; "money not an issue / willing to spend" → high.
  locationPref: "Kerala only / stay near home / won't move" → kerala; "anywhere in India / open to other states" → india; "open to abroad / foreign / international" → abroad.
  familyExpectations: list specific careers or fields the family wants or forbids — e.g. ["family wants doctor", "family says no arts"]. Only include if explicitly stated.`,
  };

  const contextBlock = precedingQuestion
    ? `\n\nThe student was answering this question:\n"${precedingQuestion}"\nInterpret their reply in the context of THIS question.`
    : "";

  // In the reflection stage the counsellor asks what the student does NOT want.
  // So any field/career they name here is a REJECTION — it must never be recorded
  // as an interest or as a wanted career. This kills the negation bug where
  // "I don't want computer science" wrongly produced technology_coding: 1.0.
  const rejectionRule = isReflection
    ? `\n\nIMPORTANT — REJECTION CONTEXT: The student is being asked what they do NOT want. Any career, field, or subject they name here is something they DISLIKE or want to AVOID. Do NOT record it as an interest. Do NOT record it as statedCareer. For a clearly disliked interest area, you may set its interest value to 0. Only capture genuinely new POSITIVE information (e.g. a family expectation, or a dream career they say they DO want).`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You extract structured career-counselling signals from a Kerala Plus Two student's reply. ` +
        `Output ONLY valid JSON matching the schema. Omit every field not clearly and explicitly stated in THIS reply. ` +
        `Be extremely conservative: if the student did not literally say something, do NOT include it. Never guess aptitude numbers, subjects, budget, or location from vague wording. ` +
        `An empty object {} is the correct answer when nothing concrete was stated.\n\n` +
        JSON.stringify(schemaHint) +
        contextBlock +
        rejectionRule,
    },
    { role: "user", content: reply },
  ];
  const { data, raw, model } = await extractJson<ProfileDelta>(messages);
  return { delta: sanitizeDelta(data, { isReflection }), raw, model };
}

// Defensive validation: strip invalid keys and clamp out-of-range values.
// This is the firewall between AI output and the scoring engine.
//
// In the reflection stage the student is naming things they do NOT want. To
// guarantee a rejection can never become a positive signal — even if the model
// ignores the prompt — we hard-drop interests/aptitude/academic/personality from
// reflection deltas and keep only aspiration (a stated dream career) + constraints.
function sanitizeDelta(
  data: ProfileDelta | null,
  opts: { isReflection?: boolean } = {}
): ProfileDelta | null {
  if (!data || typeof data !== "object") return null;
  const out: ProfileDelta = {};
  const allowSignals = !opts.isReflection;

  if (allowSignals) {
    // Cap at 0.5 — deep interest (0.6+) only reaches that level through button
    // clicks (pendingChoiceToProfile → 0.8) or career name inference
    // (inferInterestFromCareer → 0.7). Free-text answers like "I like planting"
    // are shallow signals that need chat deepening via the shallowInterest path.
    if (data.interests) out.interests = pick(data.interests, INTEREST_CLUSTERS as readonly string[], 0, 0.5);
    if (data.aptitude) out.aptitude = pick(data.aptitude, APTITUDES as readonly string[], 0, 100);
    if (data.personality) out.personality = pick(data.personality, PERSONALITY_TRAITS as readonly string[], -1, 1);

    if (data.academic && typeof data.academic === "object") {
      out.academic = {
        strongSubjects: Array.isArray(data.academic.strongSubjects)
          ? data.academic.strongSubjects.slice(0, 8)
          : [],
        weakSubjects: Array.isArray(data.academic.weakSubjects)
          ? data.academic.weakSubjects.slice(0, 8)
          : [],
      };
    }
  }

  if (data.aspiration && typeof data.aspiration === "object") {
    const asp: ProfileDelta["aspiration"] = {};
    if (data.aspiration.goalOrientation) asp.goalOrientation = data.aspiration.goalOrientation;
    if (typeof data.aspiration.riskAppetite === "number") {
      asp.riskAppetite = Math.min(1, Math.max(0, data.aspiration.riskAppetite));
    }
    if (typeof data.aspiration.ambitionLevel === "number") {
      asp.ambitionLevel = Math.min(1, Math.max(0, data.aspiration.ambitionLevel));
    }
    // statedCareer: a clean, short free-text career name the student WANTS.
    // Must be a real career name (≤4 words) — reject generic phrases like
    // "I already have a career in mind" which are not actionable career names.
    if (typeof data.aspiration.statedCareer === "string") {
      const sc = data.aspiration.statedCareer.trim().replace(/\s+/g, " ");
      const wordCount = sc.split(/\s+/).length;
      if (
        sc.length >= 2 &&
        sc.length <= 60 &&
        wordCount <= 4 &&
        !/\b(not|no|don'?t|dislike|hate|avoid|already|mind|idea|thinking)\b/i.test(sc)
      ) {
        asp.statedCareer = sc;
      }
    }
    // careerPriorities: what the student values most in a career.
    if (Array.isArray(data.aspiration.careerPriorities)) {
      const valid = (data.aspiration.careerPriorities as unknown[])
        .filter((p): p is string => typeof p === "string" && p.length >= 2 && p.length <= 60)
        .slice(0, 6);
      if (valid.length > 0) asp.careerPriorities = valid;
    }
    if (Object.keys(asp).length) out.aspiration = asp;
  }

  if (data.constraints && typeof data.constraints === "object") {
    const con: ProfileDelta["constraints"] = {};
    if (data.constraints.budgetBand) con.budgetBand = data.constraints.budgetBand;
    if (data.constraints.locationPref) con.locationPref = data.constraints.locationPref;
    if (data.constraints.timeToIncomeNeed) con.timeToIncomeNeed = data.constraints.timeToIncomeNeed;
    if (Array.isArray(data.constraints.familyExpectations)) {
      con.familyExpectations = data.constraints.familyExpectations
        .slice(0, 5)
        .filter((s): s is string => typeof s === "string");
    }
    if (Object.keys(con).length) out.constraints = con;
  }

  return Object.keys(out).length ? out : null;
}

function pick(obj: Record<string, unknown>, allowed: readonly string[], min: number, max: number) {
  const r: Record<string, number> = {};
  for (const k of allowed) {
    const v = obj[k];
    if (typeof v === "number" && !Number.isNaN(v)) r[k] = Math.min(max, Math.max(min, v));
  }
  return r;
}

// --- enrichments (personalInsight per career + parentSummary) ------------------
// One Groq call that produces:
//   personalInsights: { careerId → 1 sentence why this career suits THIS student }
//   parentSummary: 3 warm sentences written for the student's parents
export async function generateEnrichments(params: {
  top: Array<{ careerId: string; name: string; fitScore: number; factors: Array<{ dimension: string; label: string }> }>;
  streamLabel?: string;
  strongSubjects?: string[];
  topInterestLabels?: string[];
  goalOrientation?: string;
  studentName?: string;
}): Promise<{ personalInsights: Record<string, string>; parentSummary: string }> {
  const { top, streamLabel, strongSubjects, topInterestLabels, goalOrientation, studentName } = params;

  const studentCtx = [
    streamLabel ? `Stream: ${streamLabel}` : "",
    strongSubjects?.length ? `Strong subjects: ${strongSubjects.join(", ")}` : "",
    topInterestLabels?.length ? `Top interests: ${topInterestLabels.join(", ")}` : "",
    goalOrientation ? `Goal: ${goalOrientation}` : "",
    studentName ? `Name: ${studentName}` : "",
  ].filter(Boolean).join(" | ");

  const careerList = top.map((c) => ({
    id: c.careerId,
    name: c.name,
    fit: Math.round(c.fitScore * 100),
    topFactors: c.factors.slice(0, 2).map((f) => f.label),
  }));

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You write short, warm career guidance content for Plus Two students in Kerala, India (age 16–18). " +
        "Use simple, everyday English. Return ONLY valid JSON — no extra text outside the JSON.",
    },
    {
      role: "user",
      content:
        `Student profile: ${studentCtx || "not provided"}\n\n` +
        `Top career matches:\n${JSON.stringify(careerList, null, 2)}\n\n` +
        `Return a JSON object with exactly two keys:\n` +
        `1. "personalInsights": an object where each key is the career id and the value is ONE sentence (max 20 words) explaining why that specific career fits THIS student. ` +
        `Start each sentence with "Your" and reference something specific from the student profile (e.g. "Your love for biology", "Your interest in numbers", "Your goal to help people"). ` +
        `Use the topFactors as hints — but phrase it in plain student-friendly language, not as a list.\n` +
        `2. "parentSummary": a 3-sentence paragraph written FOR THE PARENTS of this student. ` +
        `Sentence 1: what their child's strongest career match is and what makes it a good fit. ` +
        `Sentence 2: what course leads there and roughly how long it takes. ` +
        `Sentence 3: an encouraging, reassuring close about their child's future. ` +
        `Keep it warm, clear, and jargon-free — parents may not know Plus Two terminology.\n\n` +
        `Format: { "personalInsights": { "career_id": "sentence" }, "parentSummary": "..." }`,
    },
  ];

  const { data } = await extractJson<{ personalInsights: Record<string, string>; parentSummary: string }>(
    messages,
    { temperature: 0.6 }
  );

  return {
    personalInsights: data?.personalInsights && typeof data.personalInsights === "object"
      ? Object.fromEntries(
          Object.entries(data.personalInsights)
            .filter(([, v]) => typeof v === "string" && v.length > 0)
        )
      : {},
    parentSummary: typeof data?.parentSummary === "string" && data.parentSummary.length > 0
      ? data.parentSummary
      : "",
  };
}

// --- stated career extractor ---------------------------------------------------
// Dedicated extractor for the "Do you have a career in mind?" question.
// More focused than the general extractor: handles typos, Malayalam career names,
// and informal phrases. Returns a clean career name, interest clusters, and
// a warm confirmation message to show the student.
export async function extractStatedCareer(text: string, streamLabel?: string): Promise<{
  career: string | null;
  confirmation: string | null;
  delta: ProfileDelta | null;
}> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You extract the career a Plus Two student (Kerala, India) wants to pursue from their free-text reply. " +
        "Handle typos, shorthand, and informal phrases (e.g. 'CA' → 'Chartered Accountant', 'docter' → 'doctor', 'softwar engg' → 'software engineer'). " +
        "Also understand Malayalam-influenced phrases (e.g. 'nursing cheyynam' → 'nurse'). " +
        "Return ONLY valid JSON — no extra text.",
    },
    {
      role: "user",
      content:
        `Student stream: ${streamLabel ?? "unknown"}\n` +
        `Student replied: "${text}"\n\n` +
        `Extract:\n` +
        `1. "career": the clean, short career name they want (e.g. "doctor", "software engineer", "CA"). ` +
        `   null if they are clearly not naming a specific career (e.g. "not sure", "exploring").\n` +
        `2. "confirmation": a warm 1-sentence acknowledgement (max 12 words) to show the student. ` +
        `   Start with "Got it —" and name the career. null if no career found.\n` +
        `   Example: "Got it — we'll build your path around becoming a doctor 🎯"\n` +
        `3. "interestClusters": object mapping the 1–2 most relevant interest cluster IDs to 0.7–0.8. ` +
        `   Only from: health_medicine, technology_coding, business_money, science_research, ` +
        `   design_visual, helping_teaching, law_justice, building_engineering, ` +
        `   media_communication, nature_agriculture, defence_adventure, numbers_analysis. ` +
        `   Empty object if no career was found.\n\n` +
        `Return: { "career": "...", "confirmation": "...", "interestClusters": { ... } }`,
    },
  ];

  const { data } = await extractJson<{ career: string | null; confirmation: string | null; interestClusters: Record<string, number> }>(
    messages,
    { temperature: 0.2 }
  );

  if (!data?.career) return { career: null, confirmation: null, delta: null };

  const career = data.career.trim().slice(0, 60);
  const confirmation = typeof data.confirmation === "string" ? data.confirmation.trim() : null;

  const validClusters = new Set(INTEREST_CLUSTERS as readonly string[]);
  const interests: Record<string, number> = {};
  if (data.interestClusters && typeof data.interestClusters === "object") {
    for (const [k, v] of Object.entries(data.interestClusters)) {
      if (validClusters.has(k) && typeof v === "number") {
        interests[k] = Math.min(0.85, Math.max(0.5, v));
      }
    }
  }

  const delta: ProfileDelta = {
    aspiration: { statedCareer: career },
    ...(Object.keys(interests).length > 0 ? { interests } : {}),
  };

  return { career, confirmation, delta };
}

// --- career follow-up question -------------------------------------------------
// After the student names a specific career, generate one targeted follow-up
// question that digs into what specifically draws them to it — helping the engine
// distinguish between closely related paths (e.g. MBBS vs nursing vs pharmacy).
export async function generateCareerFollowUp(params: {
  statedCareer: string;
  streamLabel?: string;
}): Promise<{ question: string; choices: AIChoice[] }> {
  const { statedCareer, streamLabel } = params;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a career counsellor helping a Plus Two student in Kerala, India narrow down their career goal. " +
        "Write in simple English a 16-year-old understands. Return ONLY valid JSON.",
    },
    {
      role: "user",
      content:
        `The student wants to become: "${statedCareer}"\n` +
        `Their Plus Two stream: ${streamLabel ?? "unknown"}\n\n` +
        `Write ONE friendly follow-up question (max 20 words) that helps us understand WHICH specific direction within "${statedCareer}" appeals to them most. ` +
        `For example, if they said "doctor": ask if they mean clinical medicine, research, nursing, or pharmacy.\n\n` +
        `RULES FOR THE 4 CHOICES:\n` +
        `- Write each choice as a plain everyday activity or outcome a 16-year-old can picture — NOT professional jargon.\n` +
        `  BAD: "Auditing and Finance", "Tax Consulting", "Financial Analysis"\n` +
        `  GOOD: "Checking company accounts and spotting errors", "Helping people save on taxes", "Working with data and business numbers"\n` +
        `- All must be realistic for their stream\n` +
        `- One option should be a simple "I'm not sure yet — just exploring" type option\n` +
        `- Each choice "value" must be the single best-fitting interest cluster ID from:\n` +
        `  health_medicine, technology_coding, business_money, science_research,\n` +
        `  design_visual, helping_teaching, law_justice, building_engineering,\n` +
        `  media_communication, nature_agriculture, defence_adventure, numbers_analysis\n\n` +
        `Return: { "question": "...", "choices": [{ "label": "...", "value": "cluster_id" }, ...] }`,
    },
  ];

  const { data } = await extractJson<{ question: string; choices: AIChoice[] }>(messages, { temperature: 0.5 });

  const question = data?.question?.trim();
  const choices = Array.isArray(data?.choices)
    ? data!.choices.filter((c) => c?.label && c?.value).slice(0, 4)
    : [];

  if (!question || choices.length < 2) {
    return {
      question: `What draws you most to becoming a ${statedCareer}?`,
      choices: [
        { label: "Helping and working with people", value: "helping_teaching" },
        { label: "The technical and scientific side", value: "science_research" },
        { label: "The stability and career prospects", value: "business_money" },
        { label: "It's a passion I've had for a long time", value: "helping_teaching" },
      ],
    };
  }

  return { question, choices };
}

// --- result reviewer -----------------------------------------------------------
// Reviews the engine's extended candidate list and picks the best 3–5 careers
// to show the student. AI can drop poor fits or reorder, but cannot add careers
// outside the engine's list (prevents hallucination of invalid career IDs).
export async function reviewRecommendations(params: {
  candidates: Array<{ careerId: string; name: string; domain: string; fitScore: number; factors: Array<{ dimension: string; label: string }> }>;
  streamLabel?: string;
  strongSubjects?: string[];
  topInterestLabels?: string[];
  goalOrientation?: string;
  statedCareer?: string;
  budgetBand?: string;
  locationPref?: string;
}): Promise<{ selectedIds: string[] }> {
  const { candidates, streamLabel, strongSubjects, topInterestLabels, goalOrientation, statedCareer, budgetBand, locationPref } = params;

  const studentCtx = [
    streamLabel ? `Stream: ${streamLabel}` : "",
    strongSubjects?.length ? `Strong subjects: ${strongSubjects.join(", ")}` : "",
    topInterestLabels?.length ? `Top interests: ${topInterestLabels.join(", ")}` : "",
    goalOrientation ? `Goal: ${goalOrientation}` : "",
    statedCareer ? `Stated career: ${statedCareer}` : "",
    budgetBand ? `Budget: ${budgetBand}` : "",
    locationPref ? `Location: ${locationPref}` : "",
  ].filter(Boolean).join(" | ");

  const candidateList = candidates.map((c) => ({
    id: c.careerId,
    name: c.name,
    domain: c.domain,
    fit: Math.round(c.fitScore * 100),
    reasons: c.factors.slice(0, 3).map((f) => f.label),
  }));

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a senior career counsellor reviewing AI-generated career recommendations for a Plus Two student in Kerala, India (age 16–18). " +
        "Your job is to select the 3–5 best-fitting careers from the candidate list to show the student. " +
        "You may drop careers that are clearly a poor fit given the student's profile. You may reorder them by quality of fit. " +
        "You MUST only return IDs from the provided candidate list — never invent new ones. " +
        "Return ONLY valid JSON — no extra text.",
    },
    {
      role: "user",
      content:
        `Student profile: ${studentCtx || "not provided"}\n\n` +
        `Candidate careers (engine-ranked):\n${JSON.stringify(candidateList, null, 2)}\n\n` +
        `Select the 3–5 careers that best fit this student. Consider:\n` +
        `- Relevance to their stated interests, subjects, and stream\n` +
        `- Whether their goal orientation (job soon / higher study / business / government) aligns\n` +
        `- Budget and location fit where relevant\n` +
        `- Drop any career that clearly contradicts their profile (e.g. engineering for a pure arts student with no maths)\n` +
        `- Keep at least 3 careers unless fewer than 3 candidates exist\n` +
        (statedCareer
          ? `- IMPORTANT: The student said they want to become "${statedCareer}". When two candidates are similarly scored, ` +
            `rank careers that are closer to "${statedCareer}" or its related field higher. ` +
            `Do NOT put a career that has no connection to "${statedCareer}" at #1 unless it is dramatically better-scored than all alternatives.\n`
          : "") +
        `\nReturn: { "selectedIds": ["career_id_1", "career_id_2", ...] } — ordered best-fit first.`,
    },
  ];

  const { data } = await extractJson<{ selectedIds: string[] }>(messages, { temperature: 0.2 });

  const validIds = new Set(candidates.map((c) => c.careerId));
  const selected = Array.isArray(data?.selectedIds)
    ? data!.selectedIds.filter((id): id is string => typeof id === "string" && validIds.has(id))
    : [];

  // Fallback: if AI returned nothing useful, keep the top 5 as-is.
  if (selected.length < 3) {
    return { selectedIds: candidates.slice(0, 5).map((c) => c.careerId) };
  }

  return { selectedIds: selected.slice(0, 5) };
}

// --- reviewer / explainer ------------------------------------------------------
// Writes a short explanation OVER the engine's already-decided result.
//
// `statedCareerGap` is set when the student named a specific career that is NOT
// in our catalog. The explainer then acknowledges it honestly, points to the
// closest path we DO cover, and tells them what to research — instead of
// silently presenting the nearest match as if it were their stated goal.
export async function explainRecommendation(
  result: RecommendationResult,
  language: "en" | "ml",
  statedCareerGap?: { statedCareer: string; closest: string }
): Promise<string> {
  const facts = result.top.slice(0, 3).map((c) => ({
    career: c.name,
    fit: Math.round(c.fitScore * 100),
    confidence: Math.round(c.confidence * 100),
    reasons: c.factors.slice(0, 3).map((f) => f.label),
  }));

  const gapInstruction = statedCareerGap
    ? `\n\nIMPORTANT: The student told us they want to become a "${statedCareerGap.statedCareer}". This specific career is NOT in our recommendation list. You MUST: (1) warmly acknowledge their interest in "${statedCareerGap.statedCareer}" by name; (2) gently explain we couldn't generate a full guided path for it here, but that "${statedCareerGap.closest}" (from the list) is the closest related path and a strong stepping stone; (3) encourage them to also research "${statedCareerGap.statedCareer}" specifically with a teacher or counsellor. Be honest and supportive — never pretend the listed careers are exactly what they asked for.`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You write short career-report summaries for Plus Two students in Kerala, India. ` +
        `Use ONLY the facts given to you — do not add careers, courses, fees, or numbers that are not in the data. ` +
        `Write 3–4 warm, encouraging sentences in simple English a 16-year-old can understand. ` +
        `CRITICAL: Do NOT ask any question. Do NOT end with "What are your thoughts?", "Would you like to?" or anything similar. ` +
        `End with a positive, forward-looking statement — never a question.` +
        gapInstruction,
    },
    { role: "user", content: JSON.stringify({ facts, caveats: result.caveats }) },
  ];
  const { content } = await chat(messages, { temperature: 0.5 });
  return content;
}
