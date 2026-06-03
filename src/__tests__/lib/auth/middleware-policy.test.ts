import { decideMiddlewareAction } from '@/lib/auth/middleware-policy';

const sessionOk = { user: { id: 'u1', role: 'ADMIN' as const, mustChangePassword: false } };
const sessionForceChange = { user: { id: 'u1', role: 'ADMIN' as const, mustChangePassword: true } };

describe('decideMiddlewareAction', () => {
  it('lets non-admin paths through', () => {
    expect(decideMiddlewareAction({ pathname: '/profil', search: '', session: null })).toEqual({
      type: 'next',
    });
  });

  it('lets /admin/login through even when unauthenticated', () => {
    expect(decideMiddlewareAction({ pathname: '/admin/login', search: '', session: null })).toEqual({
      type: 'next',
    });
  });

  it('redirects unauthenticated /admin/dashboard to login with returnUrl', () => {
    const result = decideMiddlewareAction({
      pathname: '/admin/dashboard',
      search: '?x=1',
      session: null,
    });
    expect(result).toEqual({ type: 'redirect', to: '/admin/login?returnUrl=%2Fadmin%2Fdashboard%3Fx%3D1' });
  });

  it('redirects authenticated user with mustChangePassword to change-password page', () => {
    const result = decideMiddlewareAction({
      pathname: '/admin/dashboard',
      search: '',
      session: sessionForceChange,
    });
    expect(result).toEqual({ type: 'redirect', to: '/admin/change-password' });
  });

  it('allows authenticated user with mustChangePassword to reach the change-password page itself', () => {
    expect(
      decideMiddlewareAction({
        pathname: '/admin/change-password',
        search: '',
        session: sessionForceChange,
      }),
    ).toEqual({ type: 'next' });
  });

  it('lets authenticated user with no flag through to any admin page', () => {
    expect(
      decideMiddlewareAction({ pathname: '/admin/dashboard', search: '', session: sessionOk }),
    ).toEqual({ type: 'next' });
  });
});
