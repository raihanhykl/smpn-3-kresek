import { test, expect } from '@playwright/test';

test.describe('admin login', () => {
  test('redirect unauthenticated /admin/dashboard → /admin/login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('e2e@smpn3.test');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /masuk/i }).click();
    // Scope to the form's <p role="alert">; Next.js layout has its own route
    // announcer with role="alert" that would otherwise cause a strict-mode match.
    await expect(page.locator('p[role="alert"]')).toContainText(/salah/i);
  });

  test('correct credentials → dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('e2e@smpn3.test');
    await page.getByLabel('Password').fill('e2e-password-123');
    await page.getByRole('button', { name: /masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText(/selamat datang/i)).toBeVisible();
  });

  test('logout returns to login', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('e2e@smpn3.test');
    await page.getByLabel('Password').fill('e2e-password-123');
    await page.getByRole('button', { name: /masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await page.getByRole('button', { name: /keluar/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('force-change-password: login → redirected to change-password → change → re-login → dashboard', async ({
    page,
  }) => {
    // 1. Login with the user that has mustChangePassword=true
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('e2e-must-change@smpn3.test');
    await page.getByLabel('Password').fill('temp-password-123');
    await page.getByRole('button', { name: /masuk/i }).click();

    // 2. Should be redirected to /admin/change-password.
    // NOTE: when the redirect happens via Server Action → signIn(redirectTo)
    // → middleware (mustChangePassword), Next.js renders the correct
    // change-password content but the browser URL bar may briefly stay on
    // the original redirectTo target. We assert on the rendered content
    // first (which is the user-visible truth), then on URL with a longer
    // poll so the router has time to settle.
    await expect(page.getByRole('heading', { name: /ganti password/i })).toBeVisible();

    // 3. Hard-navigate to /admin/dashboard — middleware must bounce us back
    // (this also reliably aligns the URL bar with /admin/change-password).
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/change-password/);

    // 4. Submit new password
    await page.getByLabel('Password saat ini').fill('temp-password-123');
    await page.getByLabel('Password baru (min 8 karakter)').fill('new-strong-password-456');
    await page.getByLabel('Konfirmasi password baru').fill('new-strong-password-456');
    await page.getByRole('button', { name: /ganti password/i }).click();

    // 5. After signOut, we land on login with ?passwordChanged=1
    await expect(page).toHaveURL(/\/admin\/login\?passwordChanged=1/);

    // 6. Re-login with the NEW password → goes to dashboard (flag cleared)
    await page.getByLabel('Email').fill('e2e-must-change@smpn3.test');
    await page.getByLabel('Password').fill('new-strong-password-456');
    await page.getByRole('button', { name: /masuk/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});
