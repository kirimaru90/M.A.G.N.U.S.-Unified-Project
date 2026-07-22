import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, type StubOptions } from './fixtures';

// Covers pipboy-map-tab's immersive (full-screen) mode: the toggle expands the
// map to fill the CRT screen and hides the sheet chrome, an explicit exit
// (toggle + Escape) replaces the hidden tab bar, the mode is ephemeral (resets on
// re-open), the breadcrumb survives as an overlay, and the level of detail is
// revalidated against the resized canvas.

const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180;
const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;

const at = (slug: string, northMetres: number, over: Record<string, unknown> = {}) => ({
  slug,
  name: slug.toUpperCase(),
  type: 'region',
  lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
  lng: ORIGIN_LNG,
  hasLocalMap: true,
  isPublic: true,
  parent: null,
  ...over,
});

/** A region containing a vault containing a room — three tiers to open. */
const NESTED_PLACES = [
  at('region', 0, { radius: 20_000 }),
  at('vault', 500, { radius: 800, parent: 'region', type: 'vault' }),
  at('room', 520, { radius: 60, parent: 'vault', type: 'room' }),
];

/**
 * A deep nested chain of concentric zones, radii spaced by a constant factor so
 * that *any* enlargement of the viewport (and therefore of `vr`) crosses at least
 * one radius boundary — which flips exactly which zone marker is visible. This is
 * what makes the level-of-detail revalidation observable without predicting the
 * exact canvas pixel sizes: the boundary zone is the largest whose radius is
 * below the current `vr`, and it moves outward when the canvas grows.
 */
function nestedChain() {
  const places: Array<Record<string, unknown>> = [];
  let radius = 40_000;
  let parent: string | null = null;
  for (let i = 0; i < 14; i += 1) {
    const slug = `z${String(i).padStart(2, '0')}`;
    places.push(at(slug, i, { radius, parent, type: 'vault', name: slug.toUpperCase() }));
    parent = slug;
    radius = Math.round(radius / 1.35);
  }
  // A leaf pin at the centre so the deepest zone is itself openable.
  places.push(at('pin', 0, { hasLocalMap: false, type: 'poi', parent, name: 'PIN' }));
  return places;
}

/** Override the revalidation timeout so the spec need not wait it out. */
async function seedImmersiveDelay(page: Page, ms: number) {
  await page.addInitScript((value: number) => {
    (window as unknown as Record<string, unknown>).__PB_MAP_IMMERSIVE_MS__ = value;
  }, ms);
}

async function openMap(page: Page, opts: StubOptions = {}) {
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
}

const fsToggle = (page: Page) => page.locator('[data-map-fs]');
const tabs = (page: Page) => page.locator('.pb-tabs');
const isImmersive = (page: Page) =>
  page.evaluate(() => document.getElementById('app')!.classList.contains('pb-immersive'));

async function setView(page: Page, lat: number, lng: number, zoom: number) {
  await page.evaluate(
    ({ lat, lng, zoom }) => (window as any).__PB_MAP__.setView([lat, lng], zoom, { animate: false }),
    { lat, lng, zoom },
  );
  await page.waitForTimeout(150);
}

async function enter(page: Page) {
  await fsToggle(page).click();
  await page.waitForTimeout(80); // let the revalidation timeout fire
  await expect.poll(() => isImmersive(page)).toBe(true);
}

test('the toggle expands the map and hides the sheet chrome, keeping bezel + CRT overlays', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  // Normal mode: the chrome is present.
  await expect(page.locator('.pb-header')).toBeVisible();
  await expect(tabs(page)).toBeVisible();
  await expect(page.locator('.pb-footer')).toBeVisible();

  const screenBox = (await page.locator('#pb-screen').boundingBox())!;

  await enter(page);

  // The PA header, both tab rows, the resource band and the footer are hidden.
  await expect(page.locator('.pb-header')).toBeHidden();
  await expect(tabs(page)).toBeHidden();
  await expect(page.locator('.pb-subtabs')).toBeHidden();
  await expect(page.locator('.pb-resource-band')).toBeHidden();
  await expect(page.locator('.pb-footer')).toBeHidden();

  // The breadcrumb is an overlay, not a reserved layout row.
  await expect(page.locator('[data-map-zone]')).toHaveCSS('position', 'absolute');

  // The canvas now fills essentially the whole screen (inside the bezel).
  const canvasBox = (await page.locator('.pb-map-canvas').boundingBox())!;
  expect(canvasBox.height).toBeGreaterThan(screenBox.height * 0.9);

  // The bezel and the CRT overlays still render above the enlarged canvas.
  await expect(page.locator('.pb-bezel')).toBeVisible();
  await expect(page.locator('.pb-scanline-texture')).toBeAttached();
  await expect(page.locator('.pb-vignette')).toBeAttached();
});

test('exit via the toggle restores the normal chrome, including the tab bar', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  await enter(page);
  await expect(tabs(page)).toBeHidden();

  await fsToggle(page).click();
  await expect.poll(() => isImmersive(page)).toBe(false);
  await expect(tabs(page)).toBeVisible();
  await expect(page.locator('.pb-header')).toBeVisible();
  await expect(page.locator('.pb-footer')).toBeVisible();

  // The tab bar navigates away again as usual.
  await page.locator('.pb-tab', { hasText: 'NOTES' }).click();
  await expect(page.locator('.pb-tab.active')).toHaveText('NOTES');
});

test('Escape exits immersive and restores the chrome', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  await enter(page);
  await expect(tabs(page)).toBeHidden();

  await page.keyboard.press('Escape');
  await expect.poll(() => isImmersive(page)).toBe(false);
  await expect(tabs(page)).toBeVisible();
});

test('Escape with the search box open collapses search instead of exiting immersive', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  await enter(page);

  // Open the search box; its input takes focus.
  await page.locator('.pb-map-search-lens').click();
  await expect(page.locator('.pb-map-search-input')).toBeVisible();

  // First Escape: the search box's own handler collapses it and stops the event,
  // so immersive is untouched.
  await page.keyboard.press('Escape');
  await expect(page.locator('.pb-map-search-input')).toBeHidden();
  expect(await isImmersive(page)).toBe(true);
  await expect(tabs(page)).toBeHidden();

  // Second Escape, search now closed: immersive exits.
  await page.keyboard.press('Escape');
  await expect.poll(() => isImmersive(page)).toBe(false);
  await expect(tabs(page)).toBeVisible();
});

test('immersive resets to off when the sheet is re-opened', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  await enter(page);
  expect(await isImmersive(page)).toBe(true);

  // The statusbar stays visible in immersive, so DOSSIER is reachable — leaving
  // the sheet and re-opening it must land in normal mode.
  await page.locator('#pb-nav-back').click();
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await page.locator('#pb-sheet-header').waitFor();

  expect(await isImmersive(page)).toBe(false);
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(await isImmersive(page)).toBe(false);
  await expect(tabs(page)).toBeVisible();
});

test('the breadcrumb overlay is visible in immersive and a pan beneath it reaches the map', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  // Enter a chain so the breadcrumb names it.
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
  await expect(page.locator('[data-map-zone]')).toContainText('REGION');

  await enter(page);

  const zone = page.locator('[data-map-zone]');
  await expect(zone).toBeVisible();
  await expect(zone).toContainText('REGION');

  // pointer-events: none — what is under the breadcrumb is the map, not the label.
  const box = (await zone.boundingBox())!;
  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return {
        isZone: !!el?.closest('[data-map-zone]'),
        reachesMap: !!el?.closest('.leaflet-container'),
      };
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hit.isZone).toBe(false);
  expect(hit.reachesMap).toBe(true);
});

test.describe('level of detail is revalidated on toggle', () => {
  // A controlled landscape viewport so the canvas's shorter side is its height in
  // both modes — hiding the chrome then grows `vr`, which is the whole point.
  test.use({ viewport: { width: 900, height: 520 } });

  const zoneMarkers = async (page: Page) => {
    const names = await page.locator('.pb-map-marker-label').allTextContents();
    return names.filter((n) => n !== 'PIN').sort();
  };

  test('toggling immersive enlarges the canvas, re-measures Leaflet, and re-syncs the visible markers', async ({ page }) => {
    await seedImmersiveDelay(page, 10);
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: nestedChain() } });

    // A mid zoom, so the open/closed boundary sits inside the chain of radii and
    // exactly one zone marker is visible.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 13);
    const before = await zoneMarkers(page);
    expect(before.length).toBeGreaterThan(0);

    const sizeBefore = await page.evaluate(() => {
      const s = (window as any).__PB_MAP__.getSize();
      return { x: s.x, y: s.y };
    });

    await enter(page);

    const sizeAfter = await page.evaluate(() => {
      const s = (window as any).__PB_MAP__.getSize();
      return { x: s.x, y: s.y };
    });

    // getSize changed: the canvas grew taller in immersive.
    expect(sizeAfter.y).toBeGreaterThan(sizeBefore.y);

    // invalidateSize ran — Leaflet's reported size matches the live canvas box,
    // so there is no stale/off-centre view.
    const stale = await page.evaluate(() => {
      const map = (window as any).__PB_MAP__;
      const s = map.getSize();
      const el = map.getContainer();
      return { mapX: s.x, mapY: s.y, elX: el.clientWidth, elY: el.clientHeight };
    });
    expect(Math.abs(stale.mapX - stale.elX)).toBeLessThanOrEqual(1);
    expect(Math.abs(stale.mapY - stale.elY)).toBeLessThanOrEqual(1);

    // The larger viewport radius closes a tighter zone, so the visible marker set
    // is re-synced to a coarser level of detail.
    const after = await zoneMarkers(page);
    expect(after.length).toBeGreaterThan(0);
    expect(after).not.toEqual(before);

    // Leaving restores the finer level of detail.
    await fsToggle(page).click();
    await page.waitForTimeout(80);
    await expect.poll(() => isImmersive(page)).toBe(false);
    expect(await zoneMarkers(page)).toEqual(before);
  });
});
