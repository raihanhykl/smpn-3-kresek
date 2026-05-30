import { z } from 'zod';
import { photoSchema } from '../shared';

export const facilitySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('featured'),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    photo: photoSchema,
    span: z.enum(['wide', 'tall', 'normal']).optional(),
  }),
  z.object({
    kind: z.literal('mini'),
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().min(1),
  }),
]);

export type FacilityValidated = z.infer<typeof facilitySchema>;
