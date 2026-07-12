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

  // The self-heal contract the deploy-cache-busting change relies on: on
  // activation the SW deletes every cache whose name != CACHE_VERSION, leaving
  // only the current version's shell cache. Here CACHE_VERSION is the unstamped
  // source placeholder ('pipboy-__BUILD_ID__'); the served bytes stay stable, so
  // the assertion is on the cache-name shape and the purge, not a concrete SHA.
  test('activation caches the shell under a single pipboy-* cache and purges stale ones', async ({ page }) => {
    // Seed a stale, differently-named shell cache before the app registers the
    // SW, so activation's cleanup has a prior version to delete.
    await page.addInitScript(() => {
      caches.open('pipboy-stale-v0').then((c) => c.put('/__stale__', new Response('old')));
    });

    await stubEnvironment(page, { allowServiceWorker: true });
    await page.goto('/index.html');
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Wait for the activate cleanup (install -> addAll -> activate purge) to run.
    const keys = await page.evaluate(async () => {
      const deadline = Date.now() + 5000;
      let names = await caches.keys();
      while (names.includes('pipboy-stale-v0') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
        names = await caches.keys();
      }
      return names;
    });

    // The stale cache did not survive activation.
    expect(keys).not.toContain('pipboy-stale-v0');
    // Exactly one shell cache remains, and its name carries the version segment.
    const shellCaches = keys.filter((k) => k.startsWith('pipboy-'));
    expect(shellCaches).toHaveLength(1);
    expect(shellCaches[0]).toMatch(/^pipboy-.+/);

    // Clean up so this SW / its caches don't leak into later specs.
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    });
  });
});
