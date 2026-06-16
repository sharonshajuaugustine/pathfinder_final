import { NextRequest, NextResponse } from "next/server";
import { hashIdentifier } from "@/lib/utils";
import { limiters, rateKey, type RateLimiter } from "@/lib/rate-limit";

// Derive a privacy-preserving client identifier (hashed IP). Never store raw IP.
export async function clientIpHash(req: NextRequest): Promise<string> {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || "unknown";
  return hashIdentifier(ip);
}

// Apply a named limiter; returns a 429 response if exceeded, else null.
export async function enforceRateLimit(
  limiter: RateLimiter,
  scope: string,
  parts: (string | undefined)[]
): Promise<NextResponse | null> {
  const { allowed, remaining, resetAt } = await limiter.limit(rateKey(scope, parts));
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
    );
  }
  return null;
}

export { limiters };

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function serverError(message = "Something went wrong") {
  return NextResponse.json({ error: message }, { status: 500 });
}
