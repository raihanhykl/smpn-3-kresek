import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { revalidateTag } from 'next/cache';
import { env } from '@/lib/env';
import { withApiAuth } from '@/lib/auth/with-api-auth';
import { uploadRateLimiter, getUploadRateLimitKey } from '@/lib/media/upload-rate-limit';
import { confirmRequestSchema, type ConfirmRequest } from '@/lib/validation/schemas/media';
import { MEDIA_LIMITS } from '@/lib/media/limits';
import { isOwnCloudinaryUrl } from '@/lib/media/url-allowlist';
import { createMediaAsset } from '@/lib/data/repositories/media-repo';
import { writeAudit } from '@/lib/security/audit';

export const dynamic = 'force-dynamic';

// POST /api/media/confirm
// Auth → rate-limit → schema → host allowlist → format/resource_type/size verify
// → createMediaAsset (P2002-idempotent on hash) → audit + revalidate → respond.
export const POST = withApiAuth(['ADMIN', 'EDITOR'], async (req, user) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = uploadRateLimiter.check(getUploadRateLimitKey(user.id, ip));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }
  let body: ConfirmRequest;
  try {
    body = confirmRequestSchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: 'invalid_request', detail: e.errors[0]?.message ?? 'invalid body' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!isOwnCloudinaryUrl(body.cloudinary.secure_url, env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)) {
    return NextResponse.json({ error: 'forbidden_host' }, { status: 400 });
  }
  const limits = MEDIA_LIMITS[body.kind];
  // Cloudinary omits `format` from raw (PDF) upload responses. Fall back to
  // the trailing extension of the secure_url so the format guard still has a
  // value to compare against.
  const format = body.cloudinary.format
    ?? body.cloudinary.secure_url.split('.').pop()?.toLowerCase()
    ?? '';
  if (!limits.cldFormats.includes(format as never)) {
    return NextResponse.json({ error: 'format_mismatch' }, { status: 415 });
  }
  if (body.kind === 'image' && body.cloudinary.resource_type !== 'image') {
    return NextResponse.json({ error: 'resource_type_mismatch' }, { status: 400 });
  }
  if (body.kind === 'pdf' && body.cloudinary.resource_type !== 'raw') {
    return NextResponse.json({ error: 'resource_type_mismatch' }, { status: 400 });
  }
  if (body.cloudinary.bytes > limits.maxBytes) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  // createMediaAsset (Chunk 3) is P2002-idempotent on hash AND publicId, so
  // two concurrent /confirm calls with the same sha256Hex both receive the
  // SAME media.id back (one writer wins, the loser looks up the winner's row).
  const media = await createMediaAsset({
    kind: body.kind,
    url: body.cloudinary.secure_url,
    publicId: body.cloudinary.public_id,
    hash: body.sha256Hex,
    alt: body.alt ?? null,
    filename: body.cloudinary.original_filename,
    sizeBytes: body.cloudinary.bytes,
    mimeType: body.declaredMime,
    width: body.cloudinary.width ?? null,
    height: body.cloudinary.height ?? null,
    uploadedBy: user.id,
  });

  // Audit failure must NEVER break the user request (matches the existing
  // entity actions' pattern).
  writeAudit({
    userId: user.id,
    action: 'media_create',
    target: `MediaAsset:${media.id}`,
    metadata: { kind: media.kind, sizeBytes: media.sizeBytes, publicId: media.publicId },
  }).catch(() => {});

  revalidateTag('media');
  return NextResponse.json({ ok: true, media });
});
