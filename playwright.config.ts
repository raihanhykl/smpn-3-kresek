import { defineConfig, devices } from '@playwright/test';

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
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://test:test@localhost:5433/smpn3_test?schema=public',
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
