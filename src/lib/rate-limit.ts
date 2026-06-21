// ---------------------------------------------------------------------------
// Rate-limit PLACEHOLDER.
//
// In-memory fixed-window limiter. This is intentionally a placeholder: it works
// for a single instance / local dev but does NOT hold across serverless
// instances. Before production scale, swap `MemoryLimiter` for a Redis-backed
// implementation (Upstash) behind the same `RateLimiter` interface.
//
// Wired now so every AI/PII route is rate-limited from day one (cost + abuse
// protection), per the security plan.
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

class MemoryLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private max: number, private windowMs: number) {}

  async limit(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now > b.resetAt) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.max - 1, resetAt };
    }
    b.count += 1;
    return {
      allowed: b.count <= this.max,
      remaining: Math.max(0, this.max - b.count),
      resetAt: b.resetAt,
    };
  }
}

// TODO(redis): replace with RedisLimiter when Redis is provisioned.
// export class RedisLimiter implements RateLimiter { ... }

// Named limiters per route class. Tune limits per real traffic.
export const limiters = {
  // Expensive AI calls — strict.
  chat: new MemoryLimiter(30, 60_000), // 30 msgs / minute / key
  // Onboarding / writes — moderate.
  write: new MemoryLimiter(20, 60_000),
  // Recommendation generation — strict (most expensive).
  recommend: new MemoryLimiter(5, 60_000),
  // Admin login — 10 attempts per 10 minutes per IP.
  login: new MemoryLimiter(10, 10 * 60_000),
};

// Build a limiter key from session + hashed ip.
export function rateKey(scope: string, parts: (string | undefined)[]): string {
  return [scope, ...parts.filter(Boolean)].join(":");
}
