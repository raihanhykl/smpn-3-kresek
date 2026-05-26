import { z } from 'zod';

export const facilitySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('featured'),
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    emoji: z.string().min(1),
    gradientFrom: z.string().min(1),
    gradientTo: z.string().min(1),
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
