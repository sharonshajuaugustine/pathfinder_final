import { serverEnv } from "@/lib/env";

// Single source of truth for the KB version stamped on every recommendation.
// Bump KB_VERSION (env) whenever the knowledge base content changes so old
// recommendations remain reproducible.
export function currentKbVersion(): string {
  return serverEnv.kbVersion;
}
