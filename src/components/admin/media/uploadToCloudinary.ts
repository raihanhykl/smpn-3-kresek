import type { PublicMediaAsset } from '@/lib/validation/schemas/media';
import { MEDIA_LIMITS, type MediaKind } from '@/lib/media/limits';

/**
 * Phase 3 client-side upload pipeline:
 *
 *   1. Preflight: enforce size + mime BEFORE doing anything network-y so the
 *      user gets an instant message instead of waiting for the upload to fail.
 *   2. Compute SHA-256 hex with the SubtleCrypto API (available in browsers
 *      and modern Node test environments).
 *   3. POST /api/media/sign-upload. If hash already exists server-side
 *      ({ reused: true }), return that media — no Cloudinary round-trip.
 *   4. Build a Cloudinary FormData payload (api_key, timestamp, signature,
 *      public_id, folder, file) and POST it to the returned uploadUrl.
 *   5. POST the Cloudinary response to /api/media/confirm to persist
 *      MediaAsset (server re-validates host + format).
 *
 * Errors are thrown as instances of UploadError so the caller can map the
 * .code to Indonesian copy via uploadErrorMessage().
 */

export class UploadError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'UploadError';
  }
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

export type UploadOptions = {
  alt?: string;
};

export async function uploadToCloudinary(
  file: File,
  kind: MediaKind,
  opts: UploadOptions = {},
): Promise<PublicMediaAsset> {
  const limits = MEDIA_LIMITS[kind];
  if (file.size > limits.maxBytes) {
    throw new UploadError('preflight_too_large');
  }
  if (!limits.mimes.includes(file.type as never)) {
    throw new UploadError('preflight_wrong_type');
  }

  const hash = await sha256Hex(file);

  // 1) Ask the server for a signature (or be told the hash is already known).
  const signRes = await fetch('/api/media/sign-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind,
      mimeType: file.type,
      sizeBytes: file.size,
      sha256Hex: hash,
      filename: file.name,
      ...(opts.alt ? { alt: opts.alt } : {}),
    }),
  });
  if (!signRes.ok) {
    const errBody = await signRes.json().catch(() => ({}));
    throw new UploadError(errBody.error ?? 'unknown_error');
  }
  const signBody: SignUploadResponse = await signRes.json();
  if (signBody.reused) return signBody.media;

  // 2) Upload directly to Cloudinary.
  const fd = new FormData();
  fd.append('api_key', signBody.apiKey);
  fd.append('timestamp', String(signBody.timestamp));
  fd.append('signature', signBody.signature);
  fd.append('public_id', signBody.publicId);
  fd.append('folder', signBody.folder);
  fd.append('file', file);
  const cldRes = await fetch(signBody.uploadUrl, { method: 'POST', body: fd });
  if (!cldRes.ok) throw new UploadError('cloudinary_failed');
  const cld = (await cldRes.json()) as CloudinaryUploadResponse;

  // 3) Confirm to persist the MediaAsset row.
  const confirmRes = await fetch('/api/media/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind,
      declaredMime: file.type,
      sha256Hex: hash,
      ...(opts.alt ? { alt: opts.alt } : {}),
      cloudinary: {
        public_id: cld.public_id,
        secure_url: cld.secure_url,
        bytes: cld.bytes,
        format: cld.format,
        resource_type: cld.resource_type,
        original_filename: cld.original_filename,
        signature: cld.signature,
        ...(cld.width !== undefined ? { width: cld.width } : {}),
        ...(cld.height !== undefined ? { height: cld.height } : {}),
      },
    }),
  });
  if (!confirmRes.ok) {
    const errBody = await confirmRes.json().catch(() => ({}));
    throw new UploadError(errBody.error ?? 'unknown_error');
  }
  const confirmBody: { ok: true; media: PublicMediaAsset } = await confirmRes.json();
  return confirmBody.media;
}

// ─── Local types ────────────────────────────────────────────────────────

type SignUploadResponse =
  | { reused: true; media: PublicMediaAsset }
  | {
      reused: false;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      publicId: string;
      folder: string;
      resourceType: 'image' | 'raw';
      uploadUrl: string;
    };

type CloudinaryUploadResponse = {
  public_id: string;
  secure_url: string;
  bytes: number;
  format: string;
  resource_type: 'image' | 'raw';
  original_filename: string;
  signature: string;
  width?: number;
  height?: number;
};
