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
    command: 'npx prisma generate && npm run build && npm run start',
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
      // E2E runs many logins from a single localhost IP, which all share one
      // rate-limit bucket (prod default is 5/15min). Raise the ceiling for the
      // test deployment only — production keeps the secure default.
      LOGIN_RATE_LIMIT_MAX: '1000',
    },
  },
});
