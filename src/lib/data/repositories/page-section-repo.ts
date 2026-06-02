import { unstable_cache } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import type { Photo } from '@config/types';

/**
 * Returns all PageSection rows for the given pageKey, keyed by sectionKey.
 * Sections are not Zod-validated here — that's the assembler's job, because each
 * sectionKey has a different shape and the assembler knows which schema to apply.
 */
export type SectionsByKey = Record<string, unknown>;

async function loadPageSections(pageKey: string): Promise<SectionsByKey> {
  const rows = await prisma.pageSection.findMany({ where: { pageKey } });
  const out: SectionsByKey = {};
  for (const row of rows) {
    out[row.sectionKey] = row.data;
  }
  return out;
}

export function getPageSections(pageKey: string): Promise<SectionsByKey> {
  // unstable_cache cannot take dynamic-key args in the cacheKey array, so we
  // build a per-pageKey wrapper. Tag with both 'page:<pageKey>' (specific) and
  // 'page-sections' (generic) so Phase 2 can invalidate either way.
  const cached = unstable_cache(
    () => loadPageSections(pageKey),
    ['page-sections', pageKey],
    { tags: [`page:${pageKey}`, 'page-sections'] },
  );
  return cached();
}

type PhotoField = 'photo' | 'photoMain' | 'photoSub';

/**
 * Phase 5: read-modify-write a single photo field into a section's JSON,
 * leaving every other key intact. Returns the merged section data. The caller
 * (action) revalidates the page tag + syncs MediaUsage. No optimistic lock —
 * the admin team is tiny and the read happens immediately before the write, so
 * the clobber window is negligible at this scale.
 */
export async function setPageSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: PhotoField,
  photo: Photo,
): Promise<Record<string, unknown>> {
  const row = await prisma.pageSection.findUnique({
    where: { pageKey_sectionKey: { pageKey, sectionKey } },
  });
  if (!row) throw new Error(`PageSection ${pageKey}/${sectionKey} not found`);
  const current = (row.data ?? {}) as Record<string, unknown>;
  const next = { ...current, [field]: photo };
  await prisma.pageSection.update({
    where: { pageKey_sectionKey: { pageKey, sectionKey } },
    // `next` is Record<string, unknown> (read-modify-write of arbitrary section
    // JSON); Prisma's Json input is InputJsonValue, to which Record<string,
    // unknown> is NOT assignable under strict — cast. Shape is already
    // Zod-validated upstream by pageSectionPhotoPatchSchema in the action.
    data: { data: next as Prisma.InputJsonValue },
  });
  return next;
}

/** Read the current photo for a slot (for syncPhotoUsage prev-diff + editor seed). */
export async function getPageSectionPhoto(
  pageKey: string,
  sectionKey: string,
  field: PhotoField,
): Promise<Photo | null> {
  const row = await prisma.pageSection.findUnique({
    where: { pageKey_sectionKey: { pageKey, sectionKey } },
  });
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const p = data[field];
  return p && typeof p === 'object' ? (p as Photo) : null;
}
