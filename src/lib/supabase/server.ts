import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

// Server client bound to the request cookies (anon key + RLS). Use for reading
// the authenticated admin/counsellor session in server components / route
// handlers. Still subject to RLS — does NOT bypass it.
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // called from a Server Component — safe to ignore (middleware refreshes).
        }
      },
    },
  });
}
