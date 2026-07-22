import { test, expect } from '@playwright/test';
import { stubEnvironment } from './fixtures';

// Exercises sw.js's real tile-cache cap/eviction logic and the manual clear
// action against the real service worker. Like pwa-installability.spec.ts,
// these opt back into service workers (blocked globally by default — see
// playwright.config.ts) and clean up their own registration/caches so
// nothing leaks into later, unrelated specs.
//
// TILE_CACHE_MAX_ENTRIES / TILE_CACHE_WATERMARK / TILE_CACHE_NAME below must
// track the constants of the same name in sw.js: there is no shared import
// between the plain SW script and the test suite, so a change to one
// requires updating the other.
const TILE_CACHE_MAX_ENTRIES = 4000;
const TILE_CACHE_WATERMARK = Math.floor(TILE_CACHE_MAX_ENTRIES * 0.9);
const TILE_CACHE_NAME = 'pipboy-tiles-v2';

const tileUrl = (n: number) => `https://a.basemaps.cartocdn.com/dark_nolabels/10/0/${n}.png`;
const TINY_PNG = Buffer.from('89504e470d0a1a0a', 'hex');

const unregisterAndClearCaches = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  });

test.describe(() => {
  test.use({ serviceWorkers: 'allow' });

  // Real network round trips for 4000 distinct tiles would be slow and
  // wouldn't test anything the direct-seed approach doesn't already cover, so
  // the cache is seeded directly (bypassing the network) up to and past the
  // cap, in known insertion order, and only the boundary-crossing fetch goes
  // through the real tileCacheFirst()/trimTileCache() path via a real network
  // response (routed here rather than hitting CARTO).
  test('tile cache evicts the oldest entries once the cap is exceeded', async ({ page, context }) => {
    let networkHits = 0;
    await context.route(/basemaps\.cartocdn\.com/, (route) => {
      networkHits += 1;
      return route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG });
    });

    await stubEnvironment(page, { allowServiceWorker: true });
    await page.goto('/index.html');
    await page.evaluate(() => navigator.serviceWorker.ready);

    const seedUrls = Array.from({ length: TILE_CACHE_MAX_ENTRIES }, (_, i) => tileUrl(i));
    await page.evaluate(
      async ({ cacheName, urls }) => {
        const cache = await caches.open(cacheName);
        for (const url of urls) {
          await cache.put(url, new Response('seed', { status: 200 }));
        }
      },
      { cacheName: TILE_CACHE_NAME, urls: seedUrls },
    );

    // One real miss pushes the cache to MAX + 1, crossing the cap.
    const newUrl = tileUrl(TILE_CACHE_MAX_ENTRIES);
    await page.evaluate((url) => fetch(url), newUrl);

    const state = await page.evaluate(
      async ({ cacheName, firstUrl, lastSeedUrl, newUrl }) => {
        const cache = await caches.open(cacheName);
        return {
          total: (await cache.keys()).length,
          hasFirst: !!(await cache.match(firstUrl)),
          hasLastSeed: !!(await cache.match(lastSeedUrl)),
          hasNew: !!(await cache.match(newUrl)),
        };
      },
      { cacheName: TILE_CACHE_NAME, firstUrl: tileUrl(0), lastSeedUrl: tileUrl(TILE_CACHE_MAX_ENTRIES - 1), newUrl },
    );

    // Only the one genuine miss reached the network.
    expect(networkHits).toBe(1);
    // The cache settled back at the watermark, not just under the raw cap.
    expect(state.total).toBe(TILE_CACHE_WATERMARK);
    // The oldest entry is gone...
    expect(state.hasFirst).toBe(false);
    // ...while a recently-inserted tile and the just-fetched one survive.
    expect(state.hasLastSeed).toBe(true);
    expect(state.hasNew).toBe(true);

    await unregisterAndClearCaches(page);
  });

  // The requirement this guards: a cache hit must not reorder its entry. If it
  // did, re-reading an early tile would make it look "newest" and it would
  // survive the next eviction; since hits are read-only here, it is swept
  // along with the rest of the oldest batch regardless of having been read.
  test('a cache hit does not change a tile\'s position in eviction order', async ({ page, context }) => {
    await context.route(/basemaps\.cartocdn\.com/, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }),
    );

    await stubEnvironment(page, { allowServiceWorker: true });
    await page.goto('/index.html');
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Seed the full cap directly, in order, so index 0 is the oldest entry.
    const seedUrls = Array.from({ length: TILE_CACHE_MAX_ENTRIES }, (_, i) => tileUrl(i));
    await page.evaluate(
      async ({ cacheName, urls }) => {
        const cache = await caches.open(cacheName);
        for (const url of urls) {
          await cache.put(url, new Response('seed', { status: 200 }));
        }
      },
      { cacheName: TILE_CACHE_NAME, urls: seedUrls },
    );

    // Re-request the oldest tile through the real SW fetch handler. It is
    // already cached, so this must be served from cache with zero network
    // traffic — a genuine hit, not a re-fetch that could reset its age.
    let networkHitsForFirst = 0;
    await context.route(tileUrl(0), (route) => {
      networkHitsForFirst += 1;
      return route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG });
    });
    await page.evaluate((url) => fetch(url), tileUrl(0));
    expect(networkHitsForFirst).toBe(0);

    // Cross the cap with one more real miss.
    const newUrl = tileUrl(TILE_CACHE_MAX_ENTRIES);
    await page.evaluate((url) => fetch(url), newUrl);

    const hasFirst = await page.evaluate(
      async ({ cacheName, firstUrl }) => !!(await (await caches.open(cacheName)).match(firstUrl)),
      { cacheName: TILE_CACHE_NAME, firstUrl: tileUrl(0) },
    );

    // Had the hit bumped its recency, it would have survived as "newest".
    // It didn't survive, proving hits don't reorder.
    expect(hasFirst).toBe(false);

    await unregisterAndClearCaches(page);
  });

  // Mirrors the shell-cache stale-sweep test in pwa-installability.spec.ts,
  // for the tile cache's own version bump (the one-time purge of the
  // pre-existing bloat this change ships to fix).
  test('a stale tile cache is purged on activation, like the shell cache', async ({ page }) => {
    await page.addInitScript(() => {
      caches.open('pipboy-tiles-v1').then((c) => c.put('https://stale.example/__stale-tile__', new Response('old')));
    });

    await stubEnvironment(page, { allowServiceWorker: true });
    await page.goto('/index.html');
    await page.evaluate(() => navigator.serviceWorker.ready);

    const keys = await page.evaluate(async () => {
      const deadline = Date.now() + 5000;
      let names = await caches.keys();
      while (names.includes('pipboy-tiles-v1') && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
        names = await caches.keys();
      }
      return names;
    });

    expect(keys).not.toContain('pipboy-tiles-v1');

    await unregisterAndClearCaches(page);
  });

  test('SVUOTA CACHE MAPPA clears the tile cache without touching the shell cache or session', async ({ page, context }) => {
    await context.route(/basemaps\.cartocdn\.com/, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }),
    );

    await stubEnvironment(page, { allowServiceWorker: true });
    await page.goto('/index.html');
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Something in the tile cache to clear.
    await page.evaluate(
      async ({ cacheName, url }) => {
        const cache = await caches.open(cacheName);
        await cache.put(url, new Response('seed', { status: 200 }));
      },
      { cacheName: TILE_CACHE_NAME, url: tileUrl(0) },
    );

    await page.locator('#pb-config-knob').click();
    const clearBtn = page.locator('#pb-settings-popup [data-clear-tiles]');
    await clearBtn.click();
    await expect(clearBtn).toHaveText('CACHE SVUOTATA');

    const { tileCacheGone, shellCachePresent } = await page.evaluate(async (cacheName) => {
      const names = await caches.keys();
      return {
        tileCacheGone: !names.includes(cacheName),
        shellCachePresent: names.some((n) => n.startsWith('pipboy-') && n !== cacheName),
      };
    }, TILE_CACHE_NAME);

    expect(tileCacheGone).toBe(true);
    expect(shellCachePresent).toBe(true);
    // No navigation/logout side effect — still on the login screen.
    await expect(page.locator('#pb-login-username')).toBeVisible();

    await unregisterAndClearCaches(page);
  });
});
