import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { APTITUDES } from "@/types/profile";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  itemId: z.string().min(1).max(40),
  dimension: z.enum([...APTITUDES, "personality"] as [string, ...string[]]),
  answer: z.string().max(500),
  score: z.number().min(0).max(100).optional(),
});

// POST /api/assessment — save one aptitude/personality item response.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid assessment payload", parsed.error.flatten());

  const { sessionId, itemId, dimension, answer, score } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "assessment", [sessionId, ipHash]);
  if (limited) return limited;

  try {
    await getServiceClient().from("assessment_responses").insert({
      session_id: sessionId, item_id: itemId, dimension, answer, score: score ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return serverError("Could not save assessment response");
  }
}
