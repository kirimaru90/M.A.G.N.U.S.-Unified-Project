import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, emulateInstalled, TWO_CAMPAIGNS, type StubOptions } from './fixtures';

// The system back action (pipboy-app-shell › System back action), driven by
// page.goBack(): engine/back.js keeps one guard history entry on top and runs
// the first applicable step when it is popped — topmost overlay, then immersive
// map, then up one level, then nothing.

const owned = () => makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' });

async function openSheet(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: owned(),
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

async function openCampaignSelect(page: Page) {
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await login(page);
  await expect(page.locator('#pb-camp-list')).toBeVisible();
}

const isImmersive = (page: Page) =>
  page.evaluate(() => document.getElementById('app')!.classList.contains('pb-immersive'));
const guardOnTop = (page: Page) => page.evaluate(() => !!history.state?.pbGuard);

async function enterImmersive(page: Page) {
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.locator('[data-map-fs]').click();
  await expect.poll(() => isImmersive(page)).toBe(true);
}

test('back closes the settings popup first, leaving immersive on and the sheet mounted', async ({ page }) => {
  await openSheet(page);
  await enterImmersive(page);
  await page.locator('#pb-config-knob').click();
  await expect(page.locator('#pb-settings-popup')).toBeVisible();

  await page.goBack();
  await expect(page.locator('#pb-settings-popup')).toHaveCount(0);
  // Closed through its own path: the knob is unlit again.
  await expect(page.locator('#pb-config-knob')).not.toHaveClass(/on/);
  expect(await isImmersive(page)).toBe(true);
  await expect(page.locator('#pb-sheet-header')).toHaveCount(1);
});

test('back closes only the catalog picker stacked above the add-item popup', async ({ page }) => {
  await openSheet(page);
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('[data-add-open]').click();
  await page.locator('#pb-popup-existing').click();
  await expect(page.locator('.pb-picker')).toBeVisible();

  await page.goBack();
  await expect(page.locator('.pb-picker-overlay')).toHaveCount(0);
  await expect(page.locator('.pb-popup-overlay')).toHaveCount(1);
  await expect(page.locator('#pb-popup-existing')).toBeVisible();
});

test('back leaves immersive map mode and keeps the sheet', async ({ page }) => {
  await openSheet(page);
  await enterImmersive(page);

  await page.goBack();
  await expect.poll(() => isImmersive(page)).toBe(false);
  await expect(page.locator('.pb-tabs')).toBeVisible();
  await expect(page.locator('[data-map-fs]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  // The next back goes up one level, not into the map again.
  await page.goBack();
  await expect(page.locator('#pb-char-list')).toBeVisible();
});

test('back from the sheet returns to the dossier with the session intact', async ({ page }) => {
  await openSheet(page);

  await page.goBack();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(page.locator('#pb-login-submit')).toHaveCount(0);
});

test('back from the dossier (several campaigns) returns to campaign selection', async ({ page }) => {
  await openCampaignSelect(page);
  await page.locator('.pb-select-item', { hasText: 'Vault 111' }).click();
  await expect(page.locator('#pb-char-list')).toBeVisible();

  await page.goBack();
  await expect(page.locator('#pb-camp-list')).toBeVisible();
  await expect(page.locator('#pb-login-submit')).toHaveCount(0);
});

test('installed: back at campaign selection, pressed twice, stays put without logging out', async ({ page }) => {
  await emulateInstalled(page);
  await openCampaignSelect(page);
  expect(await guardOnTop(page)).toBe(true);

  for (let i = 0; i < 2; i++) {
    await page.goBack();
    await expect.poll(() => guardOnTop(page)).toBe(true);
    await expect(page.locator('#pb-camp-list')).toBeVisible();
    await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  }
  expect(page.url()).toContain('/index.html');
  await expect(page.locator('#pb-login-submit')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBeGreaterThan(0);
});

test('installed: back on the login screen, pressed twice, stays on login', async ({ page }) => {
  await emulateInstalled(page);
  await stubEnvironment(page);
  await page.goto('/index.html');
  await expect(page.locator('#pb-login-submit')).toBeVisible();
  // The guard is in place before the user has done anything.
  await expect.poll(() => guardOnTop(page)).toBe(true);

  for (let i = 0; i < 2; i++) {
    await page.goBack();
    await expect.poll(() => guardOnTop(page)).toBe(true);
    await expect(page.locator('#pb-login-submit')).toBeVisible();
  }
  expect(page.url()).toContain('/index.html');
});

test('browser tab: at campaign selection back is not intercepted', async ({ page }) => {
  await openCampaignSelect(page);

  // Nothing above campaign selection and nothing open: no guard on top, so
  // the browser's own back applies.
  await expect.poll(() => guardOnTop(page)).toBe(false);

  // Coming back up from the dossier drops the guard that screen needed.
  await page.locator('.pb-select-item', { hasText: 'Vault 111' }).click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect.poll(() => guardOnTop(page)).toBe(true);
  await page.goBack();
  await expect(page.locator('#pb-camp-list')).toBeVisible();
  await expect.poll(() => guardOnTop(page)).toBe(false);
});
