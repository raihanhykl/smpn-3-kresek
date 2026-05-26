import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/', heading: /SMP Negeri 3 Kresek|SMPN 3 Kresek/i },
  { path: '/profil', heading: /profil/i },
  { path: '/akademik', heading: /akademik/i },
  { path: '/fasilitas', heading: /fasilitas/i },
  { path: '/kontak', heading: /kontak/i },
];

test.describe('public site smoke', () => {
  for (const p of PAGES) {
    test(`${p.path} renders without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(p.path);
      await expect(page.locator('h1').first()).toBeVisible();
      expect(errors, `Console errors on ${p.path}: ${errors.join(', ')}`).toEqual([]);
    });
  }
});
