import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, type StubOptions } from './fixtures';

// Covers pipboy-map-tab: the tab renders, level-of-detail follows viewport
// containment, the breadcrumb tracks the centre, and the map owns horizontal
// gestures.

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

/**
 * Drive the map through Leaflet's own API rather than synthetic wheel events:
 * zoom level is the variable the whole level-of-detail rule turns on, and a
 * wheel gesture cannot land on an exact one. `animate: false` keeps this off the
 * bloom path, which map-tab does not assert (the geometry it depends on is
 * covered in map-geometry.spec.ts).
 */
async function setView(page: Page, lat: number, lng: number, zoom: number) {
  await page.evaluate(
    ({ lat, lng, zoom }) => {
      const map = (window as any).__PB_MAP__;
      map.setView([lat, lng], zoom, { animate: false });
    },
    { lat, lng, zoom },
  );
  await page.waitForTimeout(150);
}

const markerNames = (page: Page) =>
  page.locator('.pb-map-marker-label').allTextContents();

const breadcrumb = (page: Page) => page.locator('[data-map-zone]').innerText();

test('the tab renders a Leaflet container centred on the configured start view', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  // Leaflet mounts *into* the canvas, so the canvas is itself the container —
  // hence the compound selector, which the map styles depend on too.
  await expect(page.locator('.pb-map-canvas.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-tile-pane')).toBeAttached();

  const view = await page.evaluate(() => {
    const map = (window as any).__PB_MAP__;
    const c = map.getCenter();
    return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
  });
  expect(view.zoom).toBe(DEFAULT_MAP_CONFIG.startZoom);
  expect(view.lat).toBeCloseTo(DEFAULT_MAP_CONFIG.startLat, 3);
  expect(view.lng).toBeCloseTo(DEFAULT_MAP_CONFIG.startLng, 3);
});

test('the tile pane carries the Fallout filter and no inherited phosphor glow', async ({ page }) => {
  // The filter's *appearance* is a judgment call no test can make; that it is
  // applied at all is not. `.pb-screen * { text-shadow: inherit }` would
  // otherwise smear the tiles.
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  const pane = await page.evaluate(() => {
    const el = document.querySelector('.leaflet-tile-pane')!;
    const s = getComputedStyle(el);
    return { filter: s.filter, textShadow: s.textShadow };
  });
  expect(pane.filter).toContain('sepia(1)');
  expect(pane.filter).toContain('hue-rotate(90deg)');
  expect(pane.filter).toContain('saturate(8)');
  expect(pane.textShadow).toBe('none');
});

test('zoom is clamped to the configured range', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

  const zooms = await page.evaluate((cfg) => {
    const map = (window as any).__PB_MAP__;
    map.setZoom(cfg.maxZoom + 4);
    const over = map.getZoom();
    map.setZoom(cfg.minZoom - 4);
    return { over, under: map.getZoom() };
  }, DEFAULT_MAP_CONFIG);

  expect(zooms.over).toBeLessThanOrEqual(DEFAULT_MAP_CONFIG.maxZoom);
  expect(zooms.under).toBeGreaterThanOrEqual(DEFAULT_MAP_CONFIG.minZoom);
});

test('a failed map load degrades to an empty map, not a crash', async ({ page }) => {
  await stubEnvironment(page, {
    role: 'player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' }),
  });
  // Override the map route with a failure, after the fixture registered its stub.
  await page.route(/\/campaigns\/[^/]+\/map$/, (route) => route.fulfill({ status: 500, body: '{}' }));
  await login(page);
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();

  // getCampaignMap swallows the error and yields EMPTY_MAP, so the tab still mounts.
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.pb-map-marker')).toHaveCount(0);
  // The sheet stays usable.
  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await expect(page.locator('.pb-tab.active')).toHaveText('DADI');
});

test('the tab renders exactly what the API sends and filters nothing itself', async ({ page }) => {
  // The spec is explicit: the API returns only what the caller may see and the
  // client renders what it receives. Handing it a place no real API would send
  // to a player proves the client is not doing the filtering — the cascade is a
  // server-side boundary, asserted in the API's campaign-map.e2e-spec.ts.
  await openMap(page, {
    campaignMap: {
      config: DEFAULT_MAP_CONFIG,
      places: [at('surface', 0, { radius: 5000, isPublic: true })],
    },
  });
  await expect(page.locator('.pb-map-marker')).toHaveCount(1);
});

test.describe('level of detail', () => {
  test('zooming into a zone reveals its children and the breadcrumb names it', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

    // Far out: only the region's marker, and no chain — nothing is open.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
    expect(await markerNames(page)).toEqual(['REGION']);
    expect(await breadcrumb(page)).toContain('Terre contaminate');

    // Zoomed in over the region: it opens, its own marker gives way to the vault.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    const names = await markerNames(page);
    expect(names).toContain('VAULT');
    expect(names).not.toContain('REGION');
    expect(await breadcrumb(page)).toContain('REGION');
  });

  test('an open place does not render its own marker', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    expect(await markerNames(page)).not.toContain('REGION');
  });

  test('panning off-centre keeps children rendered and only changes the breadcrumb', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    const before = await markerNames(page);
    expect(before).toContain('VAULT');
    expect(await breadcrumb(page)).toContain('REGION');

    // Same zoom, centre moved far outside the region. APERTA depends on zoom
    // only, so the markers must not change; DENTRO depends on the centre, so the
    // breadcrumb must.
    await setView(page, ORIGIN_LAT + 1.5, ORIGIN_LNG, 14);
    expect(await markerNames(page)).toEqual(before);
    expect(await breadcrumb(page)).toContain('Terre contaminate');
  });

  test('a place with no local map never opens, however far you zoom', async ({ page }) => {
    await openMap(page, {
      campaignMap: {
        config: DEFAULT_MAP_CONFIG,
        places: [
          at('pin', 0, { hasLocalMap: false, type: 'poi' }),
          at('ghost', 5, { parent: 'pin', type: 'room' }),
        ],
      },
    });
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 18);
    const names = await markerNames(page);
    expect(names).toContain('PIN');
    expect(names).not.toContain('GHOST');
  });
});

test.describe('breadcrumb', () => {
  // Five tiers (A›B›C›D each open, E a leaf pin) so the chain of open places is
  // four deep — one more than the cap.
  const DEEP_PLACES = [
    at('a', 0, { radius: 20_000, name: 'A' }),
    at('b', 10, { radius: 6_000, parent: 'a', name: 'B' }),
    at('c', 20, { radius: 2_000, parent: 'b', name: 'C' }),
    at('d', 30, { radius: 800, parent: 'c', name: 'D' }),
    at('e', 40, { hasLocalMap: false, parent: 'd', type: 'poi', name: 'E' }),
  ];

  test('reads the root label when inside no open place', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
    expect(await breadcrumb(page)).toBe('Terre contaminate');
  });

  test('a chain deeper than three shows the last three led by an elision marker', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: DEEP_PLACES } });

    // Centred deep inside D at high zoom: A, B, C and D are all open.
    const d = DEEP_PLACES[3];
    await setView(page, d.lat, d.lng, 18);

    const text = await breadcrumb(page);
    expect(text).toBe('… › B › C › D');
    // The root label is never shown beside a named level.
    expect(text).not.toContain('Terre contaminate');
    // A, the elided ancestor, is not among the three shown.
    expect(text).not.toContain('A ›');
  });
});

test.describe('icons', () => {
  test("a place with no icon of its own renders its type's default", async ({ page }) => {
    await openMap(page, {
      campaignMap: { config: DEFAULT_MAP_CONFIG, places: [at('v', 0, { type: 'vault' })] },
    });
    await expect(page.locator('.pb-map-marker--vault svg')).toBeVisible();
  });

  test('an unknown icon key falls back rather than rendering nothing', async ({ page }) => {
    await openMap(page, {
      campaignMap: {
        config: DEFAULT_MAP_CONFIG,
        places: [at('v', 0, { type: 'vault', icon: 'not-a-real-icon' })],
      },
    });
    await expect(page.locator('.pb-map-marker svg')).toBeVisible();
  });
});

test('a horizontal drag over the map pans instead of changing tab', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
  await expect(page.locator('.pb-tab.active')).toHaveText('MAPPA');

  // The same gesture that navigates on every other tab — well past the 60px
  // threshold and clearly horizontal.
  await page.evaluate(() => {
    const canvas = document.querySelector('[data-map-canvas]')!;
    const content = document.querySelector('#pb-sheet-content')!;
    const rect = canvas.getBoundingClientRect();
    const x0 = rect.left + rect.width / 2;
    const y0 = rect.top + rect.height / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x0, clientY: y0, bubbles: true }));
    content.dispatchEvent(new PointerEvent('pointerup', { clientX: x0 - 200, clientY: y0, bubbles: true }));
  });

  await expect(page.locator('.pb-tab.active')).toHaveText('MAPPA');
});

test('the tab bar still navigates away from the map', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
  await page.locator('.pb-tab', { hasText: 'NOTES' }).click();
  await expect(page.locator('.pb-tab.active')).toHaveText('NOTES');
});
