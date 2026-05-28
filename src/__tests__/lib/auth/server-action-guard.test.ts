import { withRole, type ActionResult } from '@/lib/auth/server-action-guard';
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/require-role';

describe('withRole', () => {
  const adminSession = { user: { id: 'u1', role: 'ADMIN' as const } };
  const editorSession = { user: { id: 'u2', role: 'EDITOR' as const } };

  it('runs the body and returns ok when role allowed', async () => {
    const result = await withRole(adminSession, ['ADMIN'], async (user) => {
      expect(user.id).toBe('u1');
      return { created: true };
    });
    expect(result).toEqual({ ok: true, data: { created: true } });
  });

  it('returns unauthorized failure when session null', async () => {
    const result = await withRole(null, ['ADMIN'], async () => ({ x: 1 }));
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns forbidden failure when role not allowed', async () => {
    const result = await withRole(editorSession, ['ADMIN'], async () => ({ x: 1 }));
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('lets EDITOR through when allowed', async () => {
    const result = await withRole(editorSession, ['ADMIN', 'EDITOR'], async () => ({ x: 1 }));
    expect(result).toEqual({ ok: true, data: { x: 1 } });
  });

  it('surfaces a ZodError as its first issue message (human-readable)', async () => {
    const { z } = await import('zod');
    const result = await withRole(adminSession, ['ADMIN'], async () => {
      z.object({ name: z.string().min(1, 'Nama wajib diisi') }).parse({ name: '' });
      return { x: 1 };
    });
    expect(result).toEqual({ ok: false, error: 'Nama wajib diisi' });
  });

  it('generic-izes a non-Zod, non-auth Error to unknown_error (no leak)', async () => {
    const result = await withRole(adminSession, ['ADMIN'], async () => {
      throw new Error('Prisma P2025: record not found at /internal/path');
    });
    expect(result).toEqual({ ok: false, error: 'unknown_error' });
  });

  it('passes through UnauthorizedError/ForbiddenError thrown deeper as their codes', async () => {
    const r1 = await withRole(adminSession, ['ADMIN'], async () => { throw new UnauthorizedError(); });
    expect(r1).toEqual({ ok: false, error: 'unauthorized' });
    const r2 = await withRole(adminSession, ['ADMIN'], async () => { throw new ForbiddenError(); });
    expect(r2).toEqual({ ok: false, error: 'forbidden' });
  });
});
