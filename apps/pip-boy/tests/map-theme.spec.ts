import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, nextFrames, type StubOptions } from './fixtures';

// Covers the theme-derived map tokens (pipboy-map-tab, pipboy-settings): the
// basemap is tinted by an SVG filter generated from the phosphor theme, markers
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

/** The last feColorMatrix is the tint: its diagonal is the desaturated theme colour. */
const tintDiagonal = (page: Page) =>
  page.evaluate(() => {
    const matrices = document.querySelectorAll('#pb-phosphor-tint feColorMatrix');
    const values = matrices[matrices.length - 1]?.getAttribute('values') ?? '';
    const v = values.trim().split(/\s+/).map(Number);
    return [v[0], v[6], v[12]];
  });

const markerStroke = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.pb-map-marker svg')!).stroke);

test('the tile pane references the phosphor tint filter, and the filter exists', async ({ page }) => {
  await openMap(page);

  const pane = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.leaflet-tile-pane')!);
    return { filter: s.filter, textShadow: s.textShadow };
  });
  expect(pane.filter).toContain('url(');
  expect(pane.filter).toContain('#pb-phosphor-tint');
  expect(pane.textShadow).toBe('none');

  const filter = await page.evaluate(() => {
    const el = document.getElementById('pb-phosphor-tint');
    return el && { tag: el.tagName.toLowerCase(), space: el.getAttribute('color-interpolation-filters') };
  });
  expect(filter).toEqual({ tag: 'filter', space: 'sRGB' });

  // The tone curve and the water mask, not a single linear gain.
  const primitives = await page.evaluate(() =>
    [...document.getElementById('pb-phosphor-tint')!.children].map((el) => el.tagName),
  );
  expect(primitives).toContain('feComponentTransfer');
  expect(primitives).toContain('feFlood');
  expect(primitives).toContain('feMerge');
});

test('switching VERDE → AMBRA re-tints the mounted map without remounting it', async ({ page }) => {
  await openMap(page);
  await page.evaluate(() => ((window as any).__PB_MAP__.__pbSameMount = true));

  // Green dominates the green tint.
  const [r0, g0, b0] = await tintDiagonal(page);
  expect(g0).toBeGreaterThan(r0);
  expect(g0).toBeGreaterThan(b0);

  await chooseColour(page, 'amber');

  // Amber: red > green > blue.
  const [r1, g1, b1] = await tintDiagonal(page);
  expect(r1).toBeGreaterThan(g1);
  expect(g1).toBeGreaterThan(b1);

  expect(await page.evaluate(() => (window as any).__PB_MAP__.__pbSameMount)).toBe(true);
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
