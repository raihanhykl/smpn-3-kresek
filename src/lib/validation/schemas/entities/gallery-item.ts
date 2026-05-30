import { z } from 'zod';
import { photoSchema } from '../shared';

export const galleryItemSchema = z.object({
  id: z.string().min(1),
  caption: z.string().min(1),
  photo: photoSchema,
  category: z.string().optional(),
  span: z.enum(['wide', 'tall', 'normal']).optional(),
});

export type GalleryItemValidated = z.infer<typeof galleryItemSchema>;
