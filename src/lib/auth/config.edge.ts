import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe NextAuth config: ONLY JWT/session callbacks + pages.
 * No providers with DB/Node imports — those live in config.ts.
 * Used by middleware (Edge runtime cannot import Prisma).
 */
export const authConfigEdge: NextAuthConfig = {
  // Behind a reverse proxy (e.g. Hostinger) the app runs on an internal
  // host/port while AUTH_URL points at the public HTTPS domain. Without
  // trustHost, auth() tries to fetch its own absolute AUTH_URL from inside the
  // server and fails ("failed to get redirect response: fetch failed").
  // trustHost makes NextAuth trust the forwarded host header instead.
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }, // 7 days
  pages: { signIn: '/admin/login' },
  providers: [], // populated in config.ts (Node side)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword;
      return session;
    },
  },
};
