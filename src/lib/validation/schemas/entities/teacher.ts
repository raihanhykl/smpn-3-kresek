import { z } from 'zod';
import { photoSchema } from '../shared';

export const teacherSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  position: z.string().min(1),
  badge: z.string(),
  category: z.enum(['pimpinan', 'guru', 'tu']),
  photo: photoSchema,
});

export type TeacherValidated = z.infer<typeof teacherSchema>;
