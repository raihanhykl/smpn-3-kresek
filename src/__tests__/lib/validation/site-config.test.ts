import { siteConfigSchema } from '@/lib/validation/schemas/site-config';
import { siteConfig } from '@config/site';

describe('siteConfigSchema', () => {
  it('accepts the existing static siteConfig', () => {
    const result = siteConfigSchema.safeParse(siteConfig);
    if (!result.success) {
      throw new Error('Zod failed: ' + JSON.stringify(result.error.format(), null, 2));
    }
    expect(result.success).toBe(true);
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
