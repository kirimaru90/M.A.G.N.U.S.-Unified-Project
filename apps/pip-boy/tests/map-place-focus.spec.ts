import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, DEFAULT_MAP_CONFIG, type StubOptions } from './fixtures';

// Covers pipboy-map-tab's place-focus behaviour: a marker tap centres the place
// and opens a description popup; the popup carries Vedi mappa for a place with an
// interior and opens it; the focus primitive reveals a hidden place. Driven
// through the published `__PB_MAP__` seam so zoom lands on exact levels.

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

/** Drive zoom/centre through Leaflet's own API — see map-tab.spec.ts. */
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

/**
 * A marker tap / focus runs an *animated* setView, so the centre keeps moving
 * after the popup has already opened. Wait for the map to stop before reading it.
 */
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
        // The animation may already have ended before this listener attached.
        setTimeout(finish, 800);
      }),
  );
}

const centre = (page: Page) =>
  page.evaluate(() => {
    const c = (window as any).__PB_MAP__.getCenter();
    return { lat: c.lat, lng: c.lng };
  });

const markerNames = (page: Page) =>
  page.locator('.pb-map-marker-label').allTextContents();

const vault = NESTED_PLACES[1];
const room = NESTED_PLACES[2];

test.describe('marker popup', () => {
  test('tapping a marker centres its place and shows a name + description popup', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
    // Zoom 14: the region is open, so the vault's marker renders.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);

    await page.locator('.pb-map-marker--vault').click();

    await expect(page.locator('.pb-map-popup-name')).toHaveText('VAULT');
    await expect(page.locator('.pb-map-popup-desc')).toHaveText('Descrizione di vault.');
    // The centre moved onto the vault (500 m north of where we tapped).
    await settle(page);
    const c = await centre(page);
    expect(c.lat).toBeCloseTo(vault.lat, 3);
    expect(c.lng).toBeCloseTo(vault.lng, 3);
  });

  test('the popup closes when its place is zoomed open and its marker removed', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    await page.locator('.pb-map-marker--vault').click();
    await expect(page.locator('.pb-map-popup-name')).toHaveText('VAULT');
    await settle(page);

    // Zoom in until the vault is APERTA: its marker is removed, so its popup goes.
    await setView(page, vault.lat, vault.lng, 18);
    expect(await markerNames(page)).not.toContain('VAULT');
    await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  });

  test('the popup closes when its place is panned out of view', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    await page.locator('.pb-map-marker--vault').click();
    await expect(page.locator('.pb-map-popup-name')).toHaveText('VAULT');
    await settle(page);

    // Same zoom (the vault's marker survives — APERTA is zoom-only), centre far
    // away so the vault leaves the viewport.
    await setView(page, ORIGIN_LAT + 1.5, ORIGIN_LNG, 14);
    expect(await markerNames(page)).toContain('VAULT');
    await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  });
});

test.describe('Vedi mappa', () => {
  test('a place with a local map offers the action and a leaf does not', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

    // The vault has an interior (hasLocalMap + a child room): the action shows.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    await page.locator('.pb-map-marker--vault').click();
    await expect(page.locator('.pb-map-popup-open')).toHaveText('Vedi mappa');
    await settle(page);

    // The room is a leaf (no children): no action.
    await setView(page, vault.lat, vault.lng, 18);
    await page.locator('.pb-map-marker--room').click();
    await expect(page.locator('.pb-map-popup-name')).toHaveText('ROOM');
    await expect(page.locator('.pb-map-popup-open')).toHaveCount(0);
  });

  test('activating Vedi mappa opens the interior and the popup is gone afterward', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    await page.locator('.pb-map-marker--vault').click();
    await expect(page.locator('.pb-map-popup-open')).toBeVisible();

    await page.locator('.pb-map-popup-open').click();

    // The vault becomes APERTA: its child room renders, its own marker (and its
    // popup) leaves the set.
    await expect(page.locator('.pb-map-marker--room')).toBeVisible();
    await expect(page.locator('.pb-map-marker--vault')).toHaveCount(0);
    await expect(page.locator('.leaflet-popup')).toHaveCount(0);
  });
});

test.describe('focus primitive', () => {
  test('focusing a hidden place moves the view until its marker renders and opens its popup', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

    // Zoom 9: only the region renders; the room is hidden inside two closed tiers.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 9);
    expect(await markerNames(page)).toEqual(['REGION']);

    await page.evaluate(() => (window as any).__PB_MAP__.__pbFocus('room'));

    await expect(page.locator('.pb-map-marker--room')).toBeVisible();
    await expect(page.locator('.pb-map-popup-name')).toHaveText('ROOM');
    await settle(page);
    const c = await centre(page);
    expect(c.lat).toBeCloseTo(room.lat, 3);
    expect(c.lng).toBeCloseTo(room.lng, 3);
  });

  test('focusing a visible place reaches the same state as tapping its marker', async ({ page }) => {
    await openMap(page, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: NESTED_PLACES } });

    // Tap the visible vault marker.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    await page.locator('.pb-map-marker--vault').click();
    await expect(page.locator('.pb-map-popup-name')).toHaveText('VAULT');
    await settle(page);
    const tapped = await centre(page);

    // Focus the same vault through the primitive, from a different starting centre.
    await setView(page, ORIGIN_LAT, ORIGIN_LNG, 14);
    await page.evaluate(() => (window as any).__PB_MAP__.__pbFocus('vault'));
    await expect(page.locator('.pb-map-popup-name')).toHaveText('VAULT');
    await settle(page);
    const focused = await centre(page);

    expect(focused.lat).toBeCloseTo(tapped.lat, 6);
    expect(focused.lng).toBeCloseTo(tapped.lng, 6);
  });
});
