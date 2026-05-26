import { prisma } from '@/lib/db/client';
import { siteConfig as staticSiteConfig } from '@config/site';
import { navigation as staticNavigation } from '@config/navigation';
import { getSiteConfig } from '@/lib/data/repositories/site-repo';

describe('siteRepo.getSiteConfig', () => {
  beforeAll(async () => {
    await prisma.siteConfig.deleteMany({});
    await prisma.navigation.deleteMany({});
    const { ppdbCta: _unused, ...rest } = staticSiteConfig as typeof staticSiteConfig & {
      ppdbCta?: unknown;
    };
    void _unused;
    await prisma.siteConfig.create({
      data: {
        id: 'singleton',
        data: { ...rest, kontakCta: { label: 'Kontak', href: '/kontak' } } as object,
      },
    });
    await prisma.navigation.create({
      data: { id: 'singleton', items: staticNavigation as unknown as object },
    });
  });

  afterAll(async () => {
    await prisma.siteConfig.deleteMany({});
    await prisma.navigation.deleteMany({});
    await prisma.$disconnect();
  });

  it('returns SiteConfig with kontakCta and joined navigation', async () => {
    const cfg = await getSiteConfig();
    expect(cfg.brand.name).toBe('SMPN 3 Kresek');
    expect(cfg.kontakCta).toEqual({ label: 'Kontak', href: '/kontak' });
    expect(cfg.navigation).toEqual(staticNavigation);
  });

  it('throws when SiteConfig row is missing', async () => {
    await prisma.siteConfig.deleteMany({});
    await expect(getSiteConfig()).rejects.toThrow(/SiteConfig/);
  });
});
