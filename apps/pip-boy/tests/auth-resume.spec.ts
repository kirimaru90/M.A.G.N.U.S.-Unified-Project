import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, nextFrames, gotoTab, DEFAULT_MAP_CONFIG, type StubOptions } from './fixtures';

// Session re-verification on resume (Task 8). A returning-to-foreground event
// (visibilitychange → visible) re-checks the session via GET /auth/me: a valid
// token silently refreshes the character in place, a 401 routes to login, a
// transport blip is a no-op, and an anonymous resume issues no request. The
// refresh happens in place: view state, open editors and the map all survive.

async function openOwnerSheet(page: Page, overrides: Record<string, unknown> = {}, opts: StubOptions = {}) {
  const character = makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player', ...overrides });
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character,
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

const resume = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

const CHARACTER_URL = /\/campaigns\/[^/]+\/characters\/[^/]+$/;

/** Serve a changed character on the next GET, as the server would after edits elsewhere. */
async function serveCharacter(page: Page, overrides: Record<string, unknown>) {
  await page.route(CHARACTER_URL, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player', ...overrides })),
    });
  });
}

/** Resume and wait until the reloaded character has been applied. */
async function resumeAndReload(page: Page) {
  const reloaded = page.waitForResponse((r) => CHARACTER_URL.test(r.url()) && r.request().method() === 'GET');
  await resume(page);
  await reloaded;
  await nextFrames(page);
}

const activeTop = (page: Page) => page.locator('#pb-tabs-top .pb-tab.active');
const activeSub = (page: Page) => page.locator('#pb-tabs-sub .pb-subtab.active');

test('resume with a valid token silently reloads the character in place (no login)', async ({ page }) => {
  await openOwnerSheet(page);

  // Leave the sheet somewhere a fresh mount would not put it: STATS on a
  // non-first subtab, then INFO › Quest.
  await gotoTab(page, 'STATS', 'Abilità');
  await gotoTab(page, 'INFO', 'Quest');

  // The server now returns a renamed character; a valid re-verify must reload it
  // in place without prompting for login.
  await serveCharacter(page, { name: 'Marta Nuova' });

  await resume(page);

  await expect(page.getByRole('heading', { name: 'Marta Nuova' })).toBeVisible();
  await expect(page.locator('#pb-login-username')).toHaveCount(0);

  // A remount would land on STATS › Salute; a refresh in place keeps both.
  await expect(activeTop(page)).toHaveText('INFO');
  await expect(activeSub(page)).toHaveText('Quest');
  await gotoTab(page, 'STATS');
  await expect(activeSub(page)).toHaveText('Abilità');
});

test('resume keeps an open note editor, whose save updates the live sheet', async ({ page }) => {
  await openOwnerSheet(page, {}, { notes: [] });
  await gotoTab(page, 'INFO', 'Note');

  await page.locator('[data-note-add]').click();
  const editor = page.locator('.pb-note-editor');
  await editor.locator('[data-title]').fill('Diario');
  await editor.locator('[data-body]').click();
  await page.keyboard.type('testo non salvato');

  await serveCharacter(page, { name: 'Marta Nuova' });
  await resumeAndReload(page);
  await expect(page.getByRole('heading', { name: 'Marta Nuova' })).toBeVisible();

  await expect(editor).toBeVisible();
  await expect(editor.locator('[data-title]')).toHaveValue('Diario');
  await expect(editor.locator('[data-body]')).toHaveText('testo non salvato');

  await editor.locator('[data-save]').click();
  await expect(page.locator('.pb-note-editor')).toHaveCount(0);
  await expect(page.locator('.pb-note-row', { hasText: 'Diario' })).toBeVisible();
});

test('resume keeps edit mode and does not redraw the tab under it', async ({ page }) => {
  const inventory = { weapons: [{ id: 'w1', name: 'Fucile', broken: false, tags: [] }], equip: [], consumables: [], misc: [] };
  await openOwnerSheet(page, { inventory });
  await gotoTab(page, 'INV', 'Armi');
  await page.locator('#pb-editor-toggle').click();

  // Typed but never committed: `change` only fires on blur.
  const name = page.locator('[data-item-name="w1"]');
  await name.fill('Fucile modificato');

  await serveCharacter(page, { name: 'Marta Nuova', inventory });
  await resumeAndReload(page);

  await expect(page.getByRole('heading', { name: 'Marta Nuova' })).toBeVisible();
  await expect(page.locator('.pb-editor-strip')).toBeVisible();
  await expect(name).toHaveValue('Fucile modificato');
});

test('resume redraws a safe tab with fresh data and keeps its scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 560 });
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, name: `BONUS ${i}`, severity: 'minor' }));
  const status = { criticalState: false, positiveConditions: many, negativeConditions: [] };
  await openOwnerSheet(page, { status });
  await expect(activeSub(page)).toHaveText('Salute');

  const before = await page.locator('#pb-health-value').innerText();
  const content = page.locator('#pb-sheet-content');
  await content.evaluate((el) => { el.scrollTop = 200; });
  expect(await content.evaluate((el) => el.scrollTop)).toBe(200);

  // A major negative condition added elsewhere changes the health readout.
  await serveCharacter(page, {
    status: { ...status, negativeConditions: [{ id: 'n1', name: 'FERITO', severity: 'major' }] },
  });
  await resumeAndReload(page);

  await expect(page.locator('#pb-health-value')).not.toHaveText(before);
  await expect(page.locator('.pb-cond-row', { hasText: 'FERITO' })).toBeAttached();
  await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBe(200);
});

test('resume on the map keeps the same map, its view and immersive mode', async ({ page }) => {
  await openOwnerSheet(page, {}, { campaignMap: { config: DEFAULT_MAP_CONFIG, places: [] } });
  await page.locator('.pb-tab', { hasText: 'MAPPA' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();

  const view = { lat: DEFAULT_MAP_CONFIG.startLat + 0.01, lng: DEFAULT_MAP_CONFIG.startLng + 0.01, zoom: DEFAULT_MAP_CONFIG.startZoom + 1 };
  await page.evaluate((v) => {
    const map = (window as any).__PB_MAP__;
    map.setView([v.lat, v.lng], v.zoom, { animate: false });
    (window as any).__PB_MAP_BEFORE__ = map;
  }, view);
  await page.locator('[data-map-fs]').click();
  const immersive = () => page.evaluate(() => document.getElementById('app')!.classList.contains('pb-immersive'));
  await expect.poll(immersive).toBe(true);

  await serveCharacter(page, { name: 'Marta Nuova' });
  await resumeAndReload(page);

  const after = await page.evaluate(() => {
    const map = (window as any).__PB_MAP__;
    const c = map.getCenter();
    return { same: map === (window as any).__PB_MAP_BEFORE__, lat: c.lat, lng: c.lng, zoom: map.getZoom() };
  });
  expect(after.same).toBe(true);
  expect(after.lat).toBeCloseTo(view.lat, 4);
  expect(after.lng).toBeCloseTo(view.lng, 4);
  expect(after.zoom).toBe(view.zoom);
  expect(await immersive()).toBe(true);
});

test('resume with an expired token clears the session and routes to login', async ({ page }) => {
  await openOwnerSheet(page);

  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"expired"}' }));

  await resume(page);

  await expect(page.locator('#pb-login-username')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toHaveCount(0);
});

test('resume while offline keeps the current screen and does not log out', async ({ page }) => {
  await openOwnerSheet(page);

  // A transport failure (no HTTP status) must not be treated as expired.
  await page.route('**/auth/me', (route) => route.abort());

  const failed = page.waitForEvent('requestfailed', (r) => r.url().includes('/auth/me'));
  await resume(page);

  // Once the aborted request has failed and the app has had a frame to react,
  // confirm we stayed put.
  await failed;
  await nextFrames(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await expect(page.locator('#pb-login-username')).toHaveCount(0);
});

test('resume while anonymous issues no /auth/me request', async ({ page }) => {
  // No stored session: land on the login screen.
  await stubEnvironment(page, { role: 'player' });
  await page.goto('/index.html');
  await expect(page.locator('#pb-login-username')).toBeVisible();

  let meCalls = 0;
  page.on('request', (req) => { if (req.url().includes('/auth/me')) meCalls += 1; });

  await resume(page);
  // The resume handler runs inside dispatchEvent, so any /auth/me it issued
  // would reach Playwright before this later sentinel request does.
  await Promise.all([
    page.waitForRequest('**/manifest.webmanifest'),
    page.evaluate(() => fetch('manifest.webmanifest')),
  ]);

  expect(meCalls).toBe(0);
  await expect(page.locator('#pb-login-username')).toBeVisible();
});
