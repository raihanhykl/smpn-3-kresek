import { z } from 'zod';

export const madingImageSchema = z.object({
  src: z
    .string()
    .min(1, 'src wajib diisi')
    .regex(/^[a-zA-Z0-9_\-/]+$/, 'src harus berupa Cloudinary publicId')
    .refine((s) => !s.includes('://'), 'src harus publicId, bukan URL')
    .refine((s) => !s.startsWith('/'), 'src tidak boleh dimulai dengan "/"'),
  alt: z.string().min(1, 'Alt wajib diisi untuk aksesibilitas'),
});

// Body-or-image cross-field rule, applied as a reusable superRefine so it
// survives `.omit({ id: true })` (which a ZodEffects wrapper would not — see
// subjectSchema for the same "keep the top level a plain ZodObject" pattern).
const requireBodyOrImage = (
  v: { body?: string | undefined; images: z.infer<typeof madingImageSchema>[] },
  ctx: z.RefinementCtx,
): void => {
  const hasBody = (v.body ?? '').trim().length > 0;
  if (!hasBody && v.images.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Posting harus punya isi teks atau minimal satu gambar',
      path: ['body'],
    });
  }
};

// Plain ZodObject (no top-level effects) so callers can `.omit({ id: true })`.
// The cross-field rule is re-attached on each derived schema below.
export const madingSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1, 'Judul wajib diisi'),
    body: z.string().optional(),
    images: z.array(madingImageSchema).max(20, 'Maksimal 20 gambar'),
  })
  .superRefine(requireBodyOrImage);

// Input variant used by server actions: same fields minus `id`, with the
// cross-field rule preserved. `madingSchema` is a ZodEffects, so reach through
// `.innerType()` to `.omit()` on the underlying object, then re-refine.
export const madingInputSchema = madingSchema
  .innerType()
  .omit({ id: true })
  .superRefine(requireBodyOrImage);

export type MadingValidated = z.infer<typeof madingSchema>;
