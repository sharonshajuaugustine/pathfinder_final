import "server-only";
import Groq from "groq-sdk";
import { serverEnv } from "@/lib/env";
import type { ChatMessage, ChatResult } from "@/lib/groq-types";
import { glmChat, glmExtractJson, isGlmRetryable } from "@/lib/glm";

// Server-only Groq client. The model is the AI INTERVIEWER / EXTRACTOR /
// REVIEWER / EXPLAINER. It NEVER decides the final career — the scoring and
// recommendation engines do.
//
// FALLBACK STRATEGY (cross-provider):
//   Primary: Groq + Llama 3.3 70B (fast, cheap, good at instruction following).
//   On Groq 429 (rate limit) or 5xx/down → fall back to GLM-4.7-Flash (Zhipu
//   AI). This is a DIFFERENT provider on a different rate-limit bucket, so it
//   survives Groq-wide outages. GLM-4.7-Flash is a strong reasoning model, which
//   makes it an excellent fallback for the accuracy-critical extraction path.
//
// The previous design fell back to a weaker model on the SAME Groq key — which
// (a) shared the same rate-limit bucket and (b) degraded extraction quality
// silently. Cross-provider GLM fixes both.

// Single client, built once and reused.
let groqClient: Groq | null = null;
function getClient(): Groq {
  if (!groqClient) groqClient = new Groq({ apiKey: serverEnv.groqApiKey });
  return groqClient;
}

// Retry with the fallback model on rate-limit (429) or transient errors (5xx /
// network). Hard errors like 400/401 are thrown immediately.
function isGroqRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true; // network error — no HTTP status
  return status === 429 || status >= 500;
}

// GLM is only usable when its key is configured. Otherwise the fallback is a
// no-op and Groq errors propagate (preserving the original behavior).
function glmAvailable(): boolean {
  return serverEnv.glmApiKey.length > 0;
}

export { type ChatMessage, type ChatResult };

export async function chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResult> {
  const primaryModel = serverEnv.groqModel;
  try {
    const res = await getClient().chat.completions.create({
      model: primaryModel,
      messages,
      temperature: opts?.temperature ?? 0.6,
    });
    return {
      content: res.choices[0]?.message?.content ?? "",
      model: res.model,
      promptTokens: res.usage?.prompt_tokens,
      outputTokens: res.usage?.completion_tokens,
    };
  } catch (err) {
    if (!isGroqRetryable(err) || !glmAvailable()) throw err;
    const status = (err as { status?: number } | null)?.status ?? "network";
    console.warn(`[ai] Groq ${primaryModel} failed (${status}); falling back to GLM ${serverEnv.glmModel}`);
    return glmChat(messages, opts);
  }
}

// Strict JSON extraction. Uses JSON response format + a retry. Callers must
// still validate the parsed object against a Zod schema (extraction is the
// accuracy-critical path; never trust raw model output).
export async function extractJson<T = unknown>(
  messages: ChatMessage[],
  opts?: { temperature?: number }
): Promise<{ data: T | null; raw: string; model: string }> {
  const primaryModel = serverEnv.groqModel;
  try {
    const res = await getClient().chat.completions.create({
      model: primaryModel,
      messages,
      temperature: opts?.temperature ?? 0.1,
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content ?? "";
    try {
      return { data: JSON.parse(raw) as T, raw, model: res.model };
    } catch {
      return { data: null, raw, model: res.model };
    }
  } catch (err) {
    if (!isGroqRetryable(err) || !glmAvailable()) throw err;
    const status = (err as { status?: number } | null)?.status ?? "network";
    console.warn(`[ai] Groq ${primaryModel} extraction failed (${status}); falling back to GLM ${serverEnv.glmModel}`);
    // GLM's own JSON parser + retry handling live in glmExtractJson.
    // Guard: if GLM itself fails with a hard error, surface it rather than
    // returning a misleading null.
    const out = await glmExtractJson<T>(messages, opts).catch((glmErr) => {
      if (!isGlmRetryable(glmErr)) throw glmErr;
      // Both providers failed transiently — return null so the caller treats it
      // as "extraction failed" instead of crashing the turn.
      console.error("[ai] GLM fallback also failed", glmErr);
      return { data: null, raw: "", model: "glm-fallback-failed" };
    });
    return out;
  }
}
