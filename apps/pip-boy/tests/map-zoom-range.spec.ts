import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, nextFrames, type StubOptions } from './fixtures';

// Covers pipboy-map-tab's zoom range: a non-default configured range is
// honoured, and the effective floor is raised to the zoom at which the bounds
// fill the canvas — recomputed when the canvas resizes (immersive toggle).

const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;

/** Bounds about 11 km across: they fill the canvas far above the config floor. */
const TIGHT_BOUNDS = {
  south: ORIGIN_LAT - 0.05,
  west: ORIGIN_LNG - 0.05,
  north: ORIGIN_LAT + 0.05,
  east: ORIGIN_LNG + 0.05,
};

async function openMap(page: Page, opts: StubOptions = {}) {
  // No need to wait out the immersive revalidation timeout.
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__PB_MAP_IMMERSIVE_MS__ = 0;
  });
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' }),
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  // The floor is applied in the mount's first frame, once the pane has a size.
  await nextFrames(page);
}

/** Zoom without animation and report where Leaflet let it land. */
const zoomTo = (page: Page, zoom: number) =>
  page.evaluate((z) => {
    const map = (window as any).__PB_MAP__;
    map.setZoom(z, { animate: false });
    return map.getZoom();
  }, zoom);

/**
 * The floor computed independently of the app: the largest whole zoom at which
 * the bounds' projected span fits the canvas in both directions.
 */
const expectedFloor = (page: Page, bounds: typeof TIGHT_BOUNDS) =>
  page.evaluate((b) => {
    const map = (window as any).__PB_MAP__;
    const size = map.getSize();
    const z = map.getZoom();
    const nw = map.project([b.north, b.west], z);
    const se = map.project([b.south, b.east], z);
    const scale = Math.min(size.x / (se.x - nw.x), size.y / (se.y - nw.y));
    return Math.floor(z + Math.log2(scale) + 1e-9);
  }, bounds);

test('a non-default zoom range is honoured', async ({ page }) => {
  const config = { ...DEFAULT_MAP_CONFIG, startZoom: 10, minZoom: 8, maxZoom: 12 };
  await openMap(page, { campaignMap: { config, places: [] } });

  expect(await zoomTo(page, 5)).toBe(8);
  expect(await zoomTo(page, 15)).toBe(12);
});

test('zooming out stops at the zoom at which the bounds fill the canvas', async ({ page }) => {
  const config = { ...DEFAULT_MAP_CONFIG, minZoom: 3, bounds: TIGHT_BOUNDS };
  await openMap(page, { campaignMap: { config, places: [] } });

  const floor = await expectedFloor(page, TIGHT_BOUNDS);
  expect(floor).toBeGreaterThan(config.minZoom);
  expect(await zoomTo(page, config.minZoom)).toBe(floor);

  // At the floor the whole bounds are on screen.
  const fits = await page.evaluate((b) => {
    const map = (window as any).__PB_MAP__;
    return map.getBounds().pad(0.001).contains([[b.south, b.west], [b.north, b.east]]);
  }, TIGHT_BOUNDS);
  expect(fits).toBe(true);
});

test('the floor never exceeds the configured maximum', async ({ page }) => {
  const config = { ...DEFAULT_MAP_CONFIG, startZoom: 9, minZoom: 3, maxZoom: 9, bounds: TIGHT_BOUNDS };
  await openMap(page, { campaignMap: { config, places: [] } });

  expect(await page.evaluate(() => (window as any).__PB_MAP__.getMinZoom())).toBe(9);
  expect(await zoomTo(page, 3)).toBe(9);
});

test('entering and leaving immersive recomputes the floor against the new canvas', async ({ page }) => {
  const config = { ...DEFAULT_MAP_CONFIG, minZoom: 3, bounds: TIGHT_BOUNDS };
  await openMap(page, { campaignMap: { config, places: [] } });
  await zoomTo(page, 3);

  const minZoom = () => page.evaluate(() => (window as any).__PB_MAP__.getMinZoom());
  const size = () => page.evaluate(() => (window as any).__PB_MAP__.getSize());

  const before = await size();
  await page.locator('[data-map-fs]').click();
  await expect.poll(async () => (await size()).y).toBeGreaterThan(before.y);
  await nextFrames(page);

  const inImmersive = await expectedFloor(page, TIGHT_BOUNDS);
  expect(await minZoom()).toBe(inImmersive);
  expect(await page.evaluate(() => (window as any).__PB_MAP__.getZoom())).toBeGreaterThanOrEqual(inImmersive);

  await page.locator('[data-map-fs]').click();
  await expect.poll(async () => (await size()).y).toBe(before.y);
  await nextFrames(page);

  // The floor follows the canvas back down, too.
  expect(await minZoom()).toBe(await expectedFloor(page, TIGHT_BOUNDS));
});

test('a canvas that grows past the next level raises the current zoom with the floor', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const config = { ...DEFAULT_MAP_CONFIG, minZoom: 3, bounds: TIGHT_BOUNDS };
  await openMap(page, { campaignMap: { config, places: [] } });
  const low = await zoomTo(page, 3);

  // Doubling the canvas fits the bounds one whole level further in.
  await page.setViewportSize({ width: 1700, height: 1300 });
  await expect
    .poll(() => page.evaluate(() => (window as any).__PB_MAP__.getMinZoom()))
    .toBeGreaterThan(low);
  const floor = await expectedFloor(page, TIGHT_BOUNDS);
  await expect.poll(() => page.evaluate(() => (window as any).__PB_MAP__.getZoom())).toBe(floor);
});
