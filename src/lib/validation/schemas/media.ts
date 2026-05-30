import { z } from 'zod';
import type { MediaKind } from '@/lib/media/limits';

/**
 * Phase 3 Cloudinary endpoint contracts. Shared between client (uploader),
 * server (route handlers), and tests.
 */

export const mediaKindSchema = z.enum(['image', 'pdf']);

// SHA-256 hex, lowercase, 64 chars. The client computes this before /sign-upload
// so the server can dedup on hash without ever proxying the bytes.
const sha256Hex = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'Hash tidak valid (harus SHA-256 hex 64 karakter).');

// ─── /api/media/sign-upload ──────────────────────────────────────────────
//
// Client → server: file metadata + content hash.
// Server runs: auth → rate-limit → schema parse → mime/size guard →
//              hash dedup → cloudinary signature → respond.
export const signUploadRequestSchema = z.object({
  kind: mediaKindSchema,
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  sha256Hex,
  filename: z.string().min(1).max(255),
  alt: z.string().max(300).optional(),
});
export type SignUploadRequest = z.infer<typeof signUploadRequestSchema>;

// Discriminated response: either reused-existing (skip Cloudinary entirely)
// or fresh-signature (client must POST to Cloudinary then call /confirm).
export type SignUploadResponse =
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

// ─── /api/media/confirm ──────────────────────────────────────────────────
//
// Client → server: echoed claim + Cloudinary's upload response.
// Server runs: auth → rate-limit → schema parse → host allowlist →
//              format/resource_type/size verify → createMediaAsset (idempotent
//              on hash) → audit + revalidate → respond.
export const confirmRequestSchema = z.object({
  kind: mediaKindSchema,
  declaredMime: z.string(),
  sha256Hex,
  alt: z.string().max(300).optional(),
  cloudinary: z.object({
    public_id: z.string(),
    secure_url: z.string().url(),
    bytes: z.number().int().positive(),
    format: z.string(),
    resource_type: z.enum(['image', 'raw']),
    original_filename: z.string(),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    signature: z.string(),
  }),
});
export type ConfirmRequest = z.infer<typeof confirmRequestSchema>;

// ─── Public projection ───────────────────────────────────────────────────
//
// The shape returned to the client by /sign-upload (reused), /confirm, and
// /list. Strips internal columns (uploadedBy, audit timestamps).
//
// `url` is a denormalized cache populated at confirm time; render code MUST
// resolve via `cldUrl(publicId, variant)` instead. The branded type lands in
// Chunk 10 — for now this is documentation.
export type PublicMediaAsset = {
  id: string;
  kind: MediaKind;
  url: string;
  publicId: string;
  alt: string | null;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  width: number | null;
  height: number | null;
};
