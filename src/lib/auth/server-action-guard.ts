import { ZodError } from 'zod';
import {
  requireRole, UnauthorizedError, ForbiddenError,
  type AuthSession, type Role, type AuthSessionUser,
} from '@/lib/auth/require-role';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Wraps a server-action body with a session+role check. Converts auth errors
 * AND any error thrown inside the body into a typed ActionResult so the client
 * form gets a clean error string instead of a 500. The body receives the
 * authenticated user.
 *
 * Error mapping:
 * - auth failures → 'unauthorized' | 'forbidden' (the form maps these to friendly copy)
 * - ZodError → the first validation issue's message (already human-readable, in Indonesian)
 * - anything else (e.g. a Prisma error) → 'unknown_error' (we do NOT leak the raw
 *   message to the client — it goes to server logs via console.error instead)
 */
export async function withRole<T>(
  session: AuthSession,
  allowed: Role[],
  body: (user: AuthSessionUser) => Promise<T>,
): Promise<ActionResult<T>> {
  let user: AuthSessionUser;
  try {
    user = requireRole(session, allowed);
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (err instanceof ForbiddenError) return { ok: false, error: 'forbidden' };
    return { ok: false, error: 'forbidden' };
  }
  try {
    const data = await body(user);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
    if (err instanceof ForbiddenError) return { ok: false, error: 'forbidden' };
    if (err instanceof ZodError) {
      const first = err.errors[0];
      return { ok: false, error: first?.message ?? 'Data tidak valid.' };
    }
    // Don't leak internal error details (Prisma codes, stack) to the client.
    console.error('[server-action] unexpected error:', err);
    return { ok: false, error: 'unknown_error' };
  }
}
