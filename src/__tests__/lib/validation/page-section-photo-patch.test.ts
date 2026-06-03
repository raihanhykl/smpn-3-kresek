/**
 * @jest-environment node
 */
import { pageSectionPhotoPatchSchema } from '@/lib/validation/schemas/page-sections/photo-patch';

const url = { kind: 'url', src: 'smpn3kresek/image/abc', alt: 'x' };

describe('pageSectionPhotoPatchSchema', () => {
  it('accepts a valid hero photo patch', () => {
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'home', sectionKey: 'hero', field: 'photo', photo: url,
    }).success).toBe(true);
  });

  it('accepts about photoMain / photoSub fields', () => {
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'home', sectionKey: 'about', field: 'photoMain', photo: url,
    }).success).toBe(true);
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'home', sectionKey: 'about', field: 'photoSub', photo: url,
    }).success).toBe(true);
  });

  it('rejects an unknown sectionKey or a field that does not belong to the section', () => {
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'home', sectionKey: 'nope', field: 'photo', photo: url,
    }).success).toBe(false);
    // hero has no photoSub slot
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'home', sectionKey: 'hero', field: 'photoSub', photo: url,
    }).success).toBe(false);
    // sejarah is on profil, not home
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'home', sectionKey: 'sejarah', field: 'photo', photo: url,
    }).success).toBe(false);
  });

  it('accepts a gradient photo (placeholder reset)', () => {
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'home', sectionKey: 'sambutan', field: 'photo',
      photo: { kind: 'gradient', from: '#1565C0', to: '#1E88E5', emoji: '👤' },
    }).success).toBe(true);
  });

  it('accepts a url photo with a crop region', () => {
    expect(pageSectionPhotoPatchSchema.safeParse({
      pageKey: 'profil', sectionKey: 'sejarah', field: 'photo',
      photo: { ...url, cropX: 0.1, cropY: 0.1, cropW: 0.5, cropH: 0.5 },
    }).success).toBe(true);
  });
});
