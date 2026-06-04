import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Playwright does not auto-load .env.local; pull TEST_DATABASE_URL (test DB creds) from it.
loadEnv({ path: '.env.local' });

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL && !process.env.CI) {
  throw new Error('TEST_DATABASE_URL is not set — add it to .env.local (see .env.example).');
}

export default defineConfig({
  testDir: './playwright/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './playwright/global-setup.ts',
  webServer: {
    // The seed MUST run before `build`. /profil is statically prerendered and bakes
    // its DB-backed teacher grid (getTeachers, unstable_cache) into the static HTML
    // at build time. globalSetup also seeds, but Playwright starts the webServer in
    // parallel with globalSetup — so without seeding here, `build` can prerender
    // /profil against an unseeded DB and freeze a short (teacher-less) page into the
    // static output. That race is exactly what produced a 6250px vs 7679px /profil
    // baseline mismatch. Seeding in-line guarantees the prerender sees the full set.
    //
    // SKIP_ENV_VALIDATION mirrors the CI `build` job: collecting page data for
    // routes that import src/lib/env.ts (e.g. /api/media/confirm) would otherwise
    // fail validation because Cloudinary creds aren't provisioned for E2E. No E2E
    // test exercises the media routes, so the live server never needs real creds.
    command:
      'npx prisma generate && npx prisma migrate deploy && npx tsx scripts/seed-content.ts && SKIP_ENV_VALIDATION=true npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // CI sets DATABASE_URL to its own test DB; locally always use TEST_DATABASE_URL
      // (loadEnv above may have put the DEV url into process.env.DATABASE_URL, which
      // would point the server at dev data and break login/visual fixtures).
      DATABASE_URL: process.env.CI ? process.env.DATABASE_URL! : TEST_DATABASE_URL!,
      AUTH_SECRET: 'e2e-secret-must-be-at-least-thirty-two-chars',
      AUTH_URL: 'http://localhost:3000',
      NEXT_PUBLIC_DATA_SOURCE: 'api',
      // Placeholder Cloudinary creds so the served runtime can resolve env.ts even
      // if a future test hits a media route. They never reach Cloudinary — no E2E
      // currently touches the signer.
      CLOUDINARY_API_KEY: 'e2e-cloudinary-key',
      CLOUDINARY_API_SECRET: 'e2e-cloudinary-secret',
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'e2e-cloud',
      // E2E runs many logins from a single localhost IP, which all share one
      // rate-limit bucket (prod default is 5/15min). Raise the ceiling for the
      // test deployment only — production keeps the secure default.
      LOGIN_RATE_LIMIT_MAX: '1000',
    },
  },
});
