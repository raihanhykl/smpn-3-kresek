import { z } from 'zod';
import { photoSchema } from '../shared';

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
  photo: photoSchema,
});

export type ExtracurricularValidated = z.infer<typeof extracurricularSchema>;
