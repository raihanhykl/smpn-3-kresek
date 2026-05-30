import { z } from 'zod';

export const faqCategorySchema = z.enum(['akademik', 'administrasi', 'lainnya']);

export const faqSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  category: faqCategorySchema,
});

export type FaqValidated = z.infer<typeof faqSchema>;
