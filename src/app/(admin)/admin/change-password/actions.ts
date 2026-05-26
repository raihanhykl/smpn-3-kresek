'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/client';
import { auth, signOut } from '@/lib/auth/config';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/security/audit';

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Password baru minimal 8 karakter.'),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Konfirmasi password tidak cocok.',
    path: ['confirmPassword'],
  });

export type ChangePasswordState = { error?: string } | null;

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user) {
    redirect('/admin/login');
  }

  const parsed = schema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Input tidak valid.' };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect('/admin/login');

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: 'Password saat ini salah.' };

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
  await writeAudit({
    userId: user.id,
    action: 'password_changed',
    target: `user:${user.id}`,
  });

  // Sign user out so the JWT refreshes with mustChangePassword=false on next login.
  // signOut throws an internal NEXT_REDIRECT error — code below is unreachable
  // (kept to satisfy the function's declared return type).
  await signOut({ redirectTo: '/admin/login?passwordChanged=1' });
  return null;
}
