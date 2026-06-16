import "server-only";
import Groq from "groq-sdk";
import { serverEnv } from "@/lib/env";

// Server-only Groq client. The model is the AI INTERVIEWER / EXTRACTOR /
// REVIEWER / EXPLAINER. It NEVER decides the final career — the scoring and
// recommendation engines do.
//
// Provider abstraction: all model calls go through `chat()` and `extractJson()`
// so a frontier-model fallback can be slotted in later without touching callers.

let cached: Groq | null = null;
function client(): Groq {
  if (!cached) cached = new Groq({ apiKey: serverEnv.groqApiKey });
  return cached;
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
  const model = serverEnv.groqModel;
  const res = await client().chat.completions.create({
    model,
    messages,
    temperature: opts?.temperature ?? 0.6,
  });
  return {
    content: res.choices[0]?.message?.content ?? "",
    model,
    promptTokens: res.usage?.prompt_tokens,
    outputTokens: res.usage?.completion_tokens,
  };
}

// Strict JSON extraction. Uses JSON response format + a retry. Callers must
// still validate the parsed object against a Zod schema (extraction is the
// accuracy-critical path; never trust raw model output).
export async function extractJson<T = unknown>(
  messages: ChatMessage[]
): Promise<{ data: T | null; raw: string; model: string }> {
  const model = serverEnv.groqModel;
  const res = await client().chat.completions.create({
    model,
    messages,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });
  const raw = res.choices[0]?.message?.content ?? "";
  try {
    return { data: JSON.parse(raw) as T, raw, model };
  } catch {
    return { data: null, raw, model };
  }
}
