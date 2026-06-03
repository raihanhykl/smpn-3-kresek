'use server';

import { signOut } from '@/lib/auth/config';

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/admin/login' });
}
