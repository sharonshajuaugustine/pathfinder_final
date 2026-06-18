import "server-only";
import Groq from "groq-sdk";
import { serverEnv } from "@/lib/env";

// Server-only Groq client. The model is the AI INTERVIEWER / EXTRACTOR /
// REVIEWER / EXPLAINER. It NEVER decides the final career — the scoring and
// recommendation engines do.
//
// Provider abstraction: all model calls go through `chat()` and `extractJson()`
// so a frontier-model fallback can be slotted in later without touching callers.

// Single client, built once and reused. Fallback is a lighter model on the same
// key — not a separate key — since rate limits differ per model, not per key.
let groqClient: Groq | null = null;
function getClient(): Groq {
  if (!groqClient) groqClient = new Groq({ apiKey: serverEnv.groqApiKey });
  return groqClient;
}

// Retry with the fallback model on rate-limit (429) or transient errors (5xx /
// network). Hard errors like 400/401 are thrown immediately.
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true; // network error — no HTTP status
  return status === 429 || status >= 500;
}

async function withFallback<T>(
  op: (c: Groq, model: string) => Promise<T>,
  primaryModel: string,
  fallbackModel: string
): Promise<T> {
  const c = getClient();
  try {
    return await op(c, primaryModel);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    const status = (err as { status?: number } | null)?.status ?? "network";
    console.warn(`[groq] ${primaryModel} failed (${status}); retrying with ${fallbackModel}`);
    return await op(c, fallbackModel);
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
  promptTokens?: number;
  outputTokens?: number;
}

export async function chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResult> {
  const primaryModel = serverEnv.groqModel;
  const fallbackModel = serverEnv.groqFallbackModel;
  const res = await withFallback(
    (c, model) => c.chat.completions.create({ model, messages, temperature: opts?.temperature ?? 0.6 }),
    primaryModel,
    fallbackModel
  );
  return {
    content: res.choices[0]?.message?.content ?? "",
    model: res.model,
    promptTokens: res.usage?.prompt_tokens,
    outputTokens: res.usage?.completion_tokens,
  };
}

// Strict JSON extraction. Uses JSON response format + a retry. Callers must
// still validate the parsed object against a Zod schema (extraction is the
// accuracy-critical path; never trust raw model output).
export async function extractJson<T = unknown>(
  messages: ChatMessage[],
  opts?: { temperature?: number }
): Promise<{ data: T | null; raw: string; model: string }> {
  const primaryModel = serverEnv.groqModel;
  const fallbackModel = serverEnv.groqFallbackModel;
  const res = await withFallback(
    (c, model) => c.chat.completions.create({ model, messages, temperature: opts?.temperature ?? 0.1, response_format: { type: "json_object" } }),
    primaryModel,
    fallbackModel
  );
  const model = res.model;
  const raw = res.choices[0]?.message?.content ?? "";
  try {
    return { data: JSON.parse(raw) as T, raw, model };
  } catch {
    return { data: null, raw, model };
  }
}
