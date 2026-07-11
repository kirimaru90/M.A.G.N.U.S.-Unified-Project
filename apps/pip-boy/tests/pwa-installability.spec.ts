import { test, expect } from '@playwright/test';
import { stubEnvironment } from './fixtures';

test('manifest is linked and parses as a valid web app manifest', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe('manifest.webmanifest');

  const manifest = await page.evaluate(async (href) => {
    const res = await fetch(href);
    return res.json();
  }, manifestHref!);

  expect(manifest.name).toBe('M.A.G.N.U.S. Pip-Boy');
  expect(manifest.start_url).toBe('./');
  expect(manifest.display).toBe('standalone');
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
});

// The global config blocks service workers by default (see playwright.config.ts)
// so an SW installed here can't silently intercept fetches in later, unrelated
// test runs. This is the one spec that needs the real thing, so it opts back in.
test.describe(() => {
  test.use({ serviceWorkers: 'allow' });

  test('service worker registers with scope ./', async ({ page }) => {
    await stubEnvironment(page, { allowServiceWorker: true });
    await page.goto('/index.html');

    const registration = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope };
    });

    expect(new URL(registration.scope).pathname.endsWith('/')).toBe(true);

    // Clean up so this SW doesn't outlive the test and interfere with others.
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    });
  });
});
