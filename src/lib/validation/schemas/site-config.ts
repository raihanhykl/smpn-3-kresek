import { z } from 'zod';
import { navItemSchema } from './navigation';

export const siteConfigSchema = z.object({
  brand: z.object({
    name: z.string().min(1),
    shortName: z.string().min(1),
    location: z.string(),
    tagline: z.string(),
    logoMark: z.string().min(1),
  }),
  navigation: z.array(navItemSchema),
  kontakCta: z.object({ label: z.string().min(1), href: z.string().min(1) }),
  contact: z.object({
    address: z.string(),
    addressLines: z.array(z.string()),
    phone: z.string(),
    phoneHref: z.string(),
    whatsapp: z.string(),
    email: z.string().email(),
    hours: z.string(),
    hoursDetail: z.string(),
    mapsUrl: z.string().url(),
    directionsUrl: z.string().url(),
  }),
  social: z.array(z.object({
    platform: z.enum(['instagram', 'facebook', 'youtube', 'tiktok']),
    url: z.string().url(),
    handle: z.string(),
    icon: z.string(),
    cta: z.string(),
  })),
  accreditation: z.object({
    grade: z.enum(['A', 'B', 'C']),
    body: z.string(),
    label: z.string(),
  }),
  footer: z.object({
    copyright: z.string(),
    designedBy: z.string(),
  }),
});

export type SiteConfigValidated = z.infer<typeof siteConfigSchema>;
