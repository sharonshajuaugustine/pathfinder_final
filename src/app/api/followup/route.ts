import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { followUpQuestion, extractProfileDelta } from "@/core/ai";
import { mergeProfile, computeCompleteness, type ProfileDelta } from "@/core/profile-builder";
import { INTEREST_CLUSTERS, type InterestCluster } from "@/types/profile";
import type { StudentProfile } from "@/types/profile";

// Short adaptive follow-up shown between the start quiz and the aptitude check.
// Up to 3 questions that react to what the student already told us and deepen
// their interest signal. Failures degrade gracefully to { done: true } so the
// flow never blocks.
const TOTAL_FOLLOWUPS = 3;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  index: z.number().int().min(0).max(TOTAL_FOLLOWUPS),
  prev: z
    .object({
      value: z.string().max(200).optional(),
      text: z.string().max(500).optional(),
      isChoice: z.boolean().optional(),
    })
    .optional(),
});

const STREAM_LABELS: Record<string, string> = {
  science_bio: "Science (Biology)",
  science_maths: "Science (Maths)",
  science_cs: "Science (Computer Science)",
  commerce: "Commerce",
  humanities: "Humanities / Arts",
};

const INTEREST_LABELS: Record<string, string> = {
  technology_coding: "technology / coding",
  health_medicine: "health / medicine",
  business_money: "business / money",
  science_research: "science / research",
  design_visual: "design / arts",
  helping_teaching: "teaching / helping",
  law_justice: "law / justice",
  building_engineering: "engineering / building",
  media_communication: "media / communication",
  nature_agriculture: "nature / agriculture",
  defence_adventure: "defence / sports / adventure",
  numbers_analysis: "maths / data",
};

export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid follow-up payload", parsed.error.flatten());

  const { sessionId, index, prev } = parsed.data;
  const limited = await enforceRateLimit(limiters.chat, "followup", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();

  try {
    const { data: row } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    const profileRaw = row?.profile as Record<string, unknown> | null;
    const profile = profileRaw as Partial<StudentProfile> | null;

    // 1. Save the previous answer (if any) into the profile.
    if (prev && (prev.value || prev.text)) {
      let delta: ProfileDelta | null = null;
      if (prev.isChoice && prev.value && INTEREST_CLUSTERS.includes(prev.value as InterestCluster)) {
        // Deepen the chosen interest cluster (0.7 — same as the chat captures).
        delta = { interests: { [prev.value as InterestCluster]: 0.7 } };
      } else if (prev.text) {
        const result = await extractProfileDelta({ reply: prev.text, stage: "interests" });
        delta = result.delta;
      }
      if (delta) {
        const merged = mergeProfile(profile, delta);
        const metaKeys = profileRaw
          ? Object.fromEntries(Object.entries(profileRaw).filter(([k]) => k.startsWith("_")))
          : {};
        await db.from("student_profiles").upsert(
          {
            session_id: sessionId,
            profile: { ...merged, ...metaKeys },
            completeness_pct: computeCompleteness(merged),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );
      }
    }

    // 2. Done after the last follow-up.
    if (index >= TOTAL_FOLLOWUPS) {
      return NextResponse.json({ done: true });
    }

    // 3. Generate the next follow-up from what we know. Reload so the just-saved
    // answer is reflected in the context.
    const { data: freshRow } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    const fresh = (freshRow?.profile ?? profileRaw) as Record<string, unknown> | null;
    const fp = fresh as Partial<StudentProfile> | null;

    const stream = fp?.academic?.stream;
    const topInterests = Object.entries(fp?.interests ?? {})
      .filter(([, v]) => (v ?? 0) >= 0.3)
      .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
      .slice(0, 3)
      .map(([k]) => INTEREST_LABELS[k] ?? k);
    const freeTexts = Array.isArray(fresh?._selectedInterests)
      ? (fresh!._selectedInterests as string[]).filter((s) => typeof s === "string" && !s.includes("::"))
      : [];

    try {
      const q = await followUpQuestion({
        index,
        streamLabel: stream ? (STREAM_LABELS[stream] ?? stream) : undefined,
        strongSubjects: fp?.academic?.strongSubjects?.length ? fp.academic.strongSubjects : undefined,
        statedCareer: fp?.aspiration?.statedCareer || undefined,
        topInterests: topInterests.length ? topInterests : undefined,
        freeTexts: freeTexts.length ? freeTexts : undefined,
      });
      return NextResponse.json({ question: q.content, choices: q.choices, done: false });
    } catch {
      // AI failed — skip the follow-up step gracefully.
      return NextResponse.json({ done: true });
    }
  } catch (e) {
    console.error(e);
    return serverError("Could not load follow-up");
  }
}
