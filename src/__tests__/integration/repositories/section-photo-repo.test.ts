import {
  getSectionPhoto, setSectionPhoto, getAllSectionPhotos, slotKey,
} from '@/lib/data/repositories/section-photo-repo';
import { prisma } from '@/lib/db/client';
import type { Photo } from '@config/types';

// Use a real catalog slot so the data is representative.
const PAGE = 'home';
const SECTION = 'hero';
const FIELD = 'photo';

describe('section-photo-repo', () => {
  afterEach(async () => {
    await prisma.sectionPhoto.deleteMany({
      where: { pageKey: PAGE, sectionKey: SECTION, field: FIELD },
    });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns null for an unset slot', async () => {
    expect(await getSectionPhoto(PAGE, SECTION, FIELD)).toBeNull();
  });

  it('upserts and round-trips a url photo with crop', async () => {
    const photo: Photo = {
      kind: 'url',
      src: 'smpn3kresek/image/hero-x',
      alt: 'Foto gedung',
      cropX: 0.1,
      cropY: 0.2,
      cropW: 0.5,
      cropH: 0.6,
    };
    await setSectionPhoto(PAGE, SECTION, FIELD, photo);
    const got = await getSectionPhoto(PAGE, SECTION, FIELD);
    expect(got).toEqual(photo);
  });

  it('round-trips a gradient photo', async () => {
    const photo: Photo = { kind: 'gradient', from: '#1565C0', to: '#1E88E5', emoji: '🏫' };
    await setSectionPhoto(PAGE, SECTION, FIELD, photo);
    expect(await getSectionPhoto(PAGE, SECTION, FIELD)).toEqual(photo);
  });

  it('overwrites on a second upsert (url → gradient)', async () => {
    await setSectionPhoto(PAGE, SECTION, FIELD, {
      kind: 'url', src: 'smpn3kresek/image/a', alt: 'a',
    });
    await setSectionPhoto(PAGE, SECTION, FIELD, {
      kind: 'gradient', from: '#000', to: '#fff', emoji: '👤',
    });
    const got = await getSectionPhoto(PAGE, SECTION, FIELD);
    expect(got).toEqual({ kind: 'gradient', from: '#000', to: '#fff', emoji: '👤' });
  });

  it('getAllSectionPhotos keys set slots and omits unset ones', async () => {
    await setSectionPhoto(PAGE, SECTION, FIELD, {
      kind: 'url', src: 'smpn3kresek/image/all-x', alt: 'x',
    });
    const all = await getAllSectionPhotos();
    expect(all[slotKey(PAGE, SECTION, FIELD)]).toEqual({
      kind: 'url', src: 'smpn3kresek/image/all-x', alt: 'x',
    });
    // An unset slot must be absent from the map (not null/undefined entry).
    expect(all['profil:sejarah:photo']).toBeUndefined();
  });
});
