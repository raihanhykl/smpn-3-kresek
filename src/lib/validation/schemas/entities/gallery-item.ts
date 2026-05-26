import { z } from 'zod';

export const galleryItemSchema = z.object({
  id: z.string().min(1),
  caption: z.string().min(1),
  emoji: z.string().min(1),
  gradientFrom: z.string().min(1),
  gradientTo: z.string().min(1),
  category: z.string().optional(),
  span: z.enum(['wide', 'tall', 'normal']).optional(),
});

export type GalleryItemValidated = z.infer<typeof galleryItemSchema>;
