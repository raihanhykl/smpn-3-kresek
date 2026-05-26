'use server';

import { signIn } from '@/lib/auth/config';
import { AuthError } from 'next-auth';

export type LoginState = { error?: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const returnUrl = String(formData.get('returnUrl') ?? '/admin/dashboard');

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: returnUrl,
    });
    return null; // never reached because signIn throws redirect
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Email atau password salah.' };
    }
    // Re-throw to let Next.js handle the redirect (signIn uses redirect internally).
    throw err;
  }
}
