/**
 * @jest-environment node
 */
import { cldUrl, CLD_VARIANTS } from '@/lib/media/cldUrl';

// jest.setup.ts sets NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME='test-cloud' before module load.
const CLOUD = 'test-cloud';

describe('cldUrl', () => {
  it('builds the avatar URL with the documented transform', () => {
    expect(cldUrl('smpn3kresek/image/abc')).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/smpn3kresek/image/abc`,
    );
    expect(cldUrl('smpn3kresek/image/abc', 'avatar')).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_200,h_200,f_auto,q_auto/smpn3kresek/image/abc`,
    );
  });

  it('builds the card and hero variants with width-height fills', () => {
    expect(cldUrl('id1', 'card')).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_640,h_400,f_auto,q_auto/id1`,
    );
    expect(cldUrl('id1', 'hero')).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_1600,h_900,f_auto,q_auto/id1`,
    );
  });

  it('builds the pdf variant under the raw resource type with no transform segment', () => {
    expect(cldUrl('smpn3kresek/pdf/abc', 'pdf')).toBe(
      `https://res.cloudinary.com/${CLOUD}/raw/upload/smpn3kresek/pdf/abc`,
    );
  });

  it('preserves subfolder publicIds without escaping the slashes', () => {
    expect(cldUrl('smpn3kresek/image/2026/foo-bar')).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/smpn3kresek/image/2026/foo-bar`,
    );
  });

  it('exposes the CLD_VARIANTS table for direct inspection (used by sign endpoint to pick resource_type)', () => {
    expect(CLD_VARIANTS.avatar.resourceType).toBe('image');
    expect(CLD_VARIANTS.pdf.resourceType).toBe('raw');
    expect(CLD_VARIANTS.pdf.transform).toBe('');
  });
});
