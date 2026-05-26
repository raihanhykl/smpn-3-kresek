import { z } from 'zod';

export const ekskulCategorySchema = z.enum([
  'wajib', 'olahraga', 'seni', 'akademik', 'keagamaan', 'lainnya',
]);

export const extracurricularSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: ekskulCategorySchema,
  description: z.string(),
  pembina: z.string(),
  schedule: z.string(),
  achievement: z.string().optional(),
  icon: z.string().min(1),
});

export type ExtracurricularValidated = z.infer<typeof extracurricularSchema>;
