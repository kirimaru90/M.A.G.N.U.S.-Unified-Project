import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, gotoTab } from './fixtures';

// This spec is the basemap licence obligation's only automated guard.
//
// Nothing about a filtered green map makes a missing credit visible, so the
// obligation is pinned here rather than by a comment. With a CARTO key the CARTO
// Basemaps Terms apply: "© OpenStreetMap contributors, © CARTO", both linked,
// "visible on the map itself … not hidden, faded or behind a click". So the
// shipped default is a permanent line. ATTRIBUTION_COLLAPSE_MS in
// src/tabs/basemap.js can switch it to the older OSM-style timed collapse; both
// modes are covered so reverting is a one-constant change with tests already in
// place. Delete these tests and the licence condition can rot silently.

/** Override the attribution lifetime: `null` = permanent, ms = collapse mode. */
async function seedAttributionDelay(page: Page, ms: number | null) {
  await page.addInitScript((value: number | null) => {
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

const attr = (page: Page) => page.locator('[data-map-attr]');

// ── Both modes ────────────────────────────────────────────────────────────────

test('entering the tab shows the CARTO-worded credit', async ({ page }) => {
  await openMap(page);

  await expect(attr(page)).toBeVisible();
  await expect(attr(page)).toContainText('OpenStreetMap contributors');
  await expect(attr(page)).toContainText('CARTO');
});

test('both names link to their attribution pages, outside the app', async ({ page }) => {
  await openMap(page);

  const osm = attr(page).getByRole('link', { name: 'OpenStreetMap contributors' });
  const carto = attr(page).getByRole('link', { name: 'CARTO' });
  await expect(osm).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await expect(carto).toHaveAttribute('href', 'https://carto.com/attribution');
  for (const a of [osm, carto]) {
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', /noopener/);
  }
});

test('no Leaflet attribution control is ever rendered', async ({ page }) => {
  // attributionControl: false also drops Leaflet's own "Leaflet" prefix. Its
  // BSD-2 notice lives in the vendored source, which is what the licence asks for.
  await openMap(page);

  await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
  await page.evaluate(() => (window as any).__PB_MAP__.setZoom(15));
  await page.waitForTimeout(200);
  await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
});

test('the line does not intercept a pan beneath its non-link area', async ({ page }) => {
  await openMap(page);
  await expect(attr(page)).toBeVisible();

  // pointer-events: none on the line — only its links take input. The left
  // padding is line, not link: what is under it must be the map.
  const box = (await attr(page).boundingBox())!;
  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        isAttr: !!el?.closest('[data-map-attr]'),
        reachesMap: !!el?.closest('.leaflet-container'),
      };
    },
    { x: box.x + 2, y: box.y + box.height / 2 },
  );

  expect(hit.isAttr).toBe(false);
  expect(hit.reachesMap).toBe(true);
});

test('its links are clickable despite the pass-through line', async ({ page }) => {
  await openMap(page);

  const link = attr(page).getByRole('link', { name: 'CARTO' });
  const box = (await link.boundingBox())!;
  const isLink = await page.evaluate(
    ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-map-attr] a'),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(isLink).toBe(true);
});

// ── Default (permanent) mode ─────────────────────────────────────────────────

test('the shipped default is permanent: no override, still there after 6 s', async ({ page }) => {
  // No seedAttributionDelay: this pins ATTRIBUTION_COLLAPSE_MS itself, so
  // flipping the constant to a delay fails here instead of slipping through.
  await openMap(page);
  await page.waitForTimeout(6000);

  await expect(attr(page)).toBeVisible();
});

test('permanent mode survives pan and zoom', async ({ page }) => {
  await seedAttributionDelay(page, null);
  await openMap(page);

  await page.evaluate(() => {
    const map = (window as any).__PB_MAP__;
    map.panBy([60, 0]);
    map.setZoom(15);
  });
  await page.waitForTimeout(300);

  await expect(attr(page)).toBeVisible();
  await expect(attr(page)).toHaveCount(1);
});

test('permanent mode survives immersive mode', async ({ page }) => {
  await seedAttributionDelay(page, null);
  await openMap(page);

  await page.locator('[data-map-fs]').click();
  await expect
    .poll(() => page.evaluate(() => document.getElementById('app')!.classList.contains('pb-immersive')))
    .toBe(true);

  await expect(attr(page)).toBeVisible();
});

// ── Collapse mode (ATTRIBUTION_COLLAPSE_MS = a delay) ─────────────────────────

test('collapse mode: the line is gone once the delay elapses', async ({ page }) => {
  await seedAttributionDelay(page, 250);
  await openMap(page);

  await expect(attr(page)).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.leaflet-control-attribution')).toHaveCount(0);
});

test('collapse mode: it does not reappear on pan or zoom within the same visit', async ({ page }) => {
  await seedAttributionDelay(page, 250);
  await openMap(page);
  await expect(attr(page)).toHaveCount(0, { timeout: 5000 });

  await page.evaluate(() => {
    const map = (window as any).__PB_MAP__;
    map.panBy([60, 0]);
    map.setZoom(15);
  });
  await page.waitForTimeout(300);

  await expect(attr(page)).toHaveCount(0);
});

test('collapse mode: re-entering the tab presents the attribution again', async ({ page }) => {
  // "Collapsed" presupposes something that was shown: each visit is a fresh
  // presentation, which is what the OSM guidelines' initial-presentation clause
  // asks for.
  await seedAttributionDelay(page, 250);
  await openMap(page);
  await expect(attr(page)).toHaveCount(0, { timeout: 5000 });

  await gotoTab(page, 'INFO', 'Note');
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();

  await expect(attr(page)).toBeVisible();
});
