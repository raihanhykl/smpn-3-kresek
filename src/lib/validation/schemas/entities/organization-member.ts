import { z } from 'zod';

export const organizationMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  level: z.number().int().min(0).max(10),
  parentId: z.string().nullable(),
});

export type OrganizationMemberValidated = z.infer<typeof organizationMemberSchema>;
