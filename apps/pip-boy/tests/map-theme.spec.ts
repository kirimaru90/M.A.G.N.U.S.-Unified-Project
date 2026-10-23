import { test, expect, type Page } from '@playwright/test';
import {
  stubEnvironment,
  login,
  makeCharacter,
  DEFAULT_MAP_CONFIG,
  mapTiles,
  nextFrames,
  tintedTilePixel,
  type StubOptions,
} from './fixtures';
import { PHOSPHOR_THEMES } from '../src/shared/map-core/style.js';

// Covers the theme-derived map tokens (pipboy-map-tab, pipboy-settings): the
// basemap tiles are tinted in the phosphor theme's colour, markers
// draw in the theme's bright phosphor colour, and a COLORE change re-tints a
// mounted map without remounting it. Whether the tint *looks* right is a judgment call;
// that it follows the theme is not.

const GREEN = 'rgb(51, 255, 102)';
const BRIGHT = {
  green: 'rgb(170, 255, 192)',
  amber: 'rgb(255, 210, 122)',
  white: 'rgb(255, 255, 255)',
};

const PLACES = [
  {
    slug: 'town',
    name: 'TOWN',
    type: 'settlement',
    lat: 41.9,
    lng: 12.5,
    hasLocalMap: false,
    isPublic: true,
    parent: null,
  },
];

async function openMap(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' }),
    campaignMap: { config: DEFAULT_MAP_CONFIG, places: PLACES },
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.pb-map-marker')).toHaveCount(1);
}

async function chooseColour(page: Page, value: 'green' | 'amber' | 'white') {
  if (!(await page.locator('#pb-settings-popup').isVisible())) {
    await page.locator('#pb-config-knob').click();
  }
  await page.locator(`#pb-settings-popup [data-row="phosphorColor"] [data-value="${value}"]`).click();
  await nextFrames(page);
}

/** Every loaded tile shows `rgb`'s tint, on the same nodes as the last `mapTiles` call. */
async function expectTilesTinted(page: Page, rgb: string) {
  const want = tintedTilePixel(rgb);
  await expect.poll(async () => (await mapTiles(page)).map((t) => t.px)).toEqual(
    (await mapTiles(page)).map(() => want),
  );
}

const markerStroke = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.pb-map-marker svg')!).stroke);

test('switching COLORE re-tints the mounted tiles in place, without remounting', async ({ page }) => {
  await openMap(page);
  await page.evaluate(() => ((window as any).__PB_MAP__.__pbSameMount = true));
  await expect.poll(async () => (await mapTiles(page)).length).toBeGreaterThan(0);
  await expectTilesTinted(page, PHOSPHOR_THEMES.green.rgb);
  const count = (await mapTiles(page)).length;

  for (const colour of ['amber', 'white', 'green'] as const) {
    await chooseColour(page, colour);
    await expectTilesTinted(page, PHOSPHOR_THEMES[colour].rgb);
    // The same canvases, repainted: none rebuilt, none added.
    const tiles = await mapTiles(page);
    expect(tiles).toHaveLength(count);
    expect(tiles.every((t) => t.marked)).toBe(true);
  }

  expect(await page.evaluate(() => (window as any).__PB_MAP__.__pbSameMount)).toBe(true);
});

test('a map mounted after a theme change starts in that theme', async ({ page }) => {
  await openMap(page);
  await chooseColour(page, 'amber');
  await page.locator('.pb-popup-overlay').click({ position: { x: 4, y: 4 } });
  await page.locator('.pb-tab').first().click();
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.pb-map-marker')).toHaveCount(1);
  await expect.poll(async () => (await mapTiles(page)).length).toBeGreaterThan(0);
  for (const tile of await mapTiles(page)) expect(tile.px).toEqual(tintedTilePixel(PHOSPHOR_THEMES.amber.rgb));
});

test('markers draw in the theme bright phosphor colour, recoloured in place', async ({ page }) => {
  await openMap(page);
  const marker = await page.locator('.pb-map-marker').elementHandle();
  expect(await markerStroke(page)).toBe(BRIGHT.green);

  await chooseColour(page, 'amber');
  expect(await markerStroke(page)).toBe(BRIGHT.amber);

  await chooseColour(page, 'white');
  expect(await markerStroke(page)).toBe(BRIGHT.white);

  await chooseColour(page, 'green');
  expect(await markerStroke(page)).toBe(BRIGHT.green);

  // The same element throughout: recoloured, never rebuilt.
  expect(await marker!.evaluate((el) => el.isConnected)).toBe(true);
});

test('labels are a quieter tier than icons', async ({ page }) => {
  await openMap(page);
  const label = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.pb-map-marker-label')!);
    return { color: s.color, opacity: Number(s.opacity), textShadow: s.textShadow };
  });
  expect(label.color).toBe(GREEN);
  expect(label.opacity).toBeLessThan(1);
  // The screen-bg halo, not the glow `.pb-screen *` would force-inherit.
  expect(label.textShadow).toContain('rgb(6, 17, 10)');
  expect(label.textShadow).not.toContain('51, 255, 102');
});

test('the popup keeps the phosphor colour', async ({ page }) => {
  await openMap(page);
  await page.locator('.pb-map-marker').click();
  await expect(page.locator('.pb-map-popup-name')).toBeVisible();

  const colour = await page.evaluate(
    () => getComputedStyle(document.querySelector('.pb-map-canvas .leaflet-popup-content-wrapper')!).color,
  );
  expect(colour).toBe(GREEN);
});
