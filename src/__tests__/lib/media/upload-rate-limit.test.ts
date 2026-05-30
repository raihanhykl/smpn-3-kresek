/**
 * @jest-environment node
 */
import {
  uploadRateLimiter, getUploadRateLimitKey,
} from '@/lib/media/upload-rate-limit';

describe('uploadRateLimiter', () => {
  beforeEach(() => uploadRateLimiter.resetForTests());
  afterAll(() => uploadRateLimiter.resetForTests());

  it('allows the first 10 calls within the window', () => {
    const key = getUploadRateLimitKey('user-A', '127.0.0.1');
    for (let i = 0; i < 10; i++) {
      const r = uploadRateLimiter.check(key);
      expect(r.allowed).toBe(true);
      expect(r.retryAfterMs).toBe(0);
    }
  });

  it('blocks the 11th call with allowed=false and retryAfterMs > 0', () => {
    const key = getUploadRateLimitKey('user-B', '127.0.0.1');
    for (let i = 0; i < 10; i++) uploadRateLimiter.check(key);
    const blocked = uploadRateLimiter.check(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('treats different (user, ip) tuples as independent buckets', () => {
    const a = getUploadRateLimitKey('user-C', '10.0.0.1');
    const b = getUploadRateLimitKey('user-C', '10.0.0.2');
    for (let i = 0; i < 10; i++) uploadRateLimiter.check(a);
    expect(uploadRateLimiter.check(a).allowed).toBe(false);
    // Different IP, same user → fresh bucket.
    expect(uploadRateLimiter.check(b).allowed).toBe(true);
  });

  it('lets requests through again after the 60s window passes', () => {
    jest.useFakeTimers();
    try {
      const key = getUploadRateLimitKey('user-D', '127.0.0.1');
      for (let i = 0; i < 10; i++) uploadRateLimiter.check(key);
      expect(uploadRateLimiter.check(key).allowed).toBe(false);
      // Advance past the 60s window.
      jest.advanceTimersByTime(60_001);
      expect(uploadRateLimiter.check(key).allowed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns a properly formed key from getUploadRateLimitKey', () => {
    expect(getUploadRateLimitKey('u1', '1.2.3.4')).toBe('upload:u1:1.2.3.4');
  });
});
