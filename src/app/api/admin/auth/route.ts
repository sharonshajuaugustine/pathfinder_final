import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { clientIpHash, badRequest, serverError } from "@/lib/request";
import { audit } from "@/lib/audit";

// POST /api/admin/auth
// Sign in with email + password. Uses NextRequest/NextResponse cookie API so
// the session cookie is actually written to the response — the server.ts helper
// uses next/headers cookies() which is read-only from route handlers.
const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const ipHash = await clientIpHash(req);
  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid login payload", parsed.error.flatten());

  const { email, password } = parsed.data;

  // Build the response first so the Supabase SSR client can attach session
  // cookies to it directly via res.cookies.set().
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
          );
        },
      },
    }
  );

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      await audit({
        actorType: "system",
        action: "admin.login_failed",
        entity: "admin_users",
        meta: { email },
        ipHash,
      });
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // RBAC gate: confirm this auth user has an active admin_users row.
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id, email, full_name, role, is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!adminRow || !adminRow.is_active) {
      await supabase.auth.signOut();
      await audit({
        actorType: "system",
        action: "admin.login_denied_not_staff",
        entity: "admin_users",
        entityId: data.user.id,
        meta: { email },
        ipHash,
      });
      return NextResponse.json(
        { error: "This account is not authorized to access the admin dashboard." },
        { status: 403 }
      );
    }

    await audit({
      actorType: adminRow.role,
      actorId: adminRow.id,
      action: "admin.login_success",
      entity: "admin_users",
      entityId: adminRow.id,
      ipHash,
    });

    // Return the pre-built response — session cookies are already attached.
    return res;
  } catch (e) {
    console.error(e);
    return serverError("Login failed");
  }
}
