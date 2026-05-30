import 'server-only';

/**
 * Phase 3 Cloudinary signer.
 *
 * The stub gate keys on `NODE_ENV === 'test'` (jest sets this automatically),
 * NOT on placeholder secret values. That makes the gate impossible to bypass
 * accidentally once real production creds land in `.env.local`.
 *
 * The live path is intentionally NOT implemented yet — Chunk 9 swaps the stub
 * for `cloudinary.utils.api_sign_request(...)` once the school provides Cloudinary
 * credentials. Until then, calling this outside a test environment throws,
 * which keeps the broken state visible (rather than silently malformed).
 */

import { env } from '@/lib/env';

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
    // Deterministic stub so tests can assert exact response shapes.
    return {
      signature: `stub-signature-${p.publicId}`,
      apiKey: 'test-key',
    };
  }
  // Chunk 9 (post-credentials) replaces this throw with the real signer:
  //   const { v2: cloudinary } = await import('cloudinary');
  //   cloudinary.config({
  //     cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  //     api_key: env.CLOUDINARY_API_KEY,
  //     api_secret: env.CLOUDINARY_API_SECRET,
  //   });
  //   const signature = cloudinary.utils.api_sign_request(
  //     { public_id: p.publicId, folder: p.folder, timestamp: p.timestamp },
  //     env.CLOUDINARY_API_SECRET,
  //   );
  //   return { signature, apiKey: env.CLOUDINARY_API_KEY };
  // Reference env so the typechecker complains if the import gets stripped.
  void env.CLOUDINARY_API_KEY;
  throw new Error(
    'Cloudinary signer is not wired yet — set NODE_ENV=test for the stub or wait for Chunk 9.',
  );
}
