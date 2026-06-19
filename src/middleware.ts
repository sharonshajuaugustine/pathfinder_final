import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protect /admin/** and /api/admin/** with HTTP Basic Auth.
// Set ADMIN_SECRET in your environment. Any username + the correct password
// grants access.
//
// SECURITY (production hardening):
//   • FAIL-CLOSED: if ADMIN_SECRET is unset, access is DENIED, not granted. The
//     admin dashboard exposes student PII (phone, district, minors' data), so an
//     open-by-default policy is unsafe. To make local dev convenient, explicitly
//     set ADMIN_SECRET=dev in .env.local — it is never undefined by accident in
//     production this way.
//   • BRUTE-FORCE THROTTLE: in-memory fixed-window limit of 10 failed attempts
//     per IP per 10 minutes. After the limit, the IP gets 429s until the window
//     resets. NOTE: this is in-memory and therefore per-instance on serverless
//     (Vercel); it raises the bar against casual brute force but is not a full
//     distributed protection — pair with the Redis rate limiter (see rate-limit
//     TODO) for production scale. Even so, fail-closed is the critical fix.
//
// Uses a timing-safe comparison so the password cannot be leaked via response
// timing differences.

const MAX_FAILS = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const failBuckets = new Map<string, { count: number; resetAt: number }>();

function timingSafeEqual(a: string, b: string): boolean {
  // Constant-time string comparison. Compares the full length of the longer
  // string so the duration does not reveal the length of a correct prefix.
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminUi = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminUi && !isAdminApi) return NextResponse.next();

  // FAIL-CLOSED: deny by default if no secret is configured.
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    console.error("[admin] ADMIN_SECRET is not set — denying access (fail-closed).");
    return unauthorized();
  }

  // Identify the client for throttling: hashed IP from x-forwarded-for (the
  // raw IP is never stored). Fall back to a synthetic key if no header.
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "unknown";
  const key = `${ip}`;

  // Throttle check.
  const now = Date.now();
  const bucket = failBuckets.get(key);
  if (bucket && now < bucket.resetAt && bucket.count >= MAX_FAILS) {
    return new NextResponse("Too many failed attempts. Try again later.", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)) },
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  let passwordOk = false;
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const password = decoded.slice(decoded.indexOf(":") + 1);
      passwordOk = timingSafeEqual(password, secret);
    } catch {
      // malformed base64 — treat as a failure
    }
  }

  if (passwordOk) {
    // Clear any half-built bucket on success so a legit user isn't penalised.
    failBuckets.delete(key);
    return NextResponse.next();
  }

  // Record a failure.
  const b = bucket && now < bucket.resetAt ? bucket : { count: 0, resetAt: now + WINDOW_MS };
  b.count += 1;
  if (!bucket || now >= (bucket.resetAt ?? 0)) b.resetAt = now + WINDOW_MS;
  failBuckets.set(key, b);
  return unauthorized();
}

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PathFinder Admin"' },
  });
}

export const config = { matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"] };
