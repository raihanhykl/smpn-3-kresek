import { syncPhotoUsage } from '@/lib/media/sync-photo-usage';
import type { MadingImage, Photo } from '@config/types';

function toUrlPhoto(img: MadingImage | undefined): Photo | null {
  return img ? { kind: 'url', src: img.src, alt: img.alt } : null;
}

const imageRef = (madingId: string, i: number) => ({
  usedInTable: 'Mading',
  usedInId: madingId,
  usedInField: `image:${i}`,
});

/**
 * Reconcile a Mading post's MediaUsage rows to match `next` (per array index).
 * Relinks shifted siblings + unlinks trailing slots. NON-transactional (syncPhotoUsage
 * uses the global client). This is the SAME logic the admin Mading editor uses.
 */
export async function reconcileMadingImageUsages(
  madingId: string,
  prev: MadingImage[],
  next: MadingImage[],
): Promise<void> {
  const len = Math.max(prev.length, next.length);
  for (let i = 0; i < len; i++) {
    await syncPhotoUsage(toUrlPhoto(prev[i]), toUrlPhoto(next[i]), imageRef(madingId, i));
  }
}
