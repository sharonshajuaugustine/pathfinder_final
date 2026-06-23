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
    // Score more careers than we need so we can surface a spread of distinct
    // COURSES (the next step a student actually takes) rather than career titles.
    const result = generateRecommendations(sessionId, profile, kb, { topN: 8 });

    // Pick the best course to take next: walk the ranked careers, take each one's
    // primary (first) course, dedupe by courseId, and keep the top 3 distinct
    // courses. Each course is shown with the career it leads toward.
    const seen = new Set<string>();
    const courses: Array<{
      courseId: string; name: string; leadsTo: string; domain: string;
      fitScore: number; confidence: number;
    }> = [];
    for (const career of result.top) {
      const primary = career.courses[0];
      if (!primary || seen.has(primary.courseId)) continue;
      seen.add(primary.courseId);
      courses.push({
        courseId: primary.courseId,
        name: primary.name,
        leadsTo: career.name,
        domain: career.domain,
        fitScore: Math.round(career.fitScore * 100),
        confidence: Math.round(career.confidence * 100),
      });
      if (courses.length >= 3) break;
    }

    return NextResponse.json({
      top: courses,
      overallConfidence: Math.round(result.overallConfidence * 100),
    });
  } catch (e) {
    console.error(e);
    return serverError("Could not generate preview");
  }
}
