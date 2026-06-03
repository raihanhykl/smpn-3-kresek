import { test, expect } from '@playwright/test';

// Visual baseline: screenshots each public page full-page and diffs against the
// committed baseline. Baselines are captured against NEXT_PUBLIC_DATA_SOURCE=api.
// To regenerate intentionally: rm -rf playwright/tests/visual-baseline.spec.ts-snapshots/
// and run: npm run e2e -- playwright/tests/visual-baseline.spec.ts --update-snapshots
//
// Stable-capture notes: in api mode the public pages are async server components
// that fetch from MySQL. The served HTML is byte-identical across requests, so the
// FINAL height is deterministic — but on a route's FIRST hit, `next start` pays a
// cold compile/cache cost and the server-component tree can paint in stages. The
// footer (last element) can attach while a section ABOVE it is still settling, so
// full-page height keeps growing after footer-attach. Captured there, the baseline
// is short by that section's height (seen as /profil at 6250px vs the true 7679px).
//
// Two guards, applied together below:
//   1. warmRoute() pays the cold first-request cost before the measured navigation.
//   2. waitForStableHeight() polls scrollHeight over a wide frame window so any
//      residual partial-paint transient cannot satisfy the stability gate.

// Resolves once the document's full scroll height is unchanged across many
// consecutive animation frames, i.e. the page has stopped growing/reflowing.
//
// The sample window is deliberately wide (30 frames ≈ ~0.5s at 60fps). A cold
// first-request compile can stall the server-component stream mid-tree, leaving
// the document at a PARTIAL height for several frames before the rest paints. A
// short window (5 frames ≈ 80ms) could fully fit inside that stall and report a
// false "stable" at the short height — which is exactly how an under-height
// /profil baseline (6250px vs the true 7679px) got captured once. Pages here
// settle in a single frame when served warm, so the wider window costs nothing
// on the happy path and only matters when a transient stall is present.
async function waitForStableHeight(page: import('@playwright/test').Page) {
  const SAMPLES = 30;
  await page.waitForFunction(
    (samples) => {
      const w = window as unknown as { __vbHeights?: number[] };
      const h = document.documentElement.scrollHeight;
      const arr = (w.__vbHeights ??= []);
      arr.push(h);
      if (arr.length > samples) arr.shift();
      return arr.length === samples && arr.every((v) => v === arr[0]);
    },
    SAMPLES,
    { timeout: 15_000, polling: 'raf' },
  );
}

// Pay the cold first-request compile cost BEFORE the measured navigation. The
// `next start` server compiles/caches a route on its first hit; that first paint
// is where the partial-height stall lives. Warming with a throwaway load + reload
// guarantees the capture navigation below hits an already-warm route, so the
// height is the final one from the first frame. Belt-and-suspenders with the
// widened stability window above.
async function warmRoute(page: import('@playwright/test').Page, path: string) {
  await page.goto(path, { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
}

// Force every scroll-reveal section to its final, revealed state. <RevealOnScroll>
// (.reveal) starts at opacity:0/translateY(32px) and only flips to .is-visible
// when an IntersectionObserver fires on scroll. Below-the-fold sections therefore
// sit in their pre-reveal state during waitForStableHeight (which never scrolls),
// then snap to full height when toHaveScreenshot's fullPage capture scrolls past
// them — whether that happened before height was measured is a race. THIS is what
// made /profil non-deterministic (6250px pre-reveal vs 7679px fully revealed) even
// with warm + a wide stability window. Pinning .reveal to its visible state makes
// the layout height independent of scroll/observer timing. toHaveScreenshot's
// `animations: 'disabled'` does not cover this — .reveal is a JS class toggle, not
// a CSS animation. We disconnect observers and add an override stylesheet so the
// pin holds for the full-page scroll-capture too.
async function settleReveals(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `.reveal { opacity: 1 !important; transform: none !important; transition: none !important; }`,
  });
}

const PAGES = ['/', '/profil', '/akademik', '/fasilitas', '/kontak'];

test.describe('public site visual baseline', () => {
  for (const path of PAGES) {
    test(`${path} matches baseline`, async ({ page }) => {
      // Warm the route first so the measured navigation below never pays the
      // cold first-request compile, which can otherwise capture a partial height.
      await warmRoute(page, path);
      await page.goto(path, { waitUntil: 'load' });
      // Footer attach: the last element on every public page, so its presence means
      // the server-component tree has begun streaming the full document.
      await page.locator('footer').waitFor({ state: 'attached', timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      // Pin scroll-reveal sections to their final state BEFORE measuring height,
      // so the page's full height no longer depends on scroll/observer timing.
      await settleReveals(page);
      // Then wait until the page stops growing — now a true, scroll-independent
      // settled height (guards against any residual cold-compile reflow too).
      await waitForStableHeight(page);
      // TEMP DIAGNOSTIC: dump /profil structural counts to pinpoint the 6250 vs
      // 7679 non-determinism (teacher grid / sections). Remove after root-cause.
      if (path === '/profil') {
        const diag = await page.evaluate(() => {
          const h = document.documentElement.scrollHeight;
          const tabs = document.querySelectorAll('[role="tab"]').length;
          // teacher cards: divs holding a teacher name inside the guru grid.
          const grids = Array.from(document.querySelectorAll('section .grid'));
          const gridCounts = grids.map((g) => g.children.length);
          const sections = Array.from(document.querySelectorAll('section')).map(
            (s) => Math.round((s as HTMLElement).getBoundingClientRect().height),
          );
          return { h, tabs, gridCounts, sectionHeights: sections };
        });
        // eslint-disable-next-line no-console
        console.log('VB_DIAG /profil', JSON.stringify(diag));
      }
      await expect(page).toHaveScreenshot(`${path.replace(/\//g, '_') || '_root'}.png`, {
        fullPage: true,
        // Baselines are generated ON the GitHub `ubuntu-latest` runner (see the
        // update-visual-baselines workflow) so they match CI's exact Chromium +
        // font stack. The small tolerance below is a buffer for sub-pixel
        // anti-aliasing drift when GitHub bumps its runner image — large enough
        // to absorb font-edge noise (~0.5% of pixels), still tight enough to
        // catch a real visual regression (a moved/missing section is far more).
        maxDiffPixelRatio: 0.005,
        maxDiffPixels: 200,
        animations: 'disabled',
      });
    });
  }
});
