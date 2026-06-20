import "server-only";
import Groq from "groq-sdk";
import { serverEnv } from "@/lib/env";
import type { ChatMessage, ChatResult } from "@/lib/groq-types";

// Server-only Groq client.
//
// FALLBACK STRATEGY:
//   Primary: llama-3.3-70b-versatile (high quality, instruction-following).
//   On 429 or 5xx → llama-3.1-8b-instant (same Groq key, separate per-model
//   rate-limit bucket, so it's available when the 70B quota is exhausted).

const FALLBACK_MODEL = "llama-3.1-8b-instant";

let groqClient: Groq | null = null;
function getClient(): Groq {
  if (!groqClient) groqClient = new Groq({ apiKey: serverEnv.groqApiKey });
  return groqClient;
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true; // network error
  return status === 429 || status >= 500;
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
    if (!isRetryable(err)) throw err;
    const status = (err as { status?: number } | null)?.status ?? "network";
    console.warn(`[ai] Groq ${primaryModel} failed (${status}); falling back to ${FALLBACK_MODEL}`);
    try {
      const res = await getClient().chat.completions.create({
        model: FALLBACK_MODEL,
        messages,
        temperature: opts?.temperature ?? 0.6,
      });
      return {
        content: res.choices[0]?.message?.content ?? "",
        model: res.model,
        promptTokens: res.usage?.prompt_tokens,
        outputTokens: res.usage?.completion_tokens,
      };
    } catch (fallbackErr) {
      console.error("[ai] Fallback also failed", fallbackErr);
      throw fallbackErr;
    }
  }
}

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
    if (!isRetryable(err)) throw err;
    const status = (err as { status?: number } | null)?.status ?? "network";
    console.warn(`[ai] Groq ${primaryModel} extraction failed (${status}); falling back to ${FALLBACK_MODEL}`);
    try {
      const res = await getClient().chat.completions.create({
        model: FALLBACK_MODEL,
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
    } catch (fallbackErr) {
      console.error("[ai] Fallback extraction also failed", fallbackErr);
      return { data: null, raw: "", model: "fallback-failed" };
    }
  }
}
