import "server-only";
import Groq from "groq-sdk";
import { serverEnv } from "@/lib/env";

// Server-only Groq client. The model is the AI INTERVIEWER / EXTRACTOR /
// REVIEWER / EXPLAINER. It NEVER decides the final career — the scoring and
// recommendation engines do.
//
// Provider abstraction: all model calls go through `chat()` and `extractJson()`
// so a frontier-model fallback can be slotted in later without touching callers.

// Client pool: the primary key first, then any fallback keys (same model, same
// Groq endpoint). Built once and reused for the lifetime of the process.
let clientPool: Groq[] | null = null;
function clients(): Groq[] {
  if (!clientPool) {
    const keys = [serverEnv.groqApiKey, ...serverEnv.groqApiKeysFallback];
    clientPool = keys.map((apiKey) => new Groq({ apiKey }));
  }
  return clientPool;
}

// A failure is worth retrying on the next key only if it's a rate limit (429)
// or a transient server/network error. A 4xx like 400/401 would just fail again.
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true; // connection/network error — no HTTP status
  return status === 429 || status >= 500;
}

// Run `op` against the primary client; on a retryable error, fall through to the
// next key in the pool. Throws the last error if every key fails.
async function withFallback<T>(op: (c: Groq) => Promise<T>): Promise<T> {
  const pool = clients();
  let lastErr: unknown;
  for (let i = 0; i < pool.length; i++) {
    try {
      return await op(pool[i]);
    } catch (err) {
      lastErr = err;
      const more = i < pool.length - 1;
      if (!more || !isRetryable(err)) throw err;
      const status = (err as { status?: number } | null)?.status ?? "network";
      console.warn(`[groq] key #${i + 1} failed (${status}); retrying on backup key #${i + 2}`);
    }
  }
  throw lastErr;
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
  const res = await withFallback((c) =>
    c.chat.completions.create({
      model,
      messages,
      temperature: opts?.temperature ?? 0.6,
    })
  );
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
  const res = await withFallback((c) =>
    c.chat.completions.create({
      model,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    })
  );
  const raw = res.choices[0]?.message?.content ?? "";
  try {
    return { data: JSON.parse(raw) as T, raw, model };
  } catch {
    return { data: null, raw, model };
  }
}
