import { test, expect } from '@playwright/test';

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
