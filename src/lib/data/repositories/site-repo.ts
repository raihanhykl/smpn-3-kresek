import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';
import { siteConfigSchema } from '@/lib/validation/schemas/site-config';
import { navigationSchema } from '@/lib/validation/schemas/navigation';
import type { SiteConfig } from '@config/types';

async function loadSiteConfig(): Promise<SiteConfig> {
  const [siteRow, navRow] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 'singleton' } }),
    prisma.navigation.findUnique({ where: { id: 'singleton' } }),
  ]);
  if (!siteRow) throw new Error('SiteConfig singleton missing — seed not run?');
  if (!navRow) throw new Error('Navigation singleton missing — seed not run?');

  const navigation = navigationSchema.parse(navRow.items);
  const merged = { ...(siteRow.data as object), navigation };
  return siteConfigSchema.parse(merged) as SiteConfig;
}

/**
 * Read singleton SiteConfig (brand + contact + kontakCta + accreditation + …)
 * with the embedded Navigation list. Cached with tag `site-config` so Phase 2
 * mutations can call revalidateTag('site-config').
 */
export const getSiteConfig = unstable_cache(loadSiteConfig, ['site-config'], {
  tags: ['site-config', 'navigation'],
});
