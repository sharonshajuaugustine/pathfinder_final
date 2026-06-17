import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { loadKnowledgeBase } from "@/lib/kb-loader";
import { generateRecommendations } from "@/core/recommendation-engine";
import { normalizeProfile, computeCompleteness } from "@/core/profile-builder";
import { explainRecommendation } from "@/core/ai";
import type { StudentProfile } from "@/types/profile";
import type { Career } from "@/types/kb";
import { audit } from "@/lib/audit";

const bodySchema = z.object({ sessionId: z.string().uuid() });

// Generic role words that are too common to prove a career match on their own
// (every "X engineer" shares "engineer"). A match needs a distinctive overlap.
const GENERIC_CAREER_WORDS = new Set([
  "engineer", "officer", "manager", "professional", "analyst", "designer",
  "developer", "specialist", "graduate", "artist", "worker", "assistant",
  "executive", "consultant", "and", "the", "of", "a", "an", "to", "i", "want",
  "be", "become", "in",
]);

function careerWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ") // drop parentheticals like "(MBBS)"
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

// Does the student's free-text stated career correspond to a career in our KB?
// Matches when they share at least one DISTINCTIVE word (e.g. "software",
// "veterinarian", "pilot") — not merely a generic role word like "engineer".
function careerExistsInKb(statedCareer: string, careers: Career[]): boolean {
  const stated = careerWords(statedCareer);
  const distinctive = Array.from(stated).filter((w) => w.length >= 3 && !GENERIC_CAREER_WORDS.has(w));
  if (distinctive.length === 0) return false; // only generic words → can't confirm coverage
  for (const c of careers) {
    const target = careerWords(`${c.name} ${c.id.replace(/_/g, " ")}`);
    if (distinctive.some((w) => target.has(w))) return true;
  }
  return false;
}

// POST /api/recommendation — run the deterministic engine, then have the AI
// explain the result. Engine decides; AI only narrates. kb_version is stored.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid payload", parsed.error.flatten());

  const { sessionId } = parsed.data;
  const limited = await enforceRateLimit(limiters.recommend, "recommend", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();
  try {
    // Load profile + age + language.
    const { data: prof } = await db.from("student_profiles").select("profile").eq("session_id", sessionId).maybeSingle();
    const profile = normalizeProfile(prof?.profile as Partial<StudentProfile> | null);
    const { data: lead } = await db.from("leads").select("age, preferred_language").eq("session_id", sessionId).maybeSingle();
    const language = lead?.preferred_language === "ml" ? "ml" : "en";

    // Gate: refuse to generate if the profile is too sparse (onboarding only,
    // no conversation or assessment). Completeness < 30% means no interests,
    // no aptitude, no goals — results would be meaningless.
    const completeness = computeCompleteness(profile);
    if (completeness < 30) {
      return NextResponse.json(
        { error: "Please complete the conversation and quick quiz before viewing your recommendations." },
        { status: 422 }
      );
    }

    // 1. Deterministic engine = final decision-maker.
    const kb = await loadKnowledgeBase();
    const result = generateRecommendations(sessionId, profile, kb, { topN: 5, age: lead?.age });

    // 1b. Out-of-KB check: if the student named a specific career we don't cover,
    // flag it so the explainer addresses it honestly instead of silently passing
    // off the nearest match as their stated goal.
    const statedCareer = profile.aspiration.statedCareer?.trim();
    let statedCareerGap: { statedCareer: string; closest: string } | undefined;
    if (statedCareer && !careerExistsInKb(statedCareer, kb.careers) && result.top.length > 0) {
      statedCareerGap = { statedCareer, closest: result.top[0].name };
      result.caveats.unshift(
        `You mentioned wanting to become a "${statedCareer}". We couldn't build a full guided path for that specific career here — the paths below are the closest related options to explore.`
      );
    }

    // 2. AI reviewer/explainer over engine facts (best-effort; failure is non-fatal).
    try {
      result.explanation = await explainRecommendation(result, language, statedCareerGap);
    } catch (e) {
      console.error("explanation failed", e);
    }

    // 3. Persist with kb_version snapshot.
    const { data: saved, error } = await db
      .from("recommendations")
      .insert({
        session_id: sessionId,
        kb_version: result.kbVersion,
        results: result.top,
        overall_confidence: result.overallConfidence,
        explanation: result.explanation ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    await db.from("sessions").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", sessionId);
    await audit({ actorType: "student", action: "recommendation.generate", entity: "recommendations", entityId: saved.id, ipHash, meta: { kbVersion: result.kbVersion } });

    return NextResponse.json({ recommendationId: saved.id, ...result });
  } catch (e) {
    console.error(e);
    return serverError("Could not generate recommendation");
  }
}
