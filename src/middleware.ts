import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect /admin/** and /api/admin/** with HTTP Basic Auth.
// Set ADMIN_SECRET in .env.local. Any username + correct password grants access.
// If ADMIN_SECRET is unset the route is open (useful for local dev without a secret).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminUi  = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminUi && !isAdminApi) return NextResponse.next();

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return NextResponse.next();

  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.slice(decoded.indexOf(":") + 1);
      if (password === secret) return NextResponse.next();
    } catch {
      // malformed base64 — fall through to 401
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PathFinder Admin"' },
  });
}

export const config = { matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"] };
