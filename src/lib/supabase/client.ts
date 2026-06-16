"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Browser client. Uses the ANON key only and is constrained by RLS.
// It must NEVER be used to read/write student PII directly — those flow through
// server routes using the service role. Use this only for public KB reads or
// admin session auth.
export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
