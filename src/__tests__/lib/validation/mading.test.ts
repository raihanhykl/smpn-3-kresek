import { madingSchema } from '@/lib/validation/schemas/entities/mading';

const base = { id: 'm1', title: 'Judul', images: [] as { src: string; alt: string }[] };

describe('madingSchema', () => {
  it('requires a title', () => {
    expect(madingSchema.safeParse({ ...base, title: '', body: 'isi' }).success).toBe(false);
  });

  it('accepts a text-only post (body, no images)', () => {
    expect(madingSchema.safeParse({ ...base, body: 'isi panjang' }).success).toBe(true);
  });

  it('accepts an image-only post (>=1 image, no body)', () => {
    expect(
      madingSchema.safeParse({ ...base, images: [{ src: 'smpn3/foto1', alt: 'Foto' }] }).success,
    ).toBe(true);
  });

  it('rejects a post with neither body nor images', () => {
    expect(madingSchema.safeParse({ ...base, body: '   ' }).success).toBe(false);
  });

  it('rejects an image src that is a full URL', () => {
    expect(
      madingSchema.safeParse({ ...base, body: 'x', images: [{ src: 'https://x/y.jpg', alt: 'a' }] }).success,
    ).toBe(false);
  });

  it('rejects an image with empty alt', () => {
    expect(
      madingSchema.safeParse({ ...base, images: [{ src: 'smpn3/f', alt: '' }] }).success,
    ).toBe(false);
  });

  it('rejects more than 20 images', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ src: `smpn3/f${i}`, alt: 'a' }));
    expect(madingSchema.safeParse({ ...base, images: many }).success).toBe(false);
  });
});
