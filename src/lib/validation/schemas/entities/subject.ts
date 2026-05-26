import { z } from 'zod';

export const subjectSchema = z.object({
  id: z.string().min(1),
  grade: z.union([z.literal(7), z.literal(8), z.literal(9)]),
  groupId: z.string().min(1),
  groupTitle: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  iconBg: z.string().min(1),
  hours: z.string().min(1),
});

export type SubjectValidated = z.infer<typeof subjectSchema>;
