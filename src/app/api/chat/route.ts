import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { nextQuestion, extractProfileDelta, type StudentContext } from "@/core/ai";
import { mergeProfile, computeCompleteness } from "@/core/profile-builder";
import type { ChatMessage } from "@/lib/groq";
import type { StudentProfile } from "@/types/profile";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  stage: z.string().min(1).max(40),
  message: z.string().max(2000).optional(), // student's reply (absent on first turn)
});

// POST /api/chat — save the student message, extract profile signals, persist,
// and return the AI's next question. The AI interviews + extracts only.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid chat payload", parsed.error.flatten());

  const { sessionId, stage, message } = parsed.data;
  const limited = await enforceRateLimit(limiters.chat, "chat", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();
  try {
    // 1. Persist the student's message (if any) and extract structured signals.
    if (message && message.trim()) {
      // Fetch the AI's previous question so the extractor can interpret short
      // replies in context (e.g. a one-word answer, or a rejection in the
      // reflection stage). Must run BEFORE inserting the new user message.
      const { data: lastQ } = await db
        .from("conversations")
        .select("content")
        .eq("session_id", sessionId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const precedingQuestion = lastQ?.content as string | undefined;

      await db.from("conversations").insert({ session_id: sessionId, role: "user", stage, content: message });

      const { delta, model } = await extractProfileDelta({ reply: message, stage, precedingQuestion });
      if (delta) {
        // Profile rows from onboarding are PARTIAL (academic only). mergeProfile
        // normalizes to the full shape, so this is safe even if sections are missing.
        const { data: row } = await db
          .from("student_profiles")
          .select("profile")
          .eq("session_id", sessionId)
          .maybeSingle();
        const merged = mergeProfile(row?.profile as Partial<StudentProfile> | null, delta);
        // Upsert (not update) so a missing row self-heals instead of a silent no-op.
        await db.from("student_profiles").upsert(
          {
            session_id: sessionId,
            profile: merged,
            completeness_pct: computeCompleteness(merged),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );
      }
      // track extraction model for observability
      await db.from("conversations").update({ model }).eq("session_id", sessionId).eq("role", "user").eq("content", message);
    }

    // 2. Load recent history for context.
    const { data: history } = await db
      .from("conversations")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const chatHistory: ChatMessage[] = (history ?? []).map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    }));

    // 3. Fetch current profile for AI context (personalises questions, avoids repetition).
    const { data: ctxRow } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    const ctxProfile = ctxRow?.profile as Partial<StudentProfile> | null;

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
      business_money: "business / entrepreneurship",
      science_research: "science / research",
      design_visual: "design / arts",
      helping_teaching: "teaching / helping others",
      law_justice: "law / justice",
      building_engineering: "engineering / construction",
      media_communication: "media / communication",
      nature_agriculture: "nature / agriculture",
      defence_adventure: "defence / adventure",
      numbers_analysis: "mathematics / data analysis",
    };

    const detectedInterests = ctxProfile?.interests
      ? Object.entries(ctxProfile.interests)
          .filter(([, v]) => (v ?? 0) >= 0.4)
          .map(([k]) => INTEREST_LABELS[k] ?? k)
      : [];

    const rawStream = ctxProfile?.academic?.stream as string | undefined;
    const studentContext: StudentContext = {
      stream: rawStream ? (STREAM_LABELS[rawStream] ?? rawStream) : undefined,
      percentage: ctxProfile?.academic?.percentage,
      knownGoal: ctxProfile?.aspiration?.goalOrientation,
      knownBudget: ctxProfile?.constraints?.budgetBand,
      knownLocation: ctxProfile?.constraints?.locationPref,
      detectedInterests: detectedInterests.length > 0 ? detectedInterests : undefined,
    };

    // 4. Ask the next question.
    const { data: sess } = await db.from("sessions").select("language").eq("id", sessionId).single();
    const language = sess?.language === "ml" ? "ml" : "en";
    const q = await nextQuestion({ stage, language, history: chatHistory, studentContext });

    await db.from("conversations").insert({
      session_id: sessionId, role: "assistant", stage, content: q.content,
      model: q.model, prompt_tokens: q.promptTokens, output_tokens: q.outputTokens,
    });
    await db.from("sessions")
      .update({ status: "in_chat", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({ question: q.content, stage });
  } catch (e) {
    console.error(e);
    return serverError("Chat failed");
  }
}
