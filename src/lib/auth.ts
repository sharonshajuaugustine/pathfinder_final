import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Counsellor authentication (Supabase Auth + admin_users RBAC).
//
// The auth model:
//   • Counsellors sign in at /admin/login with email + password via Supabase
//     Auth (createServerClient from @supabase/ssr manages the session cookie).
//   • Their auth.users id must have a matching row in admin_users (is_active).
//   • This helper resolves the CURRENT request's session → admin_users row and
//     returns a Counsellor, or null if not signed in / not an active staff member.
//
// RLS note: admin_users has a staff-read policy via is_staff(), so the anon-key
// server client can read the signed-in user's own row. We never use the service
// role here — least privilege.
// ---------------------------------------------------------------------------

export interface Counsellor {
  id: string;          // == auth.users.id == admin_users.id
  email: string;
  fullName: string | null;
  role: "admin" | "counsellor";
}

// Row shape returned from the admin_users lookup.
interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "counsellor";
  is_active: boolean;
}

// Resolve the signed-in counsellor for the current request, or null.
// Returns null (never throws) so callers can treat "no session" uniformly.
export async function getCounsellor(): Promise<Counsellor | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Look up the matching admin_users row. RLS allows a user to read their own
    // row (admin_users_self_read policy).
    const { data, error } = (await supabase
      .from("admin_users")
      .select("id, email, full_name, role, is_active")
      .eq("id", user.id)
      .maybeSingle()) as { data: AdminUserRow | null; error: unknown };

    if (error || !data) return null;
    if (!data.is_active) return null; // deactivated staff cannot access

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
    };
  } catch {
    return null;
  }
}

// Convenience guard for API routes: returns the counsellor or a 401 NextResponse.
// Usage:
//   const [me, denied] = await requireCounsellor();
//   if (denied) return denied;
export async function requireCounsellor(): Promise<[Counsellor, null] | [null, NextResponse]> {
  const me = await getCounsellor();
  if (!me) {
    return [
      null,
      NextResponse.json({ error: "Unauthorized. Sign in at /admin/login." }, { status: 401 }),
    ];
  }
  return [me, null];
}
