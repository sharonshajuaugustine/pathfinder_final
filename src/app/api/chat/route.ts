import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/admin";
import { clientIpHash, enforceRateLimit, limiters, badRequest, serverError } from "@/lib/request";
import { nextQuestion, extractProfileDelta, type StudentContext } from "@/core/ai";
import { mergeProfile, computeCompleteness, type ProfileDelta } from "@/core/profile-builder";
import type { ChatMessage } from "@/lib/groq";
import type { StudentProfile } from "@/types/profile";

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  stage: z.string().min(1).max(40),
  message: z.string().max(2000).optional(),
  // true when the student clicked a predefined choice button — skips LLM extraction
  // and writes the profile delta directly, saving ~600ms per turn.
  isChoice: z.boolean().optional(),
});

// Maps predefined choice button labels to profile deltas without an LLM call.
// Only covers the fixed choice sets shown in the UI. Falls back to LLM extraction
// for anything typed in the "Other" field.
function directDeltaFromChoice(message: string): ProfileDelta | null {
  const fieldMap: Record<string, string> = {
    "Technology / computers": "technology_coding",
    "Medicine / healthcare": "health_medicine",
    "Science / research": "science_research",
    "Business / commerce": "business_money",
    "Design / arts": "design_visual",
    "Teaching / social work": "helping_teaching",
    "Law / justice": "law_justice",
    "Nature / environment": "nature_agriculture",
    "Defence / adventure": "defence_adventure",
  };
  if (fieldMap[message]) return { interests: { [fieldMap[message]]: 0.7 } };

  if (message === "My family has a preference") return { constraints: { familyExpectations: ["family has career preference"] } };
  if (message === "I already have a career in mind") return null; // needs LLM to extract which career
  if (message === "Still figuring it out") return { interests: {} }; // signal captured, no cluster yet
  if (message === "A few options, not sure which") return null; // needs LLM

  if (message === "Study further (BTech / BSc / degree)") return { aspiration: { goalOrientation: "higher_study" } };
  if (message === "Find a job quickly") return { aspiration: { goalOrientation: "job_soon" } };
  if (message === "Govt exams (PSC / UPSC)") return { aspiration: { goalOrientation: "government" } };
  if (message === "Start my own business") return { aspiration: { goalOrientation: "business" } };

  if (message === "With people (patients / students / clients)") return { personality: { social: 0.8 } };
  if (message === "Solo work (coding / writing / research)") return { personality: { social: -0.7, analytical: 0.7 } };
  if (message === "Outdoors / fieldwork / hands-on") return { personality: { practical: 0.8, social: -0.2 } };
  if (message === "Mix of both") return { personality: { social: 0.2 } };

  if (message === "Comfortable — no problem") return { constraints: { budgetBand: "no_constraint" } };
  if (message === "Manageable with effort") return { constraints: { budgetBand: "medium" } };
  if (message === "Need a scholarship or loan") return { constraints: { budgetBand: "low" } };

  if (message === "Stay in Kerala") return { constraints: { locationPref: "kerala" } };
  if (message === "Anywhere in India") return { constraints: { locationPref: "india" } };
  if (message === "Open to going abroad") return { constraints: { locationPref: "abroad" } };
  if (message === "Open to studying abroad") return { constraints: { locationPref: "abroad" } };
  if (message === "Open to abroad") return { constraints: { locationPref: "abroad" } };
  // Ambiguous/flexible answers close the location gap without a specific preference.
  if (
    message === "Depends on the course" ||
    message === "I'm not sure yet" ||
    message === "Not sure yet" ||
    message === "Flexible"
  ) return { constraints: { locationPref: "india" } };

  // Goal variations the AI may generate
  if (message === "Study a degree further") return { aspiration: { goalOrientation: "higher_study" } };
  if (message === "Get a job quickly") return { aspiration: { goalOrientation: "job_soon" } };
  if (message === "Prepare for govt exams (PSC/UPSC)") return { aspiration: { goalOrientation: "government" } };
  if (message === "Start a business or an independent project") return { aspiration: { goalOrientation: "business" } };

  // Budget variations
  if (message === "Family can manage it") return { constraints: { budgetBand: "no_constraint" } };
  if (message === "Not sure about costs") return { constraints: { budgetBand: "medium" } };

  if (message === "They support my choice fully") return { constraints: { familyExpectations: [] } };
  if (message === "They want a specific career") return { constraints: { familyExpectations: ["family has career preference"] } };
  if (message === "Some preferences, not strict") return { constraints: { familyExpectations: ["some family preferences"] } };
  if (message === "Haven't discussed yet") return { constraints: { familyExpectations: [] } };

  return null;
}

// Maps a stated career name to the most relevant interest cluster.
// Used to close the interest gap automatically when a student names a specific
// career instead of picking a broad interest category.
function inferInterestFromCareer(career: string): Record<string, number> | null {
  const c = career.toLowerCase();
  if (/doctor|medicine|mbbs|nursing|medical|physician|surgeon|dentist|pharmacist|hospital|physiotherapy|healthcare|paramedic/.test(c))
    return { health_medicine: 0.7 };
  if (/software|developer|programmer|coding|engineer|tech|computer|information technology|app|web|data science|artificial intelligence|machine learning|cyber/.test(c))
    return { technology_coding: 0.7 };
  if (/business|entrepreneur|management|marketing|finance|accounting|commerce|startup|ceo|mba|economics/.test(c))
    return { business_money: 0.7 };
  if (/lawyer|law|legal|advocate|judge|solicitor|ias|upsc|psc|civil service|government service/.test(c))
    return { law_justice: 0.7 };
  if (/teacher|teaching|education|professor|lecturer|trainer|counsellor/.test(c))
    return { helping_teaching: 0.7 };
  if (/design|architect|graphic|animation|fashion|interior|ui|ux|visual art/.test(c))
    return { design_visual: 0.7 };
  if (/scientist|research|biology|chemistry|physics|biotech|bioinformatics|ecology|geology/.test(c))
    return { science_research: 0.7 };
  if (/army|navy|air force|military|nda|defence|defense|police|soldier|officer/.test(c))
    return { defence_adventure: 0.7 };
  if (/farmer|agriculture|environment|animal|vet|wildlife|forest|horticulture/.test(c))
    return { nature_agriculture: 0.7 };
  if (/journalist|media|film|acting|writer|content|communication|public relations|journalism|broadcasting/.test(c))
    return { media_communication: 0.7 };
  if (/chartered accountant|ca\b|actuary|financial analyst|statistician|data analyst/.test(c))
    return { numbers_analysis: 0.7 };
  if (/civil engineer|mechanical engineer|electrical engineer|construction|architecture/.test(c))
    return { building_engineering: 0.7 };
  return null;
}

// POST /api/chat — save the student message, extract profile signals, persist,
// and return the AI's next question plus choice buttons for the UI.
export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid chat payload", parsed.error.flatten());

  const { sessionId, stage, message, isChoice } = parsed.data;
  const limited = await enforceRateLimit(limiters.chat, "chat", [sessionId, ipHash]);
  if (limited) return limited;

  const db = getServiceClient();
  try {
    // 1. Persist the student's message (if any) and extract structured signals.
    if (message && message.trim()) {
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

      // For predefined choice clicks, map directly to a delta without an LLM call.
      // For typed "Other" answers, fall back to LLM extraction.
      let delta: ProfileDelta | null = null;
      let extractModel = "direct-choice";

      if (isChoice) {
        delta = directDeltaFromChoice(message);
      }
      if (!delta) {
        const result = await extractProfileDelta({ reply: message, stage, precedingQuestion });
        delta = result.delta;
        extractModel = result.model;
      }

      if (delta) {
        const { data: row } = await db
          .from("student_profiles")
          .select("profile")
          .eq("session_id", sessionId)
          .maybeSingle();
        const merged = mergeProfile(row?.profile as Partial<StudentProfile> | null, delta);
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
      await db.from("conversations").update({ model: extractModel }).eq("session_id", sessionId).eq("role", "user").eq("content", message);
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

    // 3. Fetch current profile for AI context.
    const { data: ctxRow } = await db
      .from("student_profiles")
      .select("profile")
      .eq("session_id", sessionId)
      .maybeSingle();
    let ctxProfile = ctxRow?.profile as Partial<StudentProfile> | null;

    // When the student named a specific career but no interest cluster was captured
    // yet, infer the cluster from the career name and persist it. This ensures the
    // recommendation engine has interest data even when the student skipped broad
    // interest selection by naming a career directly.
    {
      const sc = ctxProfile?.aspiration?.statedCareer;
      const hasCluster = Object.values(ctxProfile?.interests ?? {}).some(v => (v ?? 0) >= 0.3);
      if (sc && !hasCluster) {
        const inferred = inferInterestFromCareer(sc);
        if (inferred) {
          const merged = mergeProfile(ctxProfile, { interests: inferred });
          await db.from("student_profiles").upsert(
            {
              session_id: sessionId,
              profile: merged,
              completeness_pct: computeCompleteness(merged),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "session_id" }
          );
          ctxProfile = merged;
        }
      }
    }

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

    const detectedInterests = Object.entries(ctxProfile?.interests ?? {})
      .filter(([, v]) => (v ?? 0) >= 0.2)
      .map(([k]) => INTEREST_LABELS[k] ?? k);

    const statedCareer = ctxProfile?.aspiration?.statedCareer ?? undefined;

    const hasPersonalityData = Object.values(ctxProfile?.personality ?? {}).some(
      (v) => Math.abs((v as number) ?? 0) > 0.2
    );

    // Entrance exams relevant to this student's interest profile.
    const interests = ctxProfile?.interests ?? {};
    const relevantExams = new Set<string>();
    if ((interests.technology_coding ?? 0) >= 0.2 || (interests.numbers_analysis ?? 0) >= 0.2) {
      relevantExams.add("JEE"); relevantExams.add("KEAM");
    }
    if ((interests.health_medicine ?? 0) >= 0.2) relevantExams.add("NEET");
    if ((interests.science_research ?? 0) >= 0.2 || (interests.nature_agriculture ?? 0) >= 0.2) {
      relevantExams.add("CUET"); relevantExams.add("IISER Aptitude Test"); relevantExams.add("NEST");
    }
    if ((interests.law_justice ?? 0) >= 0.2) relevantExams.add("CLAT");
    if ((interests.business_money ?? 0) >= 0.2) {
      relevantExams.add("CUET"); relevantExams.add("IPMAT");
    }
    if ((interests.design_visual ?? 0) >= 0.2) {
      relevantExams.add("NID DAT"); relevantExams.add("NIFT");
    }
    if ((interests.defence_adventure ?? 0) >= 0.2) {
      relevantExams.add("NDA"); relevantExams.add("CDS");
    }
    if ((interests.helping_teaching ?? 0) >= 0.2 || (interests.media_communication ?? 0) >= 0.2) {
      relevantExams.add("CUET");
    }
    const relevantExamsList = Array.from(relevantExams);

    const capturedFamilyExpectations =
      (ctxProfile?.constraints?.familyExpectations?.length ?? 0) > 0;

    // Prioritised gaps: interest → goal → budget → location → family → work style.
    // Goal/budget/location come right after interest because they're the practical
    // guidance students need. Work style is last — the 10-question quiz already
    // captures personality, so a chat turn on it is largely redundant. One clear
    // interest is enough (threshold: a single cluster ≥ 0.3).
    const capturedInterestCount = Object.values(ctxProfile?.interests ?? {}).filter(
      (v) => (v ?? 0) >= 0.3
    ).length;
    const remainingGaps: string[] = [];
    if (capturedInterestCount < 1) {
      const sc = ctxProfile?.aspiration?.statedCareer;
      if (sc) {
        // Career known but interest cluster not yet inferred — ask what draws them to it
        remainingGaps.push(`what specifically draws them to "${sc}" and what daily activities in that field excite them`);
      } else {
        // Ask with activity/scenario choices — NEVER bare field labels like "Medicine" or "Technology"
        remainingGaps.push("what ACTIVITIES, SUBJECTS, or TYPE OF DAILY WORK genuinely excites them — choices must describe real activities (e.g. 'Caring for patients', 'Building software', 'Running a business'), NOT bare field names");
      }
    }
    if (!ctxProfile?.aspiration?.goalOrientation)
      remainingGaps.push("their goal after school — study further, get a job, govt exams (PSC/UPSC), or start a business");
    if (!ctxProfile?.constraints?.budgetBand)
      remainingGaps.push("whether study costs are a concern for their family");
    if (!ctxProfile?.constraints?.locationPref)
      remainingGaps.push("whether they can move to another city or abroad to study");
    if (!capturedFamilyExpectations)
      remainingGaps.push("whether their family has strong expectations about their career choice");
    if (!hasPersonalityData)
      remainingGaps.push("how they prefer to work — with people, solo / focused, or outdoors / hands-on");

    const rawStream = ctxProfile?.academic?.stream as string | undefined;
    const studentContext: StudentContext = {
      stream: rawStream ? (STREAM_LABELS[rawStream] ?? rawStream) : undefined,
      percentage: ctxProfile?.academic?.percentage,
      statedCareer: statedCareer || undefined,
      knownGoal: ctxProfile?.aspiration?.goalOrientation,
      knownBudget: ctxProfile?.constraints?.budgetBand,
      knownLocation: ctxProfile?.constraints?.locationPref,
      detectedInterests: detectedInterests.length > 0 ? detectedInterests : undefined,
      hasPersonalityData,
      remainingGaps: remainingGaps.length > 0 ? remainingGaps : undefined,
      relevantExams: relevantExamsList.length > 0 ? relevantExamsList : undefined,
      capturedFamilyExpectations: capturedFamilyExpectations || undefined,
    };

    // 4. Ask the next question.
    const q = await nextQuestion({ stage, history: chatHistory, studentContext });

    await db.from("conversations").insert({
      session_id: sessionId, role: "assistant", stage, content: q.content,
      model: q.model, prompt_tokens: q.promptTokens, output_tokens: q.outputTokens,
    });
    await db.from("sessions")
      .update({ status: "in_chat", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({ question: q.content, stage, choices: q.choices });
  } catch (e) {
    console.error(e);
    return serverError("Chat failed");
  }
}
