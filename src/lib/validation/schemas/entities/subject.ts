import { z } from 'zod';

// hoursByGrade keys are grade numbers ("7" | "8" | "9"); a key present means the
// subject is taught in that grade, with the given JP string. At least one grade.
export const hoursByGradeSchema = z
  .record(z.enum(['7', '8', '9']), z.string().min(1))
  .refine((m) => Object.keys(m).length > 0, 'Pilih minimal satu kelas');

export const subjectSchema = z.object({
  id: z.string().min(1),
  group: z.enum(['wajib', 'pengembangan']),
  name: z.string().min(1),
  icon: z.string().min(1),
  iconBg: z.string().min(1),
  hoursByGrade: hoursByGradeSchema,
});

export type SubjectValidated = z.infer<typeof subjectSchema>;
