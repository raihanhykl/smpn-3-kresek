import { auth } from '@/lib/auth/config';
import type { AuthSession } from '@/lib/auth/require-role';

/**
 * Returns the current session (server components, server actions, route handlers).
 * Shape-compatible with requireRole().
 */
export async function getSession(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      role: session.user.role,
    },
  };
}
