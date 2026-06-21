import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect /admin/** (except /admin/login) and /api/admin/** with Supabase
// session auth. Unauthenticated UI requests redirect to /admin/login;
// unauthenticated API requests get a 401. The RBAC check (admin_users row)
// happens inside the individual pages/routes via requireCounsellor() — here
// we only gate on "has a valid Supabase session at all."
//
// Brute-force throttle: 10 failed login attempts per IP per 10 minutes → 429.
// The /api/admin/auth login route is also covered by this.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminUi = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminUi && !isAdminApi) return NextResponse.next();

  // Let the login page and its POST endpoint through without an auth check.
  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/auth";
  if (isLoginPage || isLoginApi) {
    // Forward pathname so the layout always knows which page it's rendering.
    // Brute-force throttle for login is handled inside /api/admin/auth/route.ts.
    return NextResponse.next({
      request: { headers: new Headers({ ...Object.fromEntries(req.headers), "x-pathname": pathname }) },
    });
  }

  // Build a response object so Supabase SSR can refresh the session cookie.
  // Also forward the pathname so layouts can detect the login page reliably,
  // even when a stale session cookie is still present after sign-out.
  const res = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(req.headers), "x-pathname": pathname }) },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2]);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isAdminApi) {
      return NextResponse.json(
        { error: "Unauthorized. Sign in at /admin/login." },
        { status: 401 }
      );
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
