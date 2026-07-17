import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, type StubOptions } from './fixtures';

// Covers pipboy-map-tab's name search: the lens toggles an autocomplete field
// that matches place names case- and accent-insensitively over the received set,
// and selecting a result focuses that place (revealing it when hidden).

const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180;
const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;

const at = (slug: string, northMetres: number, over: Record<string, unknown> = {}) => ({
  slug,
  name: slug.toUpperCase(),
  type: 'region',
  desc: `Descrizione di ${slug}.`,
  lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
  lng: ORIGIN_LNG,
  hasLocalMap: true,
  isPublic: true,
  parent: null,
  ...over,
});

const PLACES = [
  at('region', 0, { radius: 20_000, name: 'REGION' }),
  at('vault', 500, { radius: 800, parent: 'region', type: 'vault', name: 'VAULT' }),
  at('room', 520, { radius: 60, parent: 'vault', type: 'room', name: 'Stanza Segreta' }),
  at('citta', 3000, { radius: 500, type: 'settlement', name: 'Città Vecchia' }),
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

async function setView(page: Page, lat: number, lng: number, zoom: number) {
  await page.evaluate(
    ({ lat, lng, zoom }) => (window as any).__PB_MAP__.setView([lat, lng], zoom, { animate: false }),
    { lat, lng, zoom },
  );
  await page.waitForTimeout(150);
}

const lens = (page: Page) => page.locator('.pb-map-search-lens');
const input = (page: Page) => page.locator('.pb-map-search-input');
const items = (page: Page) => page.locator('.pb-map-search-item');

test('the lens toggles the search field', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: PLACES } });

  await expect(lens(page)).toBeVisible();
  await expect(input(page)).toBeHidden();

  await lens(page).click();
  await expect(input(page)).toBeVisible();

  await lens(page).click();
  await expect(input(page)).toBeHidden();
});

test('a partial, accent-folded name lists the matching place', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: PLACES } });

  await lens(page).click();
  await input(page).fill('citta');

  await expect(items(page)).toHaveText(['Città Vecchia']);
});

test('selecting a hidden result reveals its marker and opens its popup', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: PLACES } });

  // Zoom 9: only the region renders; "Stanza Segreta" is two closed tiers down.
  await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
  await expect(page.locator('.pb-map-marker--room')).toHaveCount(0);

  await lens(page).click();
  await input(page).fill('stanza');
  await items(page).filter({ hasText: 'Stanza Segreta' }).click();

  // Same end state as tapping the marker: it renders, its popup is open.
  await expect(page.locator('.pb-map-marker--room')).toBeVisible();
  await expect(page.locator('.pb-map-popup-name')).toHaveText('Stanza Segreta');
  // The field is dismissed on selection.
  await expect(input(page)).toBeHidden();
});

test('search cannot surface a place the response omitted', async ({ page }) => {
  // The index is the received set. A non-public place the API stripped server-side
  // is simply not in `places`, so its name can never match — nothing to filter.
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: PLACES } });

  await lens(page).click();
  await input(page).fill('bunker segreto');

  await expect(items(page)).toHaveCount(0);
});

test('Escape closes the field', async ({ page }) => {
  await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: PLACES } });

  await lens(page).click();
  await input(page).fill('citta');
  await expect(input(page)).toBeVisible();

  await input(page).press('Escape');
  await expect(input(page)).toBeHidden();
});
