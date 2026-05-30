/**
 * @jest-environment node
 */
import {
  signUploadRequestSchema, confirmRequestSchema, mediaKindSchema,
} from '@/lib/validation/schemas/media';

const goodHash = 'a'.repeat(64);

describe('media validation schemas', () => {
  describe('mediaKindSchema', () => {
    it('accepts image and pdf', () => {
      expect(mediaKindSchema.safeParse('image').success).toBe(true);
      expect(mediaKindSchema.safeParse('pdf').success).toBe(true);
    });
    it('rejects unknown kinds', () => {
      expect(mediaKindSchema.safeParse('video').success).toBe(false);
    });
  });

  describe('signUploadRequestSchema', () => {
    const base = {
      kind: 'image' as const,
      mimeType: 'image/jpeg',
      sizeBytes: 200_000,
      sha256Hex: goodHash,
      filename: 'pak-budi.jpg',
    };

    it('accepts a happy-path image request (no alt)', () => {
      expect(signUploadRequestSchema.safeParse(base).success).toBe(true);
    });

    it('accepts a request with optional alt', () => {
      const r = signUploadRequestSchema.safeParse({ ...base, alt: 'Pak Budi' });
      expect(r.success).toBe(true);
    });

    it('rejects a 63-char (truncated) hash', () => {
      const r = signUploadRequestSchema.safeParse({ ...base, sha256Hex: 'a'.repeat(63) });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.errors[0]?.message).toMatch(/Hash/);
    });

    it('rejects upper-case hex in the hash (must be lowercase to dedup correctly)', () => {
      const r = signUploadRequestSchema.safeParse({ ...base, sha256Hex: 'A'.repeat(64) });
      expect(r.success).toBe(false);
    });

    it('accepts oversized sizeBytes at schema layer (size limit enforced in the route)', () => {
      const r = signUploadRequestSchema.safeParse({ ...base, sizeBytes: 50 * 1024 * 1024 });
      expect(r.success).toBe(true);
    });

    it('rejects negative or zero sizeBytes', () => {
      expect(signUploadRequestSchema.safeParse({ ...base, sizeBytes: 0 }).success).toBe(false);
      expect(signUploadRequestSchema.safeParse({ ...base, sizeBytes: -1 }).success).toBe(false);
    });

    it('rejects empty filename', () => {
      expect(signUploadRequestSchema.safeParse({ ...base, filename: '' }).success).toBe(false);
    });
  });

  describe('confirmRequestSchema', () => {
    const base = {
      kind: 'image' as const,
      declaredMime: 'image/jpeg',
      sha256Hex: goodHash,
      cloudinary: {
        public_id: 'smpn3kresek/image/aabbccddeeff0011',
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v123/smpn3kresek/image/aabbccddeeff0011.jpg',
        bytes: 200_000,
        format: 'jpg',
        resource_type: 'image' as const,
        original_filename: 'pak-budi',
        signature: 'cloudinary-signature-string',
      },
    };

    it('accepts a happy-path image confirm', () => {
      expect(confirmRequestSchema.safeParse(base).success).toBe(true);
    });

    it('accepts a pdf confirm with raw resource_type', () => {
      const r = confirmRequestSchema.safeParse({
        ...base,
        kind: 'pdf',
        declaredMime: 'application/pdf',
        cloudinary: { ...base.cloudinary, format: 'pdf', resource_type: 'raw' },
      });
      expect(r.success).toBe(true);
    });

    it('rejects cross-type resource_type', () => {
      const r = confirmRequestSchema.safeParse({
        ...base,
        cloudinary: { ...base.cloudinary, resource_type: 'video' },
      });
      expect(r.success).toBe(false);
    });

    it('rejects non-URL secure_url', () => {
      const r = confirmRequestSchema.safeParse({
        ...base,
        cloudinary: { ...base.cloudinary, secure_url: 'not a url' },
      });
      expect(r.success).toBe(false);
    });
  });
});
