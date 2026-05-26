// Provide all env required by src/lib/env.ts validation. We intentionally do NOT
// set SKIP_ENV_VALIDATION here — integration tests should fail fast if env shape
// drifts from the validator, surfacing config bugs before production does.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/smpn3_test?schema=public';
process.env.AUTH_SECRET ??= 'test-secret-must-be-at-least-thirty-two-chars';
process.env.AUTH_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_DATA_SOURCE ??= 'static';
