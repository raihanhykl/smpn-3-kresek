import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  requireRole, UnauthorizedError, ForbiddenError,
  type AuthSessionUser, type Role,
} from '@/lib/auth/require-role';

/**
 * Wraps a Next.js Route Handler with session+role auth.
 *
 * Unlike `withRole` (which is shaped for server actions and returns an
 * `ActionResult`), this helper returns a Response so it can be assigned
 * directly to a route's HTTP-method export (GET/POST/...).
 *
 * Error translation:
 *   - no session              → 401 { error: 'unauthorized' }
 *   - role not in allow-list  → 403 { error: 'forbidden' }
 *   - handler throws Unauth/Forbidden — same as above
 *   - any other error         → 500 { error: 'unknown_error' }, logged server-side
 *
 * Usage:
 *   export const POST = withApiAuth(['ADMIN','EDITOR'], async (req, user) => {
 *     ...
 *     return NextResponse.json({ ok: true });
 *   });
 */
export function withApiAuth<H extends (req: NextRequest, user: AuthSessionUser) => Promise<NextResponse>>(
  allowedRoles: Role[],
  handler: H,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req) => {
    let user: AuthSessionUser;
    try {
      const session = await getSession();
      user = requireRole(session, allowedRoles);
    } catch (err) {
      if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      if (err instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      console.error('[api-auth] unexpected auth error:', err);
      return NextResponse.json({ error: 'unknown_error' }, { status: 500 });
    }
    try {
      return await handler(req, user);
    } catch (err) {
      if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      if (err instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      // Don't leak details (Prisma codes, stack) to the client.
      console.error('[api-auth] unexpected handler error:', err);
      return NextResponse.json({ error: 'unknown_error' }, { status: 500 });
    }
  };
}
