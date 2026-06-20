import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { loadKnowledgeBase } from "@/lib/kb-loader";
import { generateRecommendations } from "@/core/recommendation-engine";
import { normalizeProfile, applyDerivedAptitude } from "@/core/profile-builder";
import type { StudentProfile } from "@/types/profile";

const bodySchema = z.object({ sessionId: z.string().uuid() });

// POST /api/mini-recommend — run the recommendation engine on a sparse profile
// (after the 5 start questions). Does NOT persist results and has no completeness gate,
// so it works with just 5 answers captured.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid payload", parsed.error.flatten());

  const { sessionId } = parsed.data;
  const limited = await enforceRateLimit(limiters.recommend, "mini-recommend", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();

  try {
    const { data: prof } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();

    const profile = normalizeProfile(prof?.profile as Partial<StudentProfile> | null);
    applyDerivedAptitude(profile);

    const kb = await loadKnowledgeBase();
    const result = generateRecommendations(sessionId, profile, kb, { topN: 3 });

    return NextResponse.json({
      top: result.top.map((c) => ({
        careerId: c.careerId,
        name: c.name,
        domain: c.domain,
        fitScore: Math.round(c.fitScore * 100),
        confidence: Math.round(c.confidence * 100),
      })),
      overallConfidence: Math.round(result.overallConfidence * 100),
    });
  } catch (e) {
    console.error(e);
    return serverError("Could not generate preview");
  }
}
