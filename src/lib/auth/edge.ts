import NextAuth from 'next-auth';
import { authConfigEdge } from './config.edge';

/**
 * Edge-runtime-compatible NextAuth instance. Used ONLY by src/middleware.ts.
 * Server components, route handlers, and server actions should import from './config' instead.
 */
export const { auth } = NextAuth(authConfigEdge);
