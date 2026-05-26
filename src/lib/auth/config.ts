import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { headers as nextHeaders } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { loginRateLimiter } from '@/lib/auth/rate-limit';
import { writeAudit } from '@/lib/security/audit';
import { authConfigEdge } from './config.edge';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Structurally-valid bcrypt hash used as a constant-time placeholder when the
 * email is unknown. NEVER matches any real password (verifyPassword returns false).
 * Generated once at module load by hashing a random throwaway string, so the cost
 * matches our COST constant (10).
 */
const DUMMY_HASH = await hashPassword(`__dummy_${Math.random()}_${Date.now()}__`);

async function getClientIp(): Promise<string | null> {
  try {
    const h = await nextHeaders();
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      h.get('x-real-ip') ??
      null
    );
  } catch {
    return null; // outside request scope (rare)
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfigEdge,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const ip = (await getClientIp()) ?? parsed.data.email;
        const rl = loginRateLimiter.check(ip);
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        // Always run bcrypt to keep timing constant whether user exists or not.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const valid = await verifyPassword(parsed.data.password, hash);
        if (!user || !valid) {
          if (user) {
            await writeAudit({
              userId: user.id,
              action: 'login_failed',
              target: `session:${user.id}`,
            }).catch(() => {});
          }
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await writeAudit({
          userId: user.id,
          action: 'login_success',
          target: `session:${user.id}`,
        }).catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
