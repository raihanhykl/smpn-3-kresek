/**
 * @jest-environment node
 */
import { photoSchema } from '@/lib/validation/schemas/shared';

describe('photoSchema (Phase 3 publicId semantics)', () => {
  describe('url branch', () => {
    it('accepts a well-formed Cloudinary publicId with alt text', () => {
      const r = photoSchema.safeParse({
        kind: 'url',
        src: 'smpn3kresek/image/abc123',
        alt: 'Pak Budi, Kepala Sekolah',
      });
      expect(r.success).toBe(true);
    });

    it('rejects a full https URL (would re-introduce vendor lock-in)', () => {
      const r = photoSchema.safeParse({
        kind: 'url',
        src: 'https://res.cloudinary.com/foo/bar.jpg',
        alt: 'x',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        // First error is the regex failure ("harus berupa Cloudinary publicId")
        // because `://` characters also break the publicId charset.
        expect(r.error.errors[0]?.message).toMatch(/publicId/);
      }
    });

    it('rejects a leading-slash path (not a publicId)', () => {
      const r = photoSchema.safeParse({
        kind: 'url',
        src: '/uploads/foo.jpg',
        alt: 'x',
      });
      expect(r.success).toBe(false);
    });

    it('rejects a publicId with disallowed characters', () => {
      const r = photoSchema.safeParse({
        kind: 'url',
        src: 'smpn3kresek/image/bad space',
        alt: 'x',
      });
      expect(r.success).toBe(false);
    });

    it('rejects empty alt text (required for a11y)', () => {
      const r = photoSchema.safeParse({
        kind: 'url',
        src: 'smpn3kresek/image/abc',
        alt: '',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.errors[0]?.message).toMatch(/Alt/i);
      }
    });
  });

  describe('gradient branch (unchanged)', () => {
    it('accepts a well-formed gradient + emoji', () => {
      const r = photoSchema.safeParse({
        kind: 'gradient',
        from: '#DBEAFE',
        to: '#93C5FD',
        emoji: '👤',
      });
      expect(r.success).toBe(true);
    });

    it('rejects empty emoji (existing rule preserved)', () => {
      const r = photoSchema.safeParse({
        kind: 'gradient',
        from: '#DBEAFE',
        to: '#93C5FD',
        emoji: '',
      });
      expect(r.success).toBe(false);
    });
  });
});
