import { hashPassword, verifyPassword, BCRYPT_COST } from '@/lib/auth/password';

describe('password', () => {
  it('hashes and verifies roundtrip', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(50);
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('right');
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('returns false (not throw) when hash is malformed', async () => {
    await expect(verifyPassword('anything', 'not-a-bcrypt-hash')).resolves.toBe(false);
  });

  it('produces different hashes for same input (salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
  });

  // --- spec-locked values ---

  it('uses bcrypt cost 10 (per spec Section 5)', async () => {
    expect(BCRYPT_COST).toBe(10);
    const hash = await hashPassword('x');
    // bcryptjs format: $2a$10$... or $2b$10$...
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('verifyPassword does not throw on empty password (timing-attack safety)', async () => {
    const hash = await hashPassword('real');
    await expect(verifyPassword('', hash)).resolves.toBe(false);
  });
});
