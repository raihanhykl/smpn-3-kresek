/**
 * @jest-environment node
 */
import { cldUrl, CLD_VARIANTS, cropOf } from '@/lib/media/cldUrl';

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

  // Phase 4 — crop
  it('prepends a decimal c_crop segment before the variant transform', () => {
    expect(cldUrl('id1', 'card', { x: 0.1, y: 0.05, w: 0.75, h: 0.6 })).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_crop,x_0.1,y_0.05,w_0.75,h_0.6/c_fill,w_640,h_400,f_auto,q_auto/id1`,
    );
  });

  it('is byte-identical to no-crop when crop is omitted', () => {
    expect(cldUrl('id1', 'card')).toBe(cldUrl('id1', 'card', undefined));
  });

  it('skips the crop segment when crop fields are partial/invalid', () => {
    // @ts-expect-error — deliberately partial
    expect(cldUrl('id1', 'card', { x: 0.1 })).toBe(cldUrl('id1', 'card'));
  });

  it('drops g_face on the avatar variant when a crop is present', () => {
    expect(cldUrl('id1', 'avatar', { x: 0.1, y: 0.1, w: 0.5, h: 0.5 })).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_crop,x_0.1,y_0.1,w_0.5,h_0.5/c_fill,w_200,h_200,f_auto,q_auto/id1`,
    );
    // no crop → g_face retained (unchanged behaviour)
    expect(cldUrl('id1', 'avatar')).toBe(
      `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,g_face,w_200,h_200,f_auto,q_auto/id1`,
    );
  });
});

describe('cropOf', () => {
  it('returns a CldCrop when all four fractions are present', () => {
    expect(cropOf({ cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4 })).toEqual({
      x: 0.1, y: 0.2, w: 0.5, h: 0.4,
    });
  });

  it('returns undefined when any fraction is missing', () => {
    expect(cropOf({ cropX: 0.1, cropY: 0.2, cropW: 0.5 })).toBeUndefined();
    expect(cropOf({})).toBeUndefined();
  });
});
