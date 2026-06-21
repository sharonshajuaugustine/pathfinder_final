import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  reaction:  z.enum(["love", "good", "okay", "poor"]),
  message:   z.string().max(1000).optional(),
});

// POST /api/feedback — save student reaction + optional message after result page.
// Upserts so re-submissions overwrite rather than error (student can change mind).
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json   = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid feedback payload", parsed.error.flatten());

  const { sessionId, reaction, message } = parsed.data;
  const limited = await enforceRateLimit(limiters.write, "feedback", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();
  try {
    await db.from("feedback").upsert(
      {
        session_id: sessionId,
        reaction,
        message: message?.trim() || null,
      },
      { onConflict: "session_id" }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return serverError("Could not save feedback");
  }
}
