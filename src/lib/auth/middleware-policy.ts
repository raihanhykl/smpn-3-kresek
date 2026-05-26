import type { Role } from '@/lib/auth/require-role';

type MiddlewareSession = {
  user: { id: string; role: Role; mustChangePassword: boolean };
} | null;

export type MiddlewareAction =
  | { type: 'next' }
  | { type: 'redirect'; to: string };

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

export function decideMiddlewareAction(input: {
  pathname: string;
  search: string;
  session: MiddlewareSession;
}): MiddlewareAction {
  const { pathname, search, session } = input;

  if (!pathname.startsWith('/admin')) return { type: 'next' };
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return { type: 'next' };

  if (!session?.user) {
    const params = new URLSearchParams({ returnUrl: pathname + search });
    return { type: 'redirect', to: `/admin/login?${params.toString()}` };
  }

  if (session.user.mustChangePassword && pathname !== '/admin/change-password') {
    return { type: 'redirect', to: '/admin/change-password' };
  }

  return { type: 'next' };
}
