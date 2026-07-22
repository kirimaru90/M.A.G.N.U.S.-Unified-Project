import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, seedPrefs } from './fixtures';

// Covers the pipboy-settings delta: CREDITI as an action below the five
// preference rows.
//
// The other half of the basemap licence obligation lives here. The map collapses
// its attribution after five seconds, which the OSM guidelines allow only if the
// licence information stays findable — "an 'About' option in a menu". This is
// that option.

async function openSettings(page: Page) {
  await stubEnvironment(page, {
    role: 'player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' }),
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('#pb-config-knob').click();
  await expect(page.locator('#pb-settings-popup')).toBeVisible();
}

test('CREDITI renders below the five preference rows', async ({ page }) => {
  await openSettings(page);

  // Still exactly five rows: CREDITI is an action, not a sixth pick-one row.
  await expect(page.locator('.pb-settings-row')).toHaveCount(5);

  const action = page.locator('[data-credits]');
  await expect(action).toBeVisible();
  await expect(action).toHaveText('CREDITI');

  // Below them, in document order.
  const isAfter = await page.evaluate(() => {
    const rows = document.querySelectorAll('.pb-settings-row');
    const last = rows[rows.length - 1];
    const credits = document.querySelector('[data-credits]')!;
    return !!(last.compareDocumentPosition(credits) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(isAfter).toBe(true);
});

test('CREDITI is not one of the pick-one preference controls', async ({ page }) => {
  await openSettings(page);
  const insideRow = await page.evaluate(
    () => !!document.querySelector('[data-credits]')!.closest('.pb-settings-row'),
  );
  expect(insideRow).toBe(false);
});

test('activating it names OpenStreetMap, CARTO, and the vendored map library', async ({ page }) => {
  await openSettings(page);
  await page.locator('[data-credits]').click();

  const credits = page.locator('#pb-credits-popup');
  await expect(credits).toBeVisible();
  await expect(credits).toContainText('OpenStreetMap');
  await expect(credits).toContainText('CARTO');
  // Named because the app suppresses Leaflet's own on-screen prefix, so this is
  // the only place it is acknowledged.
  await expect(credits).toContainText('Leaflet');
});

test('activating it changes no preference and persists nothing', async ({ page }) => {
  await seedPrefs(page, { orientation: 'portrait', vibration: true, wakeLock: false });
  await openSettings(page);

  const before = await page.evaluate(() => window.localStorage.getItem('pipboy:prefs'));

  await page.locator('[data-credits]').click();
  await expect(page.locator('#pb-credits-popup')).toBeVisible();

  const after = await page.evaluate(() => window.localStorage.getItem('pipboy:prefs'));
  expect(after).toBe(before);
});

test('dismissing it returns to the settings popup with nothing changed', async ({ page }) => {
  await seedPrefs(page, { orientation: 'portrait', vibration: true, wakeLock: false });
  await openSettings(page);
  const before = await page.evaluate(() => window.localStorage.getItem('pipboy:prefs'));

  await page.locator('[data-credits]').click();
  await page.locator('#pb-credits-popup [data-close]').click();

  await expect(page.locator('#pb-credits-popup')).toHaveCount(0);
  await expect(page.locator('#pb-settings-popup')).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('pipboy:prefs'))).toBe(before);
});
