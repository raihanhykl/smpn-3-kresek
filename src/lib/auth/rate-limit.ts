type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimiter = {
  check(key: string): RateLimitResult;
};

export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
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
  };
}

// Default exported limiter for login: 5 attempts per 15 minutes per key.
export const loginRateLimiter = createRateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
