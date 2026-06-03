import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/edge';
import { decideMiddlewareAction } from '@/lib/auth/middleware-policy';

export default async function middleware(req: NextRequest) {
  const session = await auth();
  const action = decideMiddlewareAction({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    session: session
      ? {
          user: {
            id: session.user.id,
            role: session.user.role,
            mustChangePassword: session.user.mustChangePassword,
          },
        }
      : null,
  });

  if (action.type === 'redirect') {
    return NextResponse.redirect(new URL(action.to, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
