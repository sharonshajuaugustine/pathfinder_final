// Shared AI provider types. Both the Groq client (src/lib/groq.ts) and the GLM
// fallback client (src/lib/glm.ts) use these so the fallback layer can swap
// providers without the callers caring which one ran.

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
