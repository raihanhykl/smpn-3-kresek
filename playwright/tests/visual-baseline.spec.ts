import { test, expect } from '@playwright/test';

// Visual baseline: screenshots each public page full-page and diffs against the
// committed baseline. Baselines are captured against NEXT_PUBLIC_DATA_SOURCE=api.
// To regenerate intentionally: rm -rf playwright/tests/visual-baseline.spec.ts-snapshots/
// and run: npm run e2e -- playwright/tests/visual-baseline.spec.ts --update-snapshots
//
// Stable-capture notes: in api mode the public pages are server components that
// fetch from MySQL on first (cold) compile, which can land AFTER networkidle.
// Waiting only for <footer> to attach is NOT enough: on a cold compile the footer
// can paint while a content section ABOVE it (e.g. /profil's achievements grid,
// which is data-driven via featuredIds) is still streaming in, so the full-page
// height keeps growing after footer-attach. A capture there is short by exactly
// that section's height (observed as a ~483px / one-section diff on /profil when
// the suite runs the full ordering and the page is freshly revalidated).
//
// The robust, page-agnostic guard is to poll document height until it stabilizes:
// once the full server-rendered tree has settled, scrollHeight stops changing.

// Resolves once the document's full scroll height is unchanged across several
// consecutive animation frames, i.e. the page has stopped growing/reflowing.
async function waitForStableHeight(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __vbHeights?: number[] };
      const h = document.documentElement.scrollHeight;
      const arr = (w.__vbHeights ??= []);
      arr.push(h);
      if (arr.length > 5) arr.shift();
      // Stable when we have 5 samples that are all identical.
      return arr.length === 5 && arr.every((v) => v === arr[0]);
    },
    undefined,
    { timeout: 15_000, polling: 'raf' },
  );
}

const PAGES = ['/', '/profil', '/akademik', '/fasilitas', '/kontak'];

test.describe('public site visual baseline', () => {
  for (const path of PAGES) {
    test(`${path} matches baseline`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load' });
      // Footer attach: the last element on every public page, so its presence means
      // the server-component tree has begun streaming the full document.
      await page.locator('footer').waitFor({ state: 'attached', timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      // Then wait until the page stops growing — guards against a cold-compile
      // capture taken while a data-driven section above the footer is still filling in.
      await waitForStableHeight(page);
      await expect(page).toHaveScreenshot(`${path.replace(/\//g, '_') || '_root'}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.001,
        maxDiffPixels: 50,
        animations: 'disabled',
      });
    });
  }
});
