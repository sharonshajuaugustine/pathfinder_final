import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

// SERVICE ROLE client. Bypasses RLS. SERVER-ONLY.
// The `server-only` import above makes the build FAIL if this module is ever
// imported into a client component — a hard guardrail against leaking the key.
//
// Use this for all student PII writes (onboarding, chat, profile, recommendation)
// performed inside trusted server routes/actions.
// Typed with `any` Database generic: we don't generate Supabase DB types for
// MVP, so `.from()` stays permissive instead of resolving rows to `never`.
/* eslint-disable */
let cached: ReturnType<typeof createClient<any>> | null = null;

export function getServiceClient() {
  if (cached) return cached;
  cached = createClient<any>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
