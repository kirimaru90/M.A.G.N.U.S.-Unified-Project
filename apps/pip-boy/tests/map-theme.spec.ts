import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, nextFrames, type StubOptions } from './fixtures';

// Covers the theme-derived map tokens (pipboy-map-tab, pipboy-settings): the
// basemap is tinted by an SVG filter generated from the phosphor theme, markers
// take the contrasting colour, and a COLORE change re-tints a mounted map
// without remounting it. Whether the tint *looks* right is a judgment call;
// that it follows the theme is not.

const GREEN = 'rgb(51, 255, 102)';
const AMBER = 'rgb(255, 176, 46)';

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

const tintValues = (page: Page) =>
  page.evaluate(() => document.querySelector('#pb-phosphor-tint feColorMatrix')?.getAttribute('values') ?? null);

/** The matrix's red-, green- and blue-row sums: the theme colour × gain / 255. */
const tintRowSums = async (page: Page) => {
  const values = (await tintValues(page))!.trim().split(/\s+/).map(Number);
  return [0, 1, 2].map((row) => values.slice(row * 5, row * 5 + 3).reduce((a, b) => a + b, 0));
};

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
});

test('switching VERDE → AMBRA re-tints the mounted map without remounting it', async ({ page }) => {
  await openMap(page);
  await page.evaluate(() => ((window as any).__PB_MAP__.__pbSameMount = true));

  // Green dominates the green tint.
  const [r0, g0, b0] = await tintRowSums(page);
  expect(g0).toBeGreaterThan(r0);
  expect(g0).toBeGreaterThan(b0);
  const before = await tintValues(page);

  await chooseColour(page, 'amber');

  expect(await tintValues(page)).not.toBe(before);
  // Amber: red ≥ green > blue, in the theme triplet's proportions.
  const [r1, g1, b1] = await tintRowSums(page);
  expect(r1).toBeGreaterThan(g1);
  expect(g1).toBeGreaterThan(b1);
  expect(g1 / r1).toBeCloseTo(176 / 255, 2);

  expect(await page.evaluate(() => (window as any).__PB_MAP__.__pbSameMount)).toBe(true);
});

test('markers are amber on VERDE and green on AMBRA and BIANCO', async ({ page }) => {
  await openMap(page);
  expect(await markerStroke(page)).toBe(AMBER);

  await chooseColour(page, 'amber');
  expect(await markerStroke(page)).toBe(GREEN);

  await chooseColour(page, 'white');
  expect(await markerStroke(page)).toBe(GREEN);

  await chooseColour(page, 'green');
  expect(await markerStroke(page)).toBe(AMBER);
});

test('the popup keeps the phosphor colour, not the marker colour', async ({ page }) => {
  await openMap(page);
  await page.locator('.pb-map-marker').click();
  await expect(page.locator('.pb-map-popup-name')).toBeVisible();

  const colour = await page.evaluate(
    () => getComputedStyle(document.querySelector('.pb-map-canvas .leaflet-popup-content-wrapper')!).color,
  );
  expect(colour).toBe(GREEN);
});
