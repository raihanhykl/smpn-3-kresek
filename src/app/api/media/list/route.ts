import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/auth/with-api-auth';
import { uploadRateLimiter, getUploadRateLimitKey } from '@/lib/media/upload-rate-limit';
import { listMediaAssets } from '@/lib/data/repositories/media-repo';
import { mediaKindSchema } from '@/lib/validation/schemas/media';

export const dynamic = 'force-dynamic';

// Reusing uploadRateLimiter is intentional for v1: a single per-admin bucket
// covers sign/confirm/list. If pagination back-pressure becomes a UX problem
// (e.g. grid scrolling burns the 10/60s budget), add a dedicated
// `listRateLimiter({ max: 60, windowMs: 60_000 })` and split here.

const querySchema = z.object({
  kind: mediaKindSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

// GET /api/media/list?kind=image&cursor=<id>&limit=24
export const GET = withApiAuth(['ADMIN', 'EDITOR'], async (req, user) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = uploadRateLimiter.check(getUploadRateLimitKey(user.id, ip));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    kind: url.searchParams.get('kind') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', detail: parsed.error.errors[0]?.message ?? 'invalid query' },
      { status: 400 },
    );
  }
  // exactOptionalPropertyTypes is on, so build the args object conditionally.
  const args: Parameters<typeof listMediaAssets>[0] = { cursor: parsed.data.cursor ?? null };
  if (parsed.data.kind !== undefined) args.kind = parsed.data.kind;
  if (parsed.data.limit !== undefined) args.limit = parsed.data.limit;
  const { items, nextCursor } = await listMediaAssets(args);
  return NextResponse.json({ items, nextCursor });
});
