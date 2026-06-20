import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { extractProfileDelta } from "@/core/ai";
import { mergeProfile, computeCompleteness, normalizeProfile, type ProfileDelta } from "@/core/profile-builder";
import { INTEREST_CLUSTERS, type InterestCluster, type GoalOrientation } from "@/types/profile";
import type { StudentProfile } from "@/types/profile";
import type { Stream } from "@/types/onboarding";

// Question indices:
//  0 — name + age         (text inputs, no choices)
//  1 — stream + percentage (stream card + percentage input)
//  2 — subjects            (multi-select up to 2)
//  3 — interest cluster    (single choice, saved at 0.5 for chat deepening)
//  4 — goal orientation    (single choice)
//  5 — career priorities   (single choice)

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().min(0).max(5),
  values: z.array(z.string().max(100)).max(3).optional(), // multi-select (Q2 subjects)
  value: z.string().max(200).optional(),                  // single choice
  text: z.string().max(500).optional(),                   // free-text answer
  name: z.string().max(100).optional(),                   // Q0
  age: z.number().int().min(1).max(110).optional(),       // Q0
  percentage: z.number().min(0).max(100).optional(),      // Q1
  isChoice: z.boolean(),
});

const QUESTION_STAGES = ["", "", "", "interests", "aspiration", "aspiration"];
const QUESTION_TEXTS = [
  "What is your name and age?",
  "Which Plus Two stream are you in?",
  "Which subject are you strongest in or enjoy the most?",
  "Which of these would you most enjoy doing every day?",
  "What's your main plan after Plus Two?",
  "What matters most to you in a career?",
];

function buildDirectDelta(
  questionIndex: number,
  value: string,
  values?: string[],
  percentage?: number
): ProfileDelta | null {
  switch (questionIndex) {
    case 2: // subjects (multi-select)
      if (values && values.length > 0) return { academic: { strongSubjects: values } };
      return { academic: { strongSubjects: [value] } };
    case 3: // interest cluster — saved at 0.5 so the chat can deepen it
      if (INTEREST_CLUSTERS.includes(value as InterestCluster)) {
        return { interests: { [value]: 0.5 } };
      }
      return null;
    case 4: // goal
      return { aspiration: { goalOrientation: value as GoalOrientation } };
    case 5: // priorities
      return { aspiration: { careerPriorities: [value] } };
    default:
      return null;
  }
}

// POST /api/start — process one answer from the 6-question start quiz.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid start payload", parsed.error.flatten());

  const { sessionId, questionIndex, value, values, text, name, age, percentage, isChoice } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "start", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();

  try {
    const { data: row } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    const prevProfile = row?.profile as Partial<StudentProfile> | null;

    // Q0: name + age — stored as metadata in profile JSON (_name, _age)
    if (questionIndex === 0) {
      const updated = {
        ...(prevProfile ?? {}),
        _name: name?.trim() ?? "",
        _age: age ?? null,
      };
      await db.from("student_profiles").upsert(
        {
          session_id: sessionId,
          profile: updated,
          completeness_pct: computeCompleteness(normalizeProfile(prevProfile)),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );
      return NextResponse.json({ ok: true });
    }

    // Q1: stream + percentage — mirror to denormalized columns
    if (questionIndex === 1 && value) {
      const delta: ProfileDelta = {
        academic: {
          stream: value as Stream,
          strongSubjects: [],
          weakSubjects: [],
          ...(percentage != null ? { percentage } : {}),
        },
      };
      const merged = mergeProfile(prevProfile, delta);
      await db.from("student_profiles").upsert(
        {
          session_id: sessionId,
          profile: merged,
          completeness_pct: computeCompleteness(merged),
          stream: value,
          percentage: percentage ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );
      return NextResponse.json({ ok: true });
    }

    // Q2–Q5: structured choice or free-text extraction
    let delta: ProfileDelta | null = null;

    if (isChoice && (value || (values && values.length > 0))) {
      delta = buildDirectDelta(questionIndex, value ?? "", values, percentage);
    } else if (text && questionIndex === 2) {
      // Subjects: treat typed text as a direct subject name
      delta = { academic: { strongSubjects: [text.trim()] } };
    } else if (text && questionIndex >= 3) {
      // Interest, goal, priorities: LLM extraction
      const stage = QUESTION_STAGES[questionIndex];
      const result = await extractProfileDelta({
        reply: text,
        stage,
        precedingQuestion: QUESTION_TEXTS[questionIndex],
      });
      delta = result.delta;
    }

    if (delta) {
      const merged = mergeProfile(prevProfile, delta);
      await db.from("student_profiles").upsert(
        {
          session_id: sessionId,
          profile: merged,
          completeness_pct: computeCompleteness(merged),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return serverError("Could not save answer");
  }
}
