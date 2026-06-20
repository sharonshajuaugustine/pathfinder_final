import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { badRequest } from "@/lib/request";

// GET /api/chat-resume?session=<uuid>
// Returns the DB-backed state needed to resume a chat session after a page refresh.
// The client uses this to skip re-asking questions and jump to the correct phase.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return badRequest("Invalid session");

  const db = getServiceClient();

  const [sessionRes, convRes, profRes, assessRes] = await Promise.all([
    db.from("sessions").select("status").eq("id", sessionId).maybeSingle(),
    db
      .from("conversations")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(30),
    db.from("student_profiles").select("profile").eq("session_id", sessionId).maybeSingle(),
    db
      .from("assessment_responses")
      .select("item_id", { count: "exact", head: true })
      .eq("session_id", sessionId),
  ]);

  if (!sessionRes.data) return NextResponse.json({ status: "not_found" });

  const messages = (convRes.data ?? []).map((c) => ({
    role: c.role as "assistant" | "user",
    content: c.content,
  }));
  const turns = messages.filter((m) => m.role === "user").length;

  const pendingChoices = (
    profRes.data?.profile as Record<string, unknown> | null
  )?._pendingChoices as Record<string, unknown> | undefined;
  const lastChoices = pendingChoices ? Object.keys(pendingChoices) : [];

  return NextResponse.json({
    status: sessionRes.data.status,
    messages,
    turns,
    lastChoices,
    assessmentAnswered: assessRes.count ?? 0,
  });
}
