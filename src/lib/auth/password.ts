import bcrypt from 'bcryptjs';

/**
 * Spec-locked bcrypt work factor (Section 5). Exported for tests and
 * for the constant-time DUMMY_HASH generator in auth/config.ts.
 */
export const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Returns true on match, false otherwise. CONTRACT: never throws.
 * Designed to be called even when the user is unknown (callers feed a
 * structurally-valid dummy hash) to keep timing constant across the
 * known-vs-unknown user paths.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
