import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe NextAuth config: ONLY JWT/session callbacks + pages.
 * No providers with DB/Node imports — those live in config.ts.
 * Used by middleware (Edge runtime cannot import Prisma).
 */
export const authConfigEdge: NextAuthConfig = {
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
