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

export const madingSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1, 'Judul wajib diisi'),
    body: z.string().optional(),
    images: z.array(madingImageSchema).max(20, 'Maksimal 20 gambar'),
  })
  .superRefine((v, ctx) => {
    const hasBody = (v.body ?? '').trim().length > 0;
    if (!hasBody && v.images.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Posting harus punya isi teks atau minimal satu gambar',
        path: ['body'],
      });
    }
  });

export type MadingValidated = z.infer<typeof madingSchema>;
