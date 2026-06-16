import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { loadKnowledgeBase } from "@/lib/kb-loader";
import { generateRecommendations } from "@/core/recommendation-engine";
import { normalizeProfile } from "@/core/profile-builder";
import { explainRecommendation } from "@/core/ai";
import type { StudentProfile } from "@/types/profile";
import { audit } from "@/lib/audit";

const bodySchema = z.object({ sessionId: z.string().uuid() });

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

    // 1. Deterministic engine = final decision-maker.
    const kb = await loadKnowledgeBase();
    const result = generateRecommendations(sessionId, profile, kb, { topN: 5, age: lead?.age });

    // 2. AI reviewer/explainer over engine facts (best-effort; failure is non-fatal).
    try {
      result.explanation = await explainRecommendation(result, language);
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
