import "server-only";
import { serverEnv } from "@/lib/env";
import type { ChatMessage, ChatResult } from "@/lib/groq-types";

// ---------------------------------------------------------------------------
// GLM provider (Zhipu AI / Z.AI) — cross-provider fallback for when Groq is
// rate-limited (429) or down. GLM-4.7-Flash is a high-quality reasoning model,
// so it is an EXCELLENT fallback for the accuracy-critical extraction path.
//
// Why a separate client (not part of groq.ts):
//   • Different base URL, model name, and auth.
//   • GLM-4.7-Flash is a reasoning model: it emits a `reasoning_content` field
//     and burns tokens on thinking before answering. We must request a higher
//     `max_tokens` or the answer gets truncated to empty (verified). It is also
//     slower per call (~2–3s) than Groq, which is why it stays fallback-only.
//
// The wire format is OpenAI-compatible, so this is a small fetch client — no
// new dependency. Same ChatMessage/ChatResult shapes as the Groq client so the
// fallback layer can swap providers transparently.
// ---------------------------------------------------------------------------

const ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/chat/completions";

// GLM-4.7-Flash is a reasoning model. A 100-token budget is consumed entirely
// by reasoning and yields an EMPTY answer (verified). Extraction JSON needs
// headroom for both the reasoning and the structured output.
const GLM_MAX_TOKENS_REASON = 4000; // chat question generation
const GLM_MAX_TOKENS_EXTRACT = 6000; // structured extraction (reasoning + JSON)

class GlmError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function callGlm(
  messages: ChatMessage[],
  opts: { temperature?: number; jsonMode?: boolean; maxTokens: number }
): Promise<ChatResult> {
  const apiKey = serverEnv.glmApiKey;
  if (!apiKey) throw new GlmError("GLM_API_KEY not set", 500);

  const body: Record<string, unknown> = {
    model: serverEnv.glmModel,
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(ZAI_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    // Network error / abort — treat as retryable by the caller.
    if ((e as Error).name === "AbortError") throw new GlmError("GLM timeout", 504);
    throw new GlmError(`GLM network error: ${(e as Error).message}`, 500);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new GlmError(`GLM HTTP ${res.status}`, res.status);
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  // GLM returns `reasoning_content` (the chain-of-thought) separately from the
  // final `content`. We only ever want the final content.
  const content = msg?.content ?? "";
  return {
    content,
    model: data?.model ?? serverEnv.glmModel,
    promptTokens: data?.usage?.prompt_tokens,
    outputTokens: data?.usage?.completion_tokens,
  };
}

export async function glmChat(
  messages: ChatMessage[],
  opts?: { temperature?: number }
): Promise<ChatResult> {
  return callGlm(messages, {
    temperature: opts?.temperature ?? 0.6,
    maxTokens: GLM_MAX_TOKENS_REASON,
  });
}

export async function glmExtractJson<T = unknown>(
  messages: ChatMessage[],
  opts?: { temperature?: number }
): Promise<{ data: T | null; raw: string; model: string }> {
  const res = await callGlm(messages, {
    temperature: opts?.temperature ?? 0.1,
    jsonMode: true,
    maxTokens: GLM_MAX_TOKENS_EXTRACT,
  });
  try {
    return { data: JSON.parse(res.content) as T, raw: res.content, model: res.model };
  } catch {
    return { data: null, raw: res.content, model: res.model };
  }
}

// Is an error from the fallback provider retryable? Same semantics as Groq:
// 429 and 5xx are transient; 4xx (auth/bad request) are hard failures.
export function isGlmRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return true;
  return status === 429 || status >= 500;
}
