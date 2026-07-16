import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

// This spec is the basemap licence obligation's only automated guard.
//
// Nothing about a filtered green map makes a missing credit visible, so the
// obligation is pinned here rather than by a comment. The map shows attribution
// for five seconds and then collapses it, which the OSM Foundation's Attribution
// Guidelines permit ONLY via one of three named mechanisms — "automatically
// after five seconds" is the one this app takes, verbatim. Delete these tests
// and the licence condition can rot silently.
//
// If this reads as noise: it is not. See design.md.

/** Override the collapse delay so this spec need not wait five real seconds. */
async function seedAttributionDelay(page: Page, ms: number) {
  await page.addInitScript((value: number) => {
    (window as unknown as Record<string, unknown>).__PB_MAP_ATTRIBUTION_MS__ = value;
  }, ms);
}

async function openMap(page: Page) {
  await stubEnvironment(page, {
    role: 'player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' }),
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
}

test('entering the tab shows a line naming OpenStreetMap and CARTO', async ({ page }) => {
  await seedAttributionDelay(page, 30_000);
  await openMap(page);

  const attr = page.locator('[data-map-attr]');
  await expect(attr).toBeVisible();
  await expect(attr).toContainText('OpenStreetMap');
  await expect(attr).toContainText('CARTO');
});

test('the line is gone once the collapse delay elapses', async ({ page }) => {
  await seedAttributionDelay(page, 250);
  await openMap(page);

  await expect(page.locator('[data-map-attr]')).toHaveCount(0, { timeout: 5000 });
});

test('no Leaflet attribution control is ever rendered', async ({ page }) => {
  // attributionControl: false also drops Leaflet's own "Leaflet" prefix. Its
  // BSD-2 notice lives in the vendored source, which is what the licence asks
  // for; a permanent watermark is not.
  await seedAttributionDelay(page, 30_000);
  await openMap(page);

  await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
  await page.evaluate(() => (window as any).__PB_MAP__.setZoom(15));
  await page.waitForTimeout(200);
  await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
});

test('no watermark remains once the map has been open past the delay', async ({ page }) => {
  await seedAttributionDelay(page, 250);
  await openMap(page);
  await page.waitForTimeout(600);

  await expect(page.locator('[data-map-attr]')).toHaveCount(0);
  await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
});

test('the visible line does not intercept a pan beneath it', async ({ page }) => {
  await seedAttributionDelay(page, 30_000);
  await openMap(page);

  const attr = page.locator('[data-map-attr]');
  await expect(attr).toBeVisible();

  // pointer-events: none — what is under the line is the map, not the line.
  const box = (await attr.boundingBox())!;
  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        isAttr: !!el?.closest('[data-map-attr]'),
        reachesMap: !!el?.closest('.leaflet-container'),
      };
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );

  expect(hit.isAttr).toBe(false);
  expect(hit.reachesMap).toBe(true);
});

test('it does not reappear on pan or zoom within the same visit', async ({ page }) => {
  await seedAttributionDelay(page, 250);
  await openMap(page);
  await expect(page.locator('[data-map-attr]')).toHaveCount(0, { timeout: 5000 });

  await page.evaluate(() => {
    const map = (window as any).__PB_MAP__;
    map.panBy([60, 0]);
    map.setZoom(15);
  });
  await page.waitForTimeout(300);

  await expect(page.locator('[data-map-attr]')).toHaveCount(0);
});

test('re-entering the tab presents the attribution again', async ({ page }) => {
  // "Collapsed" presupposes something that was shown: each visit is a fresh
  // presentation, which is what the guidelines' initial-presentation clause asks
  // for.
  await seedAttributionDelay(page, 30_000);
  await openMap(page);
  await expect(page.locator('[data-map-attr]')).toBeVisible();

  await page.locator('.pb-tab', { hasText: 'NOTES' }).click();
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();

  await expect(page.locator('[data-map-attr]')).toBeVisible();
});
