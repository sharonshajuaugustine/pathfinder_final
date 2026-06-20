import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { extractProfileDelta } from "@/core/ai";
import { mergeProfile, computeCompleteness, type ProfileDelta } from "@/core/profile-builder";
import { INTEREST_CLUSTERS, type InterestCluster, type GoalOrientation } from "@/types/profile";
import type { StudentProfile } from "@/types/profile";
import type { Stream } from "@/types/onboarding";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().min(0).max(4),
  values: z.array(z.string().max(100)).max(3).optional(), // multi-select (Q1 subjects)
  value: z.string().max(200).optional(),                   // single choice
  text: z.string().max(500).optional(),                    // free-text answer
  isChoice: z.boolean(),
});

const QUESTION_STAGES = ["", "", "interests", "aspiration", "aspiration"];
const QUESTION_TEXTS = [
  "Which Plus Two stream are you in?",
  "Which subject are you strongest in or enjoy the most?",
  "Which of these would you most enjoy doing every day?",
  "What's your main plan after Plus Two?",
  "What matters most to you in a career?",
];

function buildDirectDelta(questionIndex: number, value: string, values?: string[]): ProfileDelta | null {
  switch (questionIndex) {
    case 0: // stream
      return { academic: { stream: value as Stream, strongSubjects: [], weakSubjects: [] } };
    case 1: // subjects (multi-select)
      if (values && values.length > 0) {
        return { academic: { strongSubjects: values } };
      }
      return { academic: { strongSubjects: [value] } };
    case 2: // interest cluster
      if (INTEREST_CLUSTERS.includes(value as InterestCluster)) {
        return { interests: { [value]: 0.8 } };
      }
      return null;
    case 3: // goal
      return { aspiration: { goalOrientation: value as GoalOrientation } };
    case 4: // priorities
      return { aspiration: { careerPriorities: [value] } };
    default:
      return null;
  }
}

// POST /api/start — process one answer from the 5-question start quiz.
// Accepts either a choice click (direct delta) or free-text (LLM extraction for Q2-Q4).
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid start payload", parsed.error.flatten());

  const { sessionId, questionIndex, value, values, text, isChoice } = parsed.data;
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

    let delta: ProfileDelta | null = null;

    if (isChoice && (value || (values && values.length > 0))) {
      delta = buildDirectDelta(questionIndex, value ?? "", values);
    } else if (text && questionIndex === 1) {
      // Subjects: treat typed text as a direct subject name (no LLM needed)
      delta = { academic: { strongSubjects: [text.trim()] } };
    } else if (text && questionIndex >= 2) {
      // Interest, goal, priorities: use LLM extraction
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
      const upsertData: Record<string, unknown> = {
        session_id: sessionId,
        profile: merged,
        completeness_pct: computeCompleteness(merged),
        updated_at: new Date().toISOString(),
      };
      // Mirror stream to the denormalized column so admin queries stay consistent
      if (questionIndex === 0 && value) {
        upsertData.stream = value;
      }
      await db.from("student_profiles").upsert(upsertData, { onConflict: "session_id" });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return serverError("Could not save answer");
  }
}
