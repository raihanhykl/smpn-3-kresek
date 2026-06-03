import { requireRole, UnauthorizedError, ForbiddenError } from '@/lib/auth/require-role';

type Session = { user: { id: string; role: 'ADMIN' | 'EDITOR' } } | null;

describe('requireRole', () => {
  it('throws UnauthorizedError when session is null', () => {
    expect(() => requireRole(null as Session, ['ADMIN'])).toThrow(UnauthorizedError);
  });

  it('throws ForbiddenError when role not allowed', () => {
    const session: Session = { user: { id: 'u1', role: 'EDITOR' } };
    expect(() => requireRole(session, ['ADMIN'])).toThrow(ForbiddenError);
  });

  it('returns user when role allowed (single)', () => {
    const session: Session = { user: { id: 'u1', role: 'ADMIN' } };
    expect(requireRole(session, ['ADMIN'])).toEqual({ id: 'u1', role: 'ADMIN' });
  });

  it('returns user when role allowed (multiple)', () => {
    const session: Session = { user: { id: 'u2', role: 'EDITOR' } };
    expect(requireRole(session, ['ADMIN', 'EDITOR'])).toEqual({ id: 'u2', role: 'EDITOR' });
  });

  it('throws ForbiddenError when role is an unexpected string (defensive)', () => {
    // Simulate a stale JWT carrying a role no longer in our enum.
    const session = { user: { id: 'u3', role: 'SUPER_ADMIN' as unknown as 'ADMIN' } };
    expect(() => requireRole(session as unknown as Session, ['ADMIN'])).toThrow(ForbiddenError);
  });

  it('does not mutate the input session', () => {
    const session: Session = { user: { id: 'u4', role: 'ADMIN' } };
    const snapshot = JSON.parse(JSON.stringify(session));
    requireRole(session, ['ADMIN']);
    expect(session).toEqual(snapshot);
  });
});
