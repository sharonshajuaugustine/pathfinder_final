// Shared AI types used by src/lib/groq.ts.

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
