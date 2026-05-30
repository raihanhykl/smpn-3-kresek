/**
 * @jest-environment node
 */
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth/with-api-auth';
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/require-role';

// Mock getSession to control the auth surface.
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
}));
import { getSession } from '@/lib/auth/session';

function fakeRequest(): import('next/server').NextRequest {
  // Minimal stand-in for NextRequest — handlers in these tests don't read from it.
  return new Request('http://localhost/api/test') as unknown as import('next/server').NextRequest;
}

describe('withApiAuth', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 401 when session is null', async () => {
    (getSession as jest.Mock).mockResolvedValue(null);
    const handler = jest.fn();
    const route = withApiAuth(['ADMIN'], handler);
    const res = await route(fakeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not in allow-list', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'EDITOR' } });
    const handler = jest.fn();
    const route = withApiAuth(['ADMIN'], handler);
    const res = await route(fakeRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler and returns its response when role is allowed', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'u2', role: 'EDITOR' } });
    const handler = jest.fn(async (_req, user) => NextResponse.json({ greet: `hi ${user.id}` }));
    const route = withApiAuth(['ADMIN', 'EDITOR'], handler);
    const res = await route(fakeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ greet: 'hi u2' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![1]).toEqual({ id: 'u2', role: 'EDITOR' });
  });

  it('returns 500 with no leaked details when handler throws a generic error', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'u3', role: 'ADMIN' } });
    const handler = jest.fn(async () => { throw new Error('Prisma P2002: leaked secret'); });
    const route = withApiAuth(['ADMIN'], handler);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await route(fakeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'unknown_error' });
    expect(JSON.stringify(body)).not.toContain('P2002');
    consoleError.mockRestore();
  });

  it('translates UnauthorizedError thrown deeper to 401', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'u4', role: 'ADMIN' } });
    const handler = jest.fn(async () => { throw new UnauthorizedError(); });
    const route = withApiAuth(['ADMIN'], handler);
    const res = await route(fakeRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('translates ForbiddenError thrown deeper to 403', async () => {
    (getSession as jest.Mock).mockResolvedValue({ user: { id: 'u5', role: 'ADMIN' } });
    const handler = jest.fn(async () => { throw new ForbiddenError(); });
    const route = withApiAuth(['ADMIN'], handler);
    const res = await route(fakeRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });
});
