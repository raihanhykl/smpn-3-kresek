import { createRateLimiter } from '@/lib/auth/rate-limit';

/**
 * Phase 3 upload rate limiter — 10 requests per 60 seconds per `userId:ip`
 * tuple. Shared between /api/media/sign-upload and /api/media/confirm so a
 * single upload (sign + confirm) counts as 2 requests. Reused by /api/media/list
 * for v1 (see Chunk 5.1 comment); if pagination back-pressure becomes a UX
 * issue, split into a `listRateLimiter({ max: 60, windowMs: 60_000 })`.
 *
 * Limits derived from a single-VPS profile: 10/min × ~5 admins ≈ 50 uploads
 * per minute aggregate, well under Cloudinary's free-tier upload caps.
 */
export const uploadRateLimiter = createRateLimiter({
  max: 10,
  windowMs: 60 * 1000,
});

export function getUploadRateLimitKey(userId: string, ip: string): string {
  return `upload:${userId}:${ip}`;
}
