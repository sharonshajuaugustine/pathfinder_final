import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { loadKnowledgeBase } from "@/lib/kb-loader";
import { generateRecommendations } from "@/core/recommendation-engine";
import { normalizeProfile, computeCompleteness, applyDerivedAptitude, applyDerivedPersonality } from "@/core/profile-builder";
import { explainRecommendation, generateEnrichments, reviewRecommendations } from "@/core/ai";
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

  const db = getServiceClient();
  try {
    const kb = await loadKnowledgeBase();

    // Load profile + age + language.
    const { data: prof } = await db.from("student_profiles").select("profile").eq("session_id", sessionId).maybeSingle();
    const profile = normalizeProfile(prof?.profile as Partial<StudentProfile> | null);
    // Fill aptitude from subjects/stream for profiles saved before this was derived at merge time.
    applyDerivedAptitude(profile);
    // Fill personality traits inferred from aptitude for older profiles.
    applyDerivedPersonality(profile);
    const { data: lead } = await db.from("leads").select("age, preferred_language").eq("session_id", sessionId).maybeSingle();
    const language = lead?.preferred_language === "ml" ? "ml" : "en";

    // Gate: refuse to generate if the profile is too sparse (onboarding only,
    // no conversation or assessment). Completeness < 30% means no interests,
    // no aptitude, no goals — results would be meaningless.
    const completeness = computeCompleteness(profile);
    if (completeness < 30) {
      return NextResponse.json(
        { error: "Please complete the quiz and aptitude check before viewing your recommendations." },
        { status: 422 }
      );
    }

    // 1. Deterministic engine = final decision-maker. The engine is cheap and
    // deterministic, so we re-run it every time (incl. page refreshes). This keeps
    // caveats fresh and avoids depending on a persisted caveats column. Only the
    // expensive AI explanation is cached below.
    const result = generateRecommendations(sessionId, profile, kb, { topN: 10, age: lead?.age });

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

    // 1c. AI review: pick the best 3–5 from the extended candidate list.
    // Runs every time (cheap relative to explain/enrichments) so a KB update
    // can change the selection without requiring a new session.
    if (result.top.length > 0) {
      try {
        const interestLabelsForReview = Object.entries(profile.interests ?? {})
          .filter(([, v]) => (v as number) >= 0.5)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([k]) => k.replace(/_/g, " "));

        const { selectedIds } = await reviewRecommendations({
          candidates: result.top.map((c) => ({
            careerId: c.careerId,
            name: c.name,
            domain: c.domain,
            fitScore: c.fitScore,
            factors: c.factors,
          })),
          streamLabel: profile.academic.stream?.replace(/_/g, " ") ?? undefined,
          strongSubjects: profile.academic.strongSubjects,
          topInterestLabels: interestLabelsForReview,
          goalOrientation: profile.aspiration.goalOrientation ?? undefined,
          statedCareer: profile.aspiration.statedCareer ?? undefined,
          budgetBand: profile.constraints.budgetBand ?? undefined,
          locationPref: profile.constraints.locationPref ?? undefined,
        });

        const idOrder = new Map(selectedIds.map((id, i) => [id, i]));
        result.top = result.top
          .filter((c) => idOrder.has(c.careerId))
          .sort((a, b) => (idOrder.get(a.careerId) ?? 99) - (idOrder.get(b.careerId) ?? 99));
      } catch (reviewErr) {
        // Non-fatal: if the review step fails, keep the top 5 engine results.
        console.warn("[recommendation] AI review failed, using engine top-5", reviewErr);
        result.top = result.top.slice(0, 5);
      }
    }

    // 2. Reuse a cached AI explanation for this session + KB version if one exists.
    // This is the only thing worth caching (the LLM call); the engine + caveats are
    // recomputed above. Matching kb_version means a KB update regenerates (Bug #3).
    const { data: cached } = await db
      .from("recommendations")
      .select("id, explanation, parent_summary")
      .eq("session_id", sessionId)
      .eq("kb_version", kb.version)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.explanation) {
      result.explanation = cached.explanation;
      if (cached.parent_summary) result.parentSummary = cached.parent_summary;
      return NextResponse.json({ recommendationId: cached.id, ...result });
    }

    // No cached explanation — rate-limit the LLM call, then generate + persist.
    const limited = await enforceRateLimit(limiters.recommend, "recommend", [sessionId, ipHash]);
    if (limited) return limited;

    // Run explanation + enrichments in parallel — one Groq call each.
    const interestLabels = Object.entries(profile.interests ?? {})
      .filter(([, v]) => (v as number) >= 0.5)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([k]) => k.replace(/_/g, " "));
    const streamLabel = profile.academic.stream?.replace(/_/g, " ") ?? undefined;

    const [explanation, enrichments] = await Promise.allSettled([
      explainRecommendation(result, language, statedCareerGap),
      generateEnrichments({
        top: result.top.map((c) => ({ careerId: c.careerId, name: c.name, fitScore: c.fitScore, factors: c.factors })),
        streamLabel,
        strongSubjects: profile.academic.strongSubjects,
        topInterestLabels: interestLabels,
        goalOrientation: profile.aspiration.goalOrientation ?? undefined,
      }),
    ]);

    if (explanation.status === "fulfilled") result.explanation = explanation.value;
    else console.error("explanation failed", explanation.reason);

    if (enrichments.status === "fulfilled") {
      const { personalInsights, parentSummary } = enrichments.value;
      for (const career of result.top) {
        if (personalInsights[career.careerId]) {
          career.personalInsight = personalInsights[career.careerId];
        }
      }
      if (parentSummary) result.parentSummary = parentSummary;
    } else {
      console.error("enrichments failed", enrichments.reason);
    }

    // Persist results + explanation with kb_version snapshot (no caveats column —
    // caveats are recomputed each request from the profile).
    const { data: saved, error } = await db
      .from("recommendations")
      .insert({
        session_id: sessionId,
        kb_version: result.kbVersion,
        results: result.top,
        overall_confidence: result.overallConfidence,
        explanation: result.explanation ?? null,
        parent_summary: result.parentSummary ?? null,
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
