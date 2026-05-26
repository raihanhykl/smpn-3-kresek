import { siteConfigSchema } from '@/lib/validation/schemas/site-config';
import { siteConfig } from '@config/site';

describe('siteConfigSchema', () => {
  it('accepts the existing static siteConfig after kontakCta rename', () => {
    // Phase 1: ppdbCta is removed and replaced with kontakCta.
    // This test passes BEFORE Task 4 (because we synthesize kontakCta below)
    // and AFTER Task 4 (because the destructure of a missing field is undefined).
    const { ppdbCta: _omit, ...rest } = siteConfig as typeof siteConfig & {
      ppdbCta?: unknown;
    };
    void _omit;
    const candidate = {
      ...rest,
      kontakCta: { label: 'Kontak', href: '/kontak' },
    };
    const result = siteConfigSchema.safeParse(candidate);
    if (!result.success) {
      throw new Error('Zod failed: ' + JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
  });

  // This test asserts the rename actually happened in src/config/site.ts.
  // Skipped pre-Task-4, enabled at Task 4. Catches a regression where someone
  // re-adds ppdbCta to site.ts later.
  it('static siteConfig no longer has ppdbCta (Phase 1 contract)', () => {
    expect((siteConfig as unknown as Record<string, unknown>).ppdbCta).toBeUndefined();
    expect((siteConfig as unknown as { kontakCta: unknown }).kontakCta).toBeDefined();
  });

  it('rejects missing required fields', () => {
    expect(siteConfigSchema.safeParse({}).success).toBe(false);
  });

  it('rejects invalid social platform', () => {
    const candidate = {
      brand: { name: 'x', shortName: 'x', location: 'x', tagline: 'x', logoMark: 'x' },
      navigation: [],
      kontakCta: { label: 'Kontak', href: '/kontak' },
      contact: {
        address: 'x', addressLines: ['x'], phone: 'x', phoneHref: 'x',
        whatsapp: 'x', email: 'x@x.com', hours: 'x', hoursDetail: 'x',
        mapsUrl: 'http://x', directionsUrl: 'http://x',
      },
      social: [{ platform: 'discord', url: 'http://x', handle: 'x', icon: 'x', cta: 'x' }],
      accreditation: { grade: 'A', body: 'x', label: 'x' },
      footer: { copyright: 'x', designedBy: 'x' },
    };
    expect(siteConfigSchema.safeParse(candidate).success).toBe(false);
  });
});
