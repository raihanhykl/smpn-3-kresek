// Re-export Prisma's Role enum as the SINGLE source of truth. Avoids drift between
// our own string union and the DB-generated enum.
export { Role } from '@prisma/client';
import type { Role } from '@prisma/client';

export type AuthSessionUser = { id: string; role: Role };

export type AuthSession = { user: AuthSessionUser } | null;

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'ForbiddenError';
  }
}

export function requireRole(session: AuthSession, allowed: Role[]): AuthSessionUser {
  if (!session?.user) throw new UnauthorizedError();
  if (!allowed.includes(session.user.role)) throw new ForbiddenError();
  return session.user;
}
