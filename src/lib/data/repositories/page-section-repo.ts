import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';

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
