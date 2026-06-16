import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, serverError } from "@/lib/request";
import { audit } from "@/lib/audit";

// POST /api/session — create an anonymous session at first page load.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const limited = await enforceRateLimit(limiters.write, "session", [ipHash]);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const db = getServiceClient();
    const { data, error } = await db
      .from("sessions")
      .insert({
        status: "started",
        language: body.language === "ml" ? "ml" : "en",
        source: typeof body.source === "string" ? body.source.slice(0, 200) : null,
        user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        ip_hash: ipHash,
      })
      .select("id")
      .single();

    if (error) throw error;
    await audit({ action: "session.create", entity: "sessions", entityId: data.id, ipHash });
    return NextResponse.json({ sessionId: data.id });
  } catch (e) {
    console.error(e);
    return serverError("Could not create session");
  }
}
