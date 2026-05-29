import { config as loadEnv } from 'dotenv';

// Ensure TEST_DATABASE_URL (test DB creds, gitignored) is loaded from .env.local
// before we wire up DATABASE_URL below.
loadEnv({ path: '.env.local' });

// Provide all env required by src/lib/env.ts validation. We intentionally do NOT
// set SKIP_ENV_VALIDATION here — integration tests should fail fast if env shape
// drifts from the validator, surfacing config bugs before production does.
// NOTE: next/jest auto-loads .env / .env.local (which point at the DEV database).
// Integration tests run destructive deleteMany/seed cycles, so we MUST force the
// dedicated test DB here with a hard assignment — `??=` would leave the dev URL in
// place and let tests wipe real data. The test DB URL (with credentials) comes from
// TEST_DATABASE_URL in .env.local (gitignored); CI sets DATABASE_URL directly.
process.env.DATABASE_URL = process.env.CI
  ? process.env.DATABASE_URL
  : process.env.TEST_DATABASE_URL;
if (!process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set — add it to .env.local (see .env.example).');
}
process.env.AUTH_SECRET ??= 'test-secret-must-be-at-least-thirty-two-chars';
process.env.AUTH_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_DATA_SOURCE ??= 'static';

// `next/cache` exposes `unstable_cache` and `revalidateTag`, both of which
// require Next.js request/work-store context to function. Integration tests
// run outside that context, so we mock the module to pass through the
// underlying function while preserving the public surface. Cache-invalidation
// behaviour is exercised separately at the route-handler / e2e layer.
jest.mock('next/cache', () => ({
  unstable_cache: <Args extends unknown[], R>(fn: (...args: Args) => R) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));
