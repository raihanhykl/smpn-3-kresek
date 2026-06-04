import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import type { Photo } from '@config/types';
import { photoFromRow, photoToColumns, type PhotoRowColumns } from './_photo-columns';

/**
 * Section-photo storage (replaces the photo role of the dropped PageSection table).
 *
 * The 6 admin-editable section photos (home/hero, home/sambutan, home/about ×2,
 * profil/sejarah, akademik/kurikulum) live in the SectionPhoto table as the shared
 * 6-flat-column Photo union + crop, keyed by (pageKey, sectionKey, field). Rows are
 * created lazily on first save; an absent row OR a row with photoKind = null means
 * "unset" → the assembler keeps the config/UI gradient placeholder.
 */

export type PhotoField = 'photo' | 'photoMain' | 'photoSub';

/** Stable key for a slot, used in the getAllSectionPhotos map + MediaUsage usedInId. */
export function slotKey(pageKey: string, sectionKey: string, field: string): string {
  return `${pageKey}:${sectionKey}:${field}`;
}

type SectionPhotoRow = {
  pageKey: string;
  sectionKey: string;
  field: string;
  photoKind: string | null;
} & Omit<PhotoRowColumns, 'photoKind'>;

// Reconstruct a Photo from a row, or null when unset. photoFromRow THROWS on a
// null/unknown kind, so guard first — unset slots are normal here (unlike entities).
function rowToPhoto(row: SectionPhotoRow): Photo | null {
  if (row.photoKind === null) return null;
  return photoFromRow('SectionPhoto', slotKey(row.pageKey, row.sectionKey, row.field), {
    ...row,
    photoKind: row.photoKind,
  });
}

async function loadAllSectionPhotos(): Promise<Record<string, Photo>> {
  const rows = await prisma.sectionPhoto.findMany();
  const out: Record<string, Photo> = {};
  for (const row of rows) {
    const photo = rowToPhoto(row);
    if (photo) out[slotKey(row.pageKey, row.sectionKey, row.field)] = photo;
  }
  return out;
}

/**
 * All set section photos as a { '<page>:<section>:<field>': Photo } map. Cached
 * (tag 'section-photos') so assemblers don't re-query per request; the editor
 * action revalidates this tag on save. Unset slots are simply absent from the map.
 */
export const getAllSectionPhotos = unstable_cache(loadAllSectionPhotos, ['section-photos', 'all'], {
  tags: ['section-photos'],
});

/** Read one slot's current photo (for the editor seed + syncPhotoUsage prev-diff). */
export async function getSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: PhotoField,
): Promise<Photo | null> {
  const row = await prisma.sectionPhoto.findUnique({
    where: { pageKey_sectionKey_field: { pageKey, sectionKey, field } },
  });
  return row ? rowToPhoto(row) : null;
}

/** Remove a section photo slot entirely (unset → render falls back to config gradient). Idempotent. */
export async function deleteSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: PhotoField,
): Promise<void> {
  await prisma.sectionPhoto.deleteMany({ where: { pageKey, sectionKey, field } });
}

/** Upsert a slot's photo (row created lazily on first save). */
export async function setSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: PhotoField,
  photo: Photo,
): Promise<void> {
  const cols = photoToColumns(photo);
  await prisma.sectionPhoto.upsert({
    where: { pageKey_sectionKey_field: { pageKey, sectionKey, field } },
    create: { pageKey, sectionKey, field, ...cols },
    update: cols,
  });
}
