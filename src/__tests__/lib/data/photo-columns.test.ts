/**
 * @jest-environment node
 */
import { photoFromRow, photoToColumns } from '@/lib/data/repositories/_photo-columns';

describe('_photo-columns crop round-trip', () => {
  it('photoToColumns maps crop fields on url; nulls on gradient', () => {
    expect(
      photoToColumns({ kind: 'url', src: 'a', alt: 'b', cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4 }),
    ).toMatchObject({ photoCropX: 0.1, photoCropY: 0.2, photoCropW: 0.5, photoCropH: 0.4 });

    expect(
      photoToColumns({ kind: 'gradient', from: '#000', to: '#fff', emoji: '🎓' }),
    ).toMatchObject({ photoCropX: null, photoCropY: null, photoCropW: null, photoCropH: null });
  });

  it('photoToColumns nulls crop when url photo has no crop', () => {
    expect(photoToColumns({ kind: 'url', src: 'a', alt: 'b' })).toMatchObject({
      photoCropX: null,
      photoCropY: null,
      photoCropW: null,
      photoCropH: null,
    });
  });

  it('photoFromRow reconstructs crop only when all four present', () => {
    const withCrop = photoFromRow('GalleryItem', 'g1', {
      photoKind: 'url',
      photoSrc: 'a',
      photoAlt: 'b',
      photoFrom: null,
      photoTo: null,
      photoEmoji: null,
      photoCropX: 0.1,
      photoCropY: 0.2,
      photoCropW: 0.5,
      photoCropH: 0.4,
    });
    expect(withCrop).toEqual({ kind: 'url', src: 'a', alt: 'b', cropX: 0.1, cropY: 0.2, cropW: 0.5, cropH: 0.4 });

    const noCrop = photoFromRow('GalleryItem', 'g1', {
      photoKind: 'url',
      photoSrc: 'a',
      photoAlt: 'b',
      photoFrom: null,
      photoTo: null,
      photoEmoji: null,
      photoCropX: null,
      photoCropY: null,
      photoCropW: null,
      photoCropH: null,
    });
    expect(noCrop).toEqual({ kind: 'url', src: 'a', alt: 'b' });
  });
});
