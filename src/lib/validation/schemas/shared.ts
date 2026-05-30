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

// Phase 3: the `url` branch now means "Cloudinary publicId", NOT an arbitrary
// https URL. The cloud name is resolved at render time via `cldUrl(publicId, ...)`
// so a handover to a different Cloudinary account is one env-var swap.
// Validation rejects anything containing `://` (URL-shaped values) or starting
// with `/` (path-shaped values).
//
// Alt-text note: `alt` stays required for the url branch (accessibility). The DB
// column `Teacher.photoAlt` is nullable for legacy reasons; the row→entity mapper
// coerces null to '' before parsing, and an audit in Phase 3 Task 0 confirms
// zero existing url-kind rows in the dev DB.
export const photoSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('url'),
    src: z
      .string()
      .min(1, 'src wajib diisi')
      .regex(/^[a-zA-Z0-9_\-/]+$/, 'src harus berupa Cloudinary publicId')
      .refine((s) => !s.includes('://'), 'src harus publicId, bukan URL')
      .refine((s) => !s.startsWith('/'), 'src tidak boleh dimulai dengan "/"'),
    alt: z.string().min(1, 'Alt wajib diisi untuk aksesibilitas'),
  }),
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
