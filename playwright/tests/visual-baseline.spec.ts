import { test, expect } from '@playwright/test';

// Visual baseline: captured BEFORE Phase 1 data-source switch.
// After switching to api, re-run to diff. Failures mean public-site drift.
// To regenerate baselines intentionally: rm -rf playwright/tests/visual-baseline.spec.ts-snapshots/
// and run: npm run e2e -- playwright/tests/visual-baseline.spec.ts --update-snapshots

const PAGES = ['/', '/profil', '/akademik', '/fasilitas', '/kontak'];

test.describe('public site visual baseline', () => {
  for (const path of PAGES) {
    test(`${path} matches baseline`, async ({ page }) => {
      await page.goto(path);
      // Wait for fonts to load to keep snapshot stable.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${path.replace(/\//g, '_') || '_root'}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.001,
        maxDiffPixels: 50,
        animations: 'disabled',
      });
    });
  }
});
