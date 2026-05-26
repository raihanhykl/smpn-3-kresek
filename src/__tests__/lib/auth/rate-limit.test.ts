import { createRateLimiter } from '@/lib/auth/rate-limit';

describe('rate limiter (token bucket)', () => {
  it('allows up to N attempts within window', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(limiter.check('ip-1').allowed).toBe(true);
    expect(limiter.check('ip-1').allowed).toBe(true);
    expect(limiter.check('ip-1').allowed).toBe(true);
    expect(limiter.check('ip-1').allowed).toBe(false);
  });

  it('returns remaining count', () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(limiter.check('ip-2').remaining).toBe(2);
    expect(limiter.check('ip-2').remaining).toBe(1);
    expect(limiter.check('ip-2').remaining).toBe(0);
  });

  it('isolates keys', () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(limiter.check('ip-a').allowed).toBe(true);
    expect(limiter.check('ip-b').allowed).toBe(true);
    expect(limiter.check('ip-a').allowed).toBe(false);
  });

  it('resets after window expires', () => {
    jest.useFakeTimers();
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(limiter.check('ip-c').allowed).toBe(true);
    expect(limiter.check('ip-c').allowed).toBe(false);
    jest.advanceTimersByTime(1001);
    expect(limiter.check('ip-c').allowed).toBe(true);
    jest.useRealTimers();
  });

  it('resets at exact boundary (now === resetAt)', () => {
    jest.useFakeTimers();
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(limiter.check('ip-boundary').allowed).toBe(true);
    expect(limiter.check('ip-boundary').allowed).toBe(false);
    jest.advanceTimersByTime(1000); // exactly the boundary
    expect(limiter.check('ip-boundary').allowed).toBe(true);
    jest.useRealTimers();
  });

  it('returns retryAfterMs when blocked', () => {
    jest.useFakeTimers();
    const limiter = createRateLimiter({ max: 1, windowMs: 5000 });
    limiter.check('ip-d');
    const result = limiter.check('ip-d');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(5000);
    jest.useRealTimers();
  });

  // --- spec-locked values ---

  it('exported loginRateLimiter uses spec values (max=5, window=15min)', () => {
    jest.useFakeTimers();
    jest.resetModules();
    let loginRateLimiter: { check: (k: string) => { allowed: boolean } };
    jest.isolateModules(() => {
      loginRateLimiter = require('@/lib/auth/rate-limit').loginRateLimiter;
    });
    const KEY = 'spec-check-ip';
    for (let i = 0; i < 5; i++) {
      expect(loginRateLimiter!.check(KEY).allowed).toBe(true);
    }
    expect(loginRateLimiter!.check(KEY).allowed).toBe(false);
    // Verify window: still blocked just before 15min
    jest.advanceTimersByTime(15 * 60 * 1000 - 1);
    expect(loginRateLimiter!.check(KEY).allowed).toBe(false);
    // Released right at 15min
    jest.advanceTimersByTime(1);
    expect(loginRateLimiter!.check(KEY).allowed).toBe(true);
    jest.useRealTimers();
  });
});
