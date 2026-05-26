import { z } from 'zod';

export const ctaLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  icon: z.string().optional(),
});

export const ctaFinalSchema = z.object({
  title: z.string().min(1),
  titleLines: z.array(z.string()).optional(),
  subtitle: z.string(),
  primary: ctaLinkSchema,
  secondary: ctaLinkSchema.optional(),
});

export const sectionMetaSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
});

export const photoSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('url'), src: z.string().min(1), alt: z.string() }),
  z.object({
    kind: z.literal('gradient'),
    from: z.string().min(1),
    to: z.string().min(1),
    emoji: z.string().min(1),
  }),
]);

export const pageHeaderSchema = z.object({
  breadcrumb: z.array(z.object({ label: z.string(), href: z.string().optional() })),
  title: z.string().min(1),
  subtitle: z.string(),
});

export const contactCardSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('address'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    href: z.string().optional(),
    linkText: z.string().optional(),
  }),
  z.object({
    kind: z.literal('phone'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    href: z.string(),
    linkText: z.string().optional(),
  }),
  z.object({
    kind: z.literal('email'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    href: z.string(),
    linkText: z.string().optional(),
  }),
  z.object({
    kind: z.literal('hours'),
    icon: z.string(),
    label: z.string(),
    value: z.string(),
    sub: z.string(),
    subTone: z.enum(['muted', 'warn']).optional(),
  }),
]);
