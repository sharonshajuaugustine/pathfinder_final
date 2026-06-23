import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { extractProfileDelta } from "@/core/ai";
import { mergeProfile, computeCompleteness, normalizeProfile, type ProfileDelta } from "@/core/profile-builder";
import { INTEREST_CLUSTERS, type InterestCluster, type GoalOrientation } from "@/types/profile";
import type { StudentProfile } from "@/types/profile";
import type { Stream } from "@/types/onboarding";

// Question indices (start quiz — engine only, no chat AI):
//  0 — name + age + phone + gender (text inputs, no choices)
//  1 — stream + percentage         (stream card + percentage input)
//  2 — subjects                    (multi-select up to 2)
//  3 — interest cluster            (single choice, saved at 0.5 for later deepening)
//  4 — goal orientation            (single choice)
//  5 — career priorities           (single choice)
//  6 — budget band                 (single choice)
//  7 — location preference         (single choice)
//  8 — family expectations         (single choice)
//  9 — work style                  (single choice)

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().min(0).max(9),
  values: z.array(z.string().max(100)).max(3).optional(), // multi-select (Q2 subjects)
  value: z.string().max(200).optional(),                  // single choice
  text: z.string().max(500).optional(),                   // free-text answer
  name: z.string().max(100).optional(),                   // Q0
  age: z.number().int().min(1).max(110).optional(),       // Q0
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),    // Q0
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(), // Q0
  percentage: z.number().min(0).max(100).optional(),      // Q1
  isChoice: z.boolean(),
});

const QUESTION_STAGES = ["", "", "", "interests", "aspiration", "aspiration", "", "", "", ""];
const QUESTION_TEXTS = [
  "Hey there! Let's get started. What is your name, age, and phone number?",
  "Which stream are you studying in Plus Two?",
  "Which subjects do you enjoy the most or score best in?",
  "Would you be interested in any of these?",
  "What are you planning to do after Plus Two?",
  "What matters most to you when choosing a career?",
  "Can your family comfortably pay for a private college if needed?",
  "Are you open to moving to another city or abroad to study?",
  "Does your family have a strong preference about your career?",
  "How do you most enjoy working?",
];

// Work-style choice → personality trait delta. Mirrors the chat route's mapping
// so the start quiz and chat produce the same personality signals.
function workstyleDelta(value: string): ProfileDelta | null {
  if (value === "social") return { personality: { social: 0.8 } };
  if (value === "analytical_solo") return { personality: { social: -0.7, analytical: 0.7 } };
  if (value === "practical_outdoor") return { personality: { practical: 0.8, social: -0.2 } };
  if (value === "mixed") return { personality: { social: 0.2 } };
  return null;
}

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
      if (values && values.length > 0) {
        const interestDelta: Record<string, number> = {};
        for (const val of values) {
          const clusterKey = val.split("::")[0];
          if (INTEREST_CLUSTERS.includes(clusterKey as InterestCluster)) {
            interestDelta[clusterKey] = 0.5;
          }
        }
        return Object.keys(interestDelta).length > 0 ? { interests: interestDelta } : null;
      }
      if (value) {
        const clusterKey = value.split("::")[0];
        if (INTEREST_CLUSTERS.includes(clusterKey as InterestCluster)) {
          return { interests: { [clusterKey]: 0.5 } };
        }
      }
      return null;
    case 4: // goal
      {
        let goalVal = value;
        if (value === "entrance_exams" || value === "repeat_year") {
          goalVal = "higher_study";
        }
        return { aspiration: { goalOrientation: goalVal as GoalOrientation } };
      }
    case 5: // priorities
      return { aspiration: { careerPriorities: [value] } };
    case 6: // budget band
      return ["low", "medium", "high", "no_constraint"].includes(value)
        ? { constraints: { budgetBand: value as StudentProfile["constraints"]["budgetBand"] } }
        : null;
    case 7: // location preference
      return ["kerala", "india", "abroad"].includes(value)
        ? { constraints: { locationPref: value as StudentProfile["constraints"]["locationPref"] } }
        : null;
    case 8: // family expectations
      return { constraints: { familyExpectations: [value] } };
    case 9: // work style → personality
      return workstyleDelta(value);
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

  const { sessionId, questionIndex, value, values, text, name, age, phone, gender, percentage, isChoice } = parsed.data;
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

    // Q0: name + age + phone — stored as metadata in profile JSON (_name, _age, _phone)
    // Also creates a partial lead immediately so partial completions are visible in admin.
    if (questionIndex === 0) {
      const updated = {
        ...(prevProfile ?? {}),
        _name: name?.trim() ?? "",
        _age: age ?? null,
        _phone: phone ?? null,
        _gender: gender ?? null,
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

      // Create a partial lead so admin can see the student even if they drop off.
      // Check first to avoid duplicates (leads has no unique constraint on session_id).
      if (name?.trim() && phone) {
        const parsedAge = age ?? null;
        const { data: existingLead } = await db
          .from("leads").select("id").eq("session_id", sessionId).maybeSingle();
        if (!existingLead) {
          await db.from("leads").insert({
            session_id: sessionId,
            name: name.trim(),
            phone,
            age: parsedAge,
            is_minor: parsedAge != null ? parsedAge < 18 : null,
          });
          // Best-effort gender write — kept separate so a missing `gender` column
          // (migration not yet run) never blocks the core lead capture.
          if (gender) {
            await db.from("leads").update({ gender }).eq("session_id", sessionId);
          }
        }
      }

      return NextResponse.json({ ok: true });
    }

    // Collect all _* metadata keys from prevProfile so they survive mergeProfile()
    // (mergeProfile returns a typed StudentProfile which strips non-schema keys like _name, _age).
    const prevRaw = prevProfile as Record<string, unknown> | null;
    const metaKeys = prevRaw
      ? Object.fromEntries(Object.entries(prevRaw).filter(([k]) => k.startsWith("_")))
      : {};

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
      const merged = { ...mergeProfile(prevProfile, delta), ...metaKeys };
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

      // Update partial lead with stream now that it's known.
      await db.from("leads")
        .update({ stream: value, percentage: percentage ?? null, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId);

      return NextResponse.json({ ok: true });
    }

    // Q2–Q5: structured choice or free-text extraction
    let delta: ProfileDelta | null = null;

    if (isChoice && (value || (values && values.length > 0))) {
      delta = buildDirectDelta(questionIndex, value ?? "", values, percentage);
    } else if (text && questionIndex === 2) {
      // Subjects: use LLM extraction so hobbies/interests map to interests, and actual subjects map to subjects
      const stage = "interests";
      const result = await extractProfileDelta({
        reply: text,
        stage,
        precedingQuestion: QUESTION_TEXTS[2],
      });
      delta = result.delta;
      if (!delta) {
        delta = { academic: { strongSubjects: [text.trim()] } };
      }
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
      let merged = { ...mergeProfile(prevProfile, delta), ...metaKeys };
      if (questionIndex === 3) {
        const rawValues = values || (value ? [value] : []);
        merged = {
          ...merged,
          _selectedInterests: rawValues,
        };
      }
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
