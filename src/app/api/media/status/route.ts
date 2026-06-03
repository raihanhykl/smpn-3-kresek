import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth/with-api-auth';

export const dynamic = 'force-dynamic';

// GET /api/media/status — lightweight readiness probe for the admin UI.
// Returns { ready: true } when real Cloudinary credentials are configured;
// otherwise { ready: false } so the UI can disable the upload button with a
// "Akan tersedia setelah kredensial Cloudinary dikonfigurasi" hint.
//
// "Ready" is defined as: the cloud name is set to something other than the
// `.env.local` placeholder. This is deliberately conservative — once real
// creds arrive in Chunk 9 the placeholder is replaced and `ready` flips true.
export const GET = withApiAuth(['ADMIN', 'EDITOR'], async () => {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const ready =
    cloud.length > 0 &&
    cloud !== 'placeholder-replace-me' &&
    cloud !== 'test-cloud';
  return NextResponse.json({ ready });
});
