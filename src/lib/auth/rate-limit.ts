type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimiter = {
  check(key: string): RateLimitResult;
  /**
   * TEST-ONLY: clear all buckets. Used by integration tests to prevent
   * cross-test rate-limit pollution when a singleton limiter is shared.
   * Calling this in production is a no-op semantically (just resets state)
   * but should never be wired into request paths.
   */
  resetForTests(): void;
};

export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  // Buckets are not GC'd; expired entries are overwritten only when the same key
  // returns. Acceptable for single-VPS low-traffic profile (sekolah site). If we
  // ever scale horizontally or face IP-rotation abuse, swap to Redis (same API).
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return { allowed: true, remaining: opts.max - 1, retryAfterMs: 0 };
      }
      if (existing.count >= opts.max) {
        return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
      }
      existing.count += 1;
      return {
        allowed: true,
        remaining: opts.max - existing.count,
        retryAfterMs: 0,
      };
    },
    resetForTests(): void {
      buckets.clear();
    },
  };
}

// Default exported limiter for login: 5 attempts per 15 minutes per key.
// The max is overridable via LOGIN_RATE_LIMIT_MAX so the E2E deployment (where
// every request shares one localhost IP bucket and the suite legitimately logs
// in many times) can raise the ceiling WITHOUT weakening the production
// default. Falls back to 5 when unset or non-numeric.
function loginRateLimitMax(): number {
  const raw = process.env.LOGIN_RATE_LIMIT_MAX;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export const loginRateLimiter = createRateLimiter({
  max: loginRateLimitMax(),
  windowMs: 15 * 60 * 1000,
});
