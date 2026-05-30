import 'server-only';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/lib/env';

/**
 * Phase 3 Cloudinary signer.
 *
 * The stub gate keys on `NODE_ENV === 'test'` (jest sets this automatically),
 * NOT on placeholder secret values. That makes the gate impossible to bypass
 * accidentally once real production creds land in `.env.local`.
 *
 * Live path uses `cloudinary.utils.api_sign_request` from the official SDK.
 * The SDK is server-only (uploaded via direct-to-Cloudinary signed flow), so
 * `import 'server-only'` blocks accidental client bundling.
 */

export type SignParams = {
  publicId: string;
  folder: string;
  timestamp: number;
  resourceType: 'image' | 'raw';
};

export type SignResult = {
  signature: string;
  apiKey: string;
};

export function signCloudinaryUpload(p: SignParams): SignResult {
  if (process.env.NODE_ENV === 'test') {
    // Deterministic stub so tests can assert exact response shapes without a
    // real Cloudinary round-trip.
    return {
      signature: `stub-signature-${p.publicId}`,
      apiKey: 'test-key',
    };
  }
  // Cloudinary signature covers ONLY the params the client will send back at
  // upload time. The SDK alphabetizes internally; the order here is just for
  // readability. We omit `folder` when empty so the client can mirror that on
  // upload (sending an empty folder would still mutate Cloudinary's hash).
  const params: Record<string, string | number> = {
    public_id: p.publicId,
    timestamp: p.timestamp,
  };
  if (p.folder) params.folder = p.folder;
  const signature = cloudinary.utils.api_sign_request(
    params,
    env.CLOUDINARY_API_SECRET,
  );
  return { signature, apiKey: env.CLOUDINARY_API_KEY };
}
