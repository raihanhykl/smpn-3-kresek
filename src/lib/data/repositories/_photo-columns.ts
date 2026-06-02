import type { Photo } from '@config/types';

/**
 * Phase 3b: shared Photo↔columns conversion, hoisted from teacher-repo (was
 * lines 6-29 + 44-50 there). Every entity that owns a Photo discriminated
 * union (Teacher, GalleryItem, Facility-featured, Extracurricular,
 * Achievement) stores it as six flat Prisma columns: photoKind + photoSrc +
 * photoAlt (url branch) + photoFrom + photoTo + photoEmoji (gradient branch).
 *
 * Behavioural contract is byte-identical to the previous inline functions:
 * the rowToTeacher / photoToColumns tests in teacher-repo still pass without
 * changes.
 */

export type PhotoRowColumns = {
  photoKind: string;
  photoSrc: string | null;
  photoAlt: string | null;
  photoFrom: string | null;
  photoTo: string | null;
  photoEmoji: string | null;
  // Phase 4: normalized crop region (0–1). Present together on a cropped url
  // photo; null otherwise. Gradient rows always null.
  photoCropX: number | null;
  photoCropY: number | null;
  photoCropW: number | null;
  photoCropH: number | null;
};

export function photoFromRow(entityKind: string, id: string, row: PhotoRowColumns): Photo {
  if (row.photoKind === 'url') {
    if (row.photoSrc === null || row.photoAlt === null) {
      throw new Error(`${entityKind} ${id}: photoKind=url requires photoSrc + photoAlt`);
    }
    const photo: Photo = { kind: 'url', src: row.photoSrc, alt: row.photoAlt };
    // Crop is all-or-nothing: only reconstruct when all four are present.
    if (
      row.photoCropX !== null &&
      row.photoCropY !== null &&
      row.photoCropW !== null &&
      row.photoCropH !== null
    ) {
      photo.cropX = row.photoCropX;
      photo.cropY = row.photoCropY;
      photo.cropW = row.photoCropW;
      photo.cropH = row.photoCropH;
    }
    return photo;
  }
  if (row.photoKind === 'gradient') {
    if (row.photoFrom === null || row.photoTo === null || row.photoEmoji === null) {
      throw new Error(`${entityKind} ${id}: photoKind=gradient requires photoFrom + photoTo + photoEmoji`);
    }
    return { kind: 'gradient', from: row.photoFrom, to: row.photoTo, emoji: row.photoEmoji };
  }
  throw new Error(`${entityKind} ${id}: unknown photoKind "${row.photoKind}"`);
}

export function photoToColumns(photo: Photo): PhotoRowColumns {
  if (photo.kind === 'url') {
    return {
      photoKind: 'url',
      photoSrc: photo.src,
      photoAlt: photo.alt,
      photoFrom: null,
      photoTo: null,
      photoEmoji: null,
      photoCropX: photo.cropX ?? null,
      photoCropY: photo.cropY ?? null,
      photoCropW: photo.cropW ?? null,
      photoCropH: photo.cropH ?? null,
    };
  }
  return {
    photoKind: 'gradient',
    photoSrc: null,
    photoAlt: null,
    photoFrom: photo.from,
    photoTo: photo.to,
    photoEmoji: photo.emoji,
    photoCropX: null,
    photoCropY: null,
    photoCropW: null,
    photoCropH: null,
  };
}
