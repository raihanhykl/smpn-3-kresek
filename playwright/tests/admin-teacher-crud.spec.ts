import { test, expect } from '@playwright/test';

// NOTE on cleanup: the suite runs serially in a single worker and this file sorts
// BEFORE visual-baseline.spec.ts, so any teacher these tests leave behind would add
// extra cards to /profil and break the (height-sensitive) visual baseline. global-setup
// only runs once at suite start (can't clean mid-suite rows), and a direct prisma delete
// would NOT invalidate the live server's `unstable_cache(['teachers'])` — only the admin
// delete flow calls revalidateTag('teachers'). So the add/edit tests below delete the
// teacher they created via the admin UI, restoring the canonical seeded set + cache.
async function deleteTeacherViaUi(page: import('@playwright/test').Page, name: string) {
  await page.goto('/admin/entities/teachers');
  await page.getByText(name).locator('xpath=ancestor::tr').getByRole('button', { name: /hapus/i }).click();
  await page.getByLabel(/ketik nama/i).fill(name);
  await page.getByRole('button', { name: /hapus permanen/i }).click();
  await expect(page.getByText(name)).toHaveCount(0);
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('e2e@smpn3.test');
  await page.getByLabel('Password').fill('e2e-password-123');
  await page.getByRole('button', { name: /masuk/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

test.describe('admin teacher CRUD', () => {
  test('add a teacher → appears in list → appears on public /profil', async ({ page }) => {
    await login(page);
    await page.goto('/admin/entities/teachers');
    await expect(page.getByRole('heading', { name: /guru & staf/i })).toBeVisible();

    await page.getByRole('button', { name: /tambah guru/i }).click();
    const uniqueName = `E2E Guru ${Date.now()}`;
    await page.getByLabel('Nama').fill(uniqueName);
    await page.getByLabel('Jabatan').fill('Guru Uji');
    await page.getByLabel('Gelar / Badge').fill('S.Pd.');
    await page.getByRole('button', { name: /^simpan$/i }).click();

    // Row appears in admin list
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Public /profil shows the new teacher (cache revalidated)
    await page.goto('/profil');
    await expect(page.getByText(uniqueName)).toBeVisible();

    // Clean up via UI so the cache is revalidated and /profil returns to the
    // canonical teacher set for the later visual-baseline suite.
    await deleteTeacherViaUi(page, uniqueName);
  });

  test('edit a teacher updates the row', async ({ page }) => {
    await login(page);
    await page.goto('/admin/entities/teachers');
    await page.getByRole('button', { name: /tambah guru/i }).click();
    const name = `Edit Target ${Date.now()}`;
    await page.getByLabel('Nama').fill(name);
    await page.getByLabel('Jabatan').fill('Awal');
    await page.getByLabel('Gelar / Badge').fill('S.Pd.');
    await page.getByRole('button', { name: /^simpan$/i }).click();
    await expect(page.getByText(name)).toBeVisible();

    // Edit it
    await page.getByText(name).locator('xpath=ancestor::tr').getByRole('button', { name: /edit/i }).click();
    await page.getByLabel('Jabatan').fill('Diubah');
    await page.getByRole('button', { name: /^simpan$/i }).click();
    await expect(page.getByText('Diubah')).toBeVisible();

    // Clean up via UI so the cache is revalidated and /profil returns to the
    // canonical teacher set for the later visual-baseline suite.
    await deleteTeacherViaUi(page, name);
  });

  test('delete a teacher requires typing the name', async ({ page }) => {
    await login(page);
    await page.goto('/admin/entities/teachers');
    await page.getByRole('button', { name: /tambah guru/i }).click();
    const name = `Delete Target ${Date.now()}`;
    await page.getByLabel('Nama').fill(name);
    await page.getByLabel('Jabatan').fill('Hapus');
    await page.getByLabel('Gelar / Badge').fill('S.Pd.');
    await page.getByRole('button', { name: /^simpan$/i }).click();
    await expect(page.getByText(name)).toBeVisible();

    await page.getByText(name).locator('xpath=ancestor::tr').getByRole('button', { name: /hapus/i }).click();
    const confirmBtn = page.getByRole('button', { name: /hapus permanen/i });
    await expect(confirmBtn).toBeDisabled();
    await page.getByLabel(/ketik nama/i).fill(name);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
