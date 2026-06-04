import 'server-only';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/lib/env';

/**
 * Cloudinary hard delete. Mirrors cloudinary-sign.ts's NODE_ENV==='test' stub
 * gate so jest never hits the network.
 *
 * Unlike signing (which passes the secret explicitly to api_sign_request),
 * uploader.destroy builds an authenticated API call and throws "Must supply
 * api_key" unless cloudinary.config() is set — and this project sets neither
 * cloudinary.config() nor CLOUDINARY_URL. So configure it here, once.
 */
let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export type DestroyResult = 'destroyed' | 'not_found';

/**
 * Delete a Cloudinary asset. `resourceType` MUST match how it was uploaded:
 * image → 'image', pdf → 'raw' (PDFs upload as raw). Pass the publicId exactly
 * as stored on MediaAsset — for raw/PDF that includes the .pdf extension, which
 * a raw destroy requires.
 *
 * Returns 'destroyed' on result 'ok', 'not_found' on result 'not found'
 * (idempotent — caller treats it as success). Any other result or a thrown
 * SDK/network error is rethrown so the caller can abort and keep the DB row.
 */
export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: 'image' | 'raw',
): Promise<DestroyResult> {
  if (process.env.NODE_ENV === 'test') {
    return 'destroyed';
  }
  ensureConfigured();
  const res = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
  if (res.result === 'ok') return 'destroyed';
  if (res.result === 'not found') return 'not_found';
  throw new Error(`Cloudinary destroy failed: ${res.result}`);
}
