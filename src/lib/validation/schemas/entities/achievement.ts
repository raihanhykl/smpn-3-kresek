import { z } from 'zod';

export const achievementLevelSchema = z.enum([
  'kabupaten', 'provinsi', 'nasional', 'internasional',
]);

export const achievementSchema = z.object({
  id: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  title: z.string().min(1),
  recipient: z.string().min(1),
  organizer: z.string().min(1),
  level: achievementLevelSchema,
  icon: z.string().min(1),
});

export type AchievementValidated = z.infer<typeof achievementSchema>;
