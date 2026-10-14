import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

// The CARTO basemap key. The Dockerfile stamps CARTO_BASEMAP_KEY into
// src/tabs/basemap.js; the suite runs the unstamped source, so the keyed branch
// is exercised through the __PB_CARTO_KEY__ test override instead. Tiles are
// still fulfilled locally by the fixtures — nothing reaches CARTO.

async function openMapCollectingTiles(page: Page): Promise<string[]> {
  const tiles: string[] = [];
  page.on('request', (req) => {
    if (/basemaps\.cartocdn\.com/.test(req.url())) tiles.push(req.url());
  });
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
  await expect.poll(() => tiles.length).toBeGreaterThan(0);
  return tiles;
}

test('with a key, every tile request carries it', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__PB_CARTO_KEY__ = 'test-key-123';
  });
  const tiles = await openMapCollectingTiles(page);

  for (const url of tiles) {
    expect(new URL(url).searchParams.get('key')).toBe('test-key-123');
  }
});

test('the unstamped source sends no key and no placeholder', async ({ page }) => {
  const tiles = await openMapCollectingTiles(page);

  for (const url of tiles) {
    expect(new URL(url).searchParams.has('key')).toBe(false);
    expect(url).not.toContain('CARTO_BASEMAP_KEY');
  }
});

test('an empty stamp is treated as no key', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__PB_CARTO_KEY__ = '';
  });
  const tiles = await openMapCollectingTiles(page);

  for (const url of tiles) expect(new URL(url).searchParams.has('key')).toBe(false);
});
