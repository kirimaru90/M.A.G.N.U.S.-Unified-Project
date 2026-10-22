import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, nextFrames, type StubOptions } from './fixtures';

// Covers pipboy-map-tab's declutter: overlapping markers fold into the
// highest-priority one, which carries a +N badge and a "Nelle vicinanze" popup
// line; the badge separates the group; a focused place is never hidden; and a
// second pass hides colliding labels while their icons stay. The priority and
// geometry are unit-tested in map-geometry.spec.ts — this is the live wiring.

const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180;
const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;

/** A top-level pin `northMetres` due north of the origin. */
const pin = (slug: string, type: string, northMetres: number, over: Record<string, unknown> = {}) => ({
  slug,
  name: slug.toUpperCase(),
  type,
  lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
  lng: ORIGIN_LNG,
  hasLocalMap: false,
  isPublic: true,
  parent: null,
  ...over,
});

/** Overlap at z9 (≈1 px apart), clear of each other by z15 (≈84 px). */
const SPREAD = [pin('town', 'settlement', 0), pin('well', 'poi', 300), pin('cave', 'poi', 600)];

/** A few metres apart: overlapping at every zoom up to the maximum. */
const HUDDLE = [pin('town', 'settlement', 0), pin('well', 'poi', 3), pin('cave', 'poi', 6)];

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

async function setView(page: Page, lat: number, lng: number, zoom: number) {
  await page.evaluate(
    ({ lat, lng, zoom }) => (window as any).__PB_MAP__.setView([lat, lng], zoom, { animate: false }),
    { lat, lng, zoom },
  );
  await nextFrames(page);
}

/** Wait out an animated setView (badge tap, focus). */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const map = (window as any).__PB_MAP__;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        map.once('moveend', finish);
        setTimeout(finish, 1200);
      }),
  );
  await nextFrames(page);
}

const markerNames = async (page: Page) =>
  (await page.locator('.pb-map-marker-label').allTextContents()).sort();

const zoomOf = (page: Page) => page.evaluate(() => (window as any).__PB_MAP__.getZoom());

test('overlapping top-level places render one marker, the highest priority, with a +N badge', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: SPREAD } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);

  expect(await markerNames(page)).toEqual(['TOWN']);
  await expect(page.locator('.pb-map-marker--settlement [data-map-badge]')).toHaveText('+2');
  await expect(page.locator('.pb-map-marker--settlement [data-map-badge]')).toBeVisible();
});

test('zooming in releases the absorbed places and drops the badge', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: SPREAD } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
  expect(await markerNames(page)).toEqual(['TOWN']);

  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 15);
  expect(await markerNames(page)).toEqual(['CAVE', 'TOWN', 'WELL']);
  await expect(page.locator('[data-map-badge]:not([hidden])')).toHaveCount(0);
});

test('panning does not change which markers are absorbed', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: SPREAD } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
  const before = await markerNames(page);

  await setView(page, ORIGIN_LAT + 0.6, ORIGIN_LNG + 0.6, 9);
  expect(await markerNames(page)).toEqual(before);
  await expect(page.locator('.pb-map-marker--settlement [data-map-badge]')).toHaveText('+2');
});

test('the absorbing marker\'s popup lists the hidden places under "Nelle vicinanze"', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: HUDDLE } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);

  await page.locator('.pb-map-marker--settlement').click({ position: { x: 6, y: 18 } });
  await settle(page);

  await expect(page.locator('.pb-map-popup-name')).toHaveText('TOWN');
  // Priority order: both pois share a rank and radius, so by name.
  await expect(page.locator('[data-map-near]')).toHaveText('Nelle vicinanze: CAVE, WELL');
});

test('tapping the badge zooms to the least level that separates the group, with no popup', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: SPREAD } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);

  await page.locator('.pb-map-marker--settlement [data-map-badge]').click();
  await settle(page);

  const zoom = await zoomOf(page);
  expect(zoom).toBeGreaterThan(9);
  expect(await markerNames(page)).toEqual(['CAVE', 'TOWN', 'WELL']);
  await expect(page.locator('.pb-map-popup')).toHaveCount(0);

  // The least such level: one step out, the closest pair still collides.
  const closestOneStepOut = await page.evaluate(
    ({ places, z }) => {
      const map = (window as any).__PB_MAP__;
      const pts = places.map((p: { lat: number; lng: number }) => map.project([p.lat, p.lng], z));
      let d = Infinity;
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++)
          d = Math.min(d, Math.max(Math.abs(pts[i].x - pts[j].x), Math.abs(pts[i].y - pts[j].y)));
      return d;
    },
    { places: SPREAD, z: zoom - 1 },
  );
  expect(closestOneStepOut).toBeLessThan(30);
});

test('an inseparable group zooms to the maximum and no further', async ({ page }) => {
  const SAME = [pin('town', 'settlement', 0), pin('twin', 'poi', 0)];
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: SAME } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);

  await page.locator('.pb-map-marker--settlement [data-map-badge]').click();
  await settle(page);

  expect(await zoomOf(page)).toBe(DEFAULT_MAP_CONFIG.maxZoom);
  await expect(page.locator('.pb-map-marker--settlement [data-map-badge]')).toHaveText('+1');
});

test('a searched place that would be absorbed still renders, with its popup open', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: HUDDLE } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
  expect(await markerNames(page)).toEqual(['TOWN']);

  await page.locator('[data-search-lens]').click();
  await page.locator('[data-search-input]').fill('well');
  await page.keyboard.press('Enter');
  await settle(page);

  await expect(page.locator('.pb-map-popup-name')).toHaveText('WELL');
  // The focused poi wins; the settlement is the one treated as colliding.
  expect(await markerNames(page)).toEqual(['WELL']);
  await expect(page.locator('.pb-map-marker--poi [data-map-badge]')).toHaveText('+2');
});

test('closing the focused popup gives priority back', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: HUDDLE } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
  await page.evaluate(() => (window as any).__PB_MAP__.__pbFocus('well'));
  await settle(page);
  expect(await markerNames(page)).toEqual(['WELL']);

  // The popup is bound to its marker, so close it through the marker.
  await page.evaluate(() => {
    const map = (window as any).__PB_MAP__;
    map.eachLayer((layer: any) => layer.isPopupOpen?.() && layer.closePopup());
  });
  await nextFrames(page);
  expect(await markerNames(page)).toEqual(['TOWN']);
});

test('overlapping labels are hidden by priority while both icons remain', async ({ page }) => {
  // 40 px apart east–west at z12: the icons clear each other (≥ 30), the long
  // names do not.
  const pxPerDegLng = (256 * 2 ** 12) / 360;
  const places = [
    pin('alpha', 'landmark', 0, { name: 'ALFA TORRE DI GUARDIA' }),
    pin('beta', 'landmark', 0, { name: 'BETA TORRE DI GUARDIA', lng: ORIGIN_LNG + 40 / pxPerDegLng }),
  ];
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 12);

  await expect(page.locator('.pb-map-marker')).toHaveCount(2);
  await expect(page.locator('.pb-map-marker.is-label-hidden')).toHaveCount(1);
  await expect(page.locator('.pb-map-marker.is-label-hidden .pb-map-marker-label')).toHaveText(
    'BETA TORRE DI GUARDIA',
  );
  await expect(page.locator('.pb-map-marker.is-label-hidden svg')).toBeVisible();
});

test('absorption on zoom-out animates into the absorbing marker', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: SPREAD } });
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 15);
  expect(await markerNames(page)).toEqual(['CAVE', 'TOWN', 'WELL']);

  // Animated zoom-out across the absorption threshold.
  const mid = await page.evaluate(
    () =>
      new Promise<{ transition: string; transform: string }>((resolve) => {
        const map = (window as any).__PB_MAP__;
        map.setView(map.getCenter(), 10, { animate: true });
        setTimeout(() => {
          const inner = document.querySelector('.pb-map-marker--poi .pb-map-marker-inner') as HTMLElement;
          resolve({ transition: inner?.style.transition ?? '', transform: inner?.style.transform ?? '' });
        }, 150);
      }),
  );
  expect(mid.transition).toContain('800ms');
  expect(mid.transform).not.toBe('translate(0px, 0px)');

  await expect(page.locator('.pb-map-marker--poi')).toHaveCount(0, { timeout: 2000 });
  expect(await markerNames(page)).toEqual(['TOWN']);
});
