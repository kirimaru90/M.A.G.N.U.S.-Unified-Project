import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, gotoTab, DEFAULT_MAP_CONFIG, type StubOptions } from './fixtures';

// The two-way link between the codex and the map (pipboy-map-tab,
// pipboy-sheet-navigation): the map popup's CODEX for a linked entry the
// character sees, and the one-shot intents a cross-tab jump carries.

const M_PER_DEG_LAT = (6_371_008.8 * Math.PI) / 180;
const ORIGIN_LAT = 41.9;
const ORIGIN_LNG = 12.5;

const pin = (slug: string, name: string, northMetres: number, over: Record<string, unknown> = {}) => ({
  slug,
  name,
  type: 'settlement',
  lat: ORIGIN_LAT + northMetres / M_PER_DEG_LAT,
  lng: ORIGIN_LNG,
  hasLocalMap: false,
  isPublic: true,
  parent: null,
  ...over,
});

const PLACES = [
  pin('dc', 'Diamond City', 0, { codexEntryId: 'e-dc' }),
  pin('institute', 'Institute', 400, { codexEntryId: 'e-hidden' }),
  pin('concord', 'Concord', -400),
  // A region holding Vault 111: the focus has to open it to show the vault.
  pin('commonwealth', 'Commonwealth', 2000, { type: 'region', hasLocalMap: true, radius: 20_000 }),
  pin('vault-111', 'Vault 111', 2500, { type: 'vault', hasLocalMap: true, radius: 300, parent: 'commonwealth' }),
];

const CODEX = [
  {
    id: 'e-dc', type: 'luogo', name: 'Diamond City', description: 'La Gemma Verde.', imageUrl: null,
    isPublic: true, isEditable: false, isOwn: false, mapPlaceSlug: 'dc',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'e-vault', type: 'luogo', name: 'Vault 111', description: null, imageUrl: null,
    isPublic: true, isEditable: false, isOwn: false, mapPlaceSlug: 'vault-111',
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
  },
];

async function openSheet(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' }),
    campaignMap: { config: { ...DEFAULT_MAP_CONFIG, startZoom: 14 }, places: PLACES },
    codex: CODEX,
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

async function openMap(page: Page) {
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
}

const marker = (page: Page, name: string) =>
  page.locator('.pb-map-marker', { has: page.locator('.pb-map-marker-label', { hasText: name }) });

test('a linked entry the character sees offers CODEX, which opens its detail', async ({ page }) => {
  await openSheet(page);
  await openMap(page);
  await marker(page, 'Diamond City').click();
  await expect(page.locator('.pb-map-popup-name')).toHaveText('Diamond City');
  await page.locator('[data-map-codex]').click();

  await expect(page.locator('.pb-tab.active')).toHaveText('INFO');
  await expect(page.locator('.pb-subtab.active')).toHaveText('Codex');
  await expect(page.locator('[data-codex-name]')).toHaveText('Diamond City');

  // ◀ returns to the codex list, not the map.
  await page.locator('[data-codex-back]').click();
  await expect(page.locator('[data-codex-group-toggle="luogo"]')).toBeVisible();
});

test('a link to a hidden entry, or no link, offers no CODEX', async ({ page }) => {
  await openSheet(page);
  await openMap(page);
  await marker(page, 'Institute').click();
  await expect(page.locator('.pb-map-popup-name')).toHaveText('Institute');
  await expect(page.locator('[data-map-codex]')).toHaveCount(0);

  await marker(page, 'Concord').click();
  await expect(page.locator('.pb-map-popup-name').last()).toHaveText('Concord');
  await expect(page.locator('[data-map-codex]')).toHaveCount(0);
});

test('a failed codex read leaves the map working, without CODEX', async ({ page }) => {
  await openSheet(page, { codex: 500 });
  await openMap(page);
  await marker(page, 'Diamond City').click();
  await expect(page.locator('.pb-map-popup-name')).toHaveText('Diamond City');
  await expect(page.locator('[data-map-codex]')).toHaveCount(0);
});

test('MAPPA focuses a place nested in a zone, with its popup, once', async ({ page }) => {
  await openSheet(page);
  await gotoTab(page, 'INFO', 'Codex');
  await page.locator('[data-codex-group-toggle="luogo"]').click();
  await page.locator('[data-codex-id="e-vault"]').click();
  await page.locator('[data-codex-map]').click();

  await expect(page.locator('.pb-tab.active')).toHaveText('MAPPA');
  await expect(page.locator('.pb-map-popup-name')).toHaveText('Vault 111');
  await expect(marker(page, 'Vault 111')).toBeVisible();

  // An ordinary return to MAPPA receives no intent: no popup reopens.
  await gotoTab(page, 'INFO', 'Note');
  await openMap(page);
  await page.waitForTimeout(400);
  await expect(page.locator('.leaflet-popup')).toHaveCount(0);
});

test('a jump to the codex remembers Codex as the INFO subtab', async ({ page }) => {
  await openSheet(page);
  await gotoTab(page, 'INFO', 'Note');
  await openMap(page);
  await marker(page, 'Diamond City').click();
  await page.locator('[data-map-codex]').click();
  await expect(page.locator('.pb-subtab.active')).toHaveText('Codex');

  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-tab', { hasText: 'INFO' }).click();
  await expect(page.locator('.pb-subtab.active')).toHaveText('Codex');
});
