import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { env } from '@/lib/env';
import { withApiAuth } from '@/lib/auth/with-api-auth';
import { uploadRateLimiter, getUploadRateLimitKey } from '@/lib/media/upload-rate-limit';
import { signUploadRequestSchema, type SignUploadRequest } from '@/lib/validation/schemas/media';
import { MEDIA_LIMITS } from '@/lib/media/limits';
import { signCloudinaryUpload } from '@/lib/media/cloudinary-sign';
import { getMediaAssetByHash } from '@/lib/data/repositories/media-repo';

export const dynamic = 'force-dynamic';

// POST /api/media/sign-upload
// Auth → rate-limit → schema → mime/size guard → hash dedup pre-check → sign.
// MediaUsage is NEVER written here — uploads land as orphans (Chunk 6+ links).
export const POST = withApiAuth(['ADMIN', 'EDITOR'], async (req, user) => {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = uploadRateLimiter.check(getUploadRateLimitKey(user.id, ip));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }
  let body: SignUploadRequest;
  try {
    body = signUploadRequestSchema.parse(await req.json());
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { error: 'invalid_request', detail: e.errors[0]?.message ?? 'invalid body' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const limits = MEDIA_LIMITS[body.kind];
  if (!limits.mimes.includes(body.mimeType as never)) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
  }
  if (body.sizeBytes > limits.maxBytes) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 });
  }

  // Hash-first dedup: if the bytes already exist on our cloud, return the
  // existing row and skip both the signature and the Cloudinary upload.
  const existing = await getMediaAssetByHash(body.sha256Hex);
  if (existing) return NextResponse.json({ reused: true, media: existing });

  // publicId carries the full folder path; we deliberately do NOT send a
  // separate `folder` param to Cloudinary. Cloudinary's upload endpoint
  // concatenates folder + public_id, so sending both would produce a
  // double-prefixed publicId like `smpn3kresek/image/smpn3kresek/image/abc`.
  const publicId = `smpn3kresek/${body.kind}/${body.sha256Hex.slice(0, 16)}`;
  const resourceType = body.kind === 'pdf' ? 'raw' : 'image';
  const timestamp = Math.floor(Date.now() / 1000);
  const { signature, apiKey } = signCloudinaryUpload({ publicId, folder: '', timestamp, resourceType });

  return NextResponse.json({
    reused: false,
    cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    apiKey,
    timestamp,
    signature,
    publicId,
    // No folder in the response either — client must NOT include it in the
    // FormData sent to Cloudinary, otherwise the double-prefix bug returns.
    resourceType,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
  });
});
