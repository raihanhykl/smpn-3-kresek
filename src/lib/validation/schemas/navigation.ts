import { z } from 'zod';

export const routeSchema = z.enum(['/', '/profil', '/akademik', '/fasilitas', '/kontak']);

export const navItemSchema = z.object({
  label: z.string().min(1),
  href: routeSchema,
});

export const navigationSchema = z.array(navItemSchema);

export type NavigationValidated = z.infer<typeof navigationSchema>;
