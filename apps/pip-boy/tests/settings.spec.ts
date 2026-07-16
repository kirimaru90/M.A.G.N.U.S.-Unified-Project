import { test, expect, type Page } from '@playwright/test';
import {
  stubEnvironment,
  login,
  openSheet,
  makeCharacter,
  stubDeviceApis,
  readDevice,
  seedPrefs,
  breakLocalStorage,
} from './fixtures';

const POPUP = '#pb-settings-popup';
const row = (page: Page, key: string) => page.locator(`${POPUP} [data-row="${key}"]`);
const option = (page: Page, key: string, value: string) =>
  row(page, key).locator(`[data-value="${value}"]`);

const openSettings = async (page: Page) => {
  await page.locator('#pb-nav-settings').click();
  await expect(page.locator(POPUP)).toBeVisible();
};

// ── entry point ─────────────────────────────────────────────────────

test('the settings control renders between ◄ DOSSIER and ESCI on the sheet', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);

  const ids = await page.locator('#pb-statusbar-nav button').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['pb-nav-dossier', 'pb-nav-settings', 'pb-nav-logout']);
  await expect(page.locator('#pb-nav-settings')).toHaveAttribute('aria-label', 'Impostazioni');
});

test('the settings control is absent off-sheet', async ({ page }) => {
  await stubEnvironment(page, { campaigns: [{ id: 'camp-1', name: 'Vault 111' }, { id: 'camp-2', name: 'Vault 88' }] });

  // login
  await page.goto('/index.html');
  await expect(page.locator('#pb-nav-settings')).toBeHidden();

  // campaign-select
  await page.locator('#pb-login-username').fill('player1');
  await page.locator('#pb-login-password').fill('pass');
  await page.locator('#pb-login-submit').click();
  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toBeVisible();
  await expect(page.locator('#pb-nav-settings')).toBeHidden();

  // character-select
  await page.getByText('Vault 111').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect(page.locator('#pb-nav-settings')).toBeHidden();

  // ...and back on the sheet it returns
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.locator('#pb-nav-settings')).toBeVisible();
});

test('a read-only viewer, whose ✎ toggle is hidden, can still open settings', async ({ page }) => {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player-2',
    character: makeCharacter({ userId: 'user-player' }),
  });
  await openSheet(page);

  // Device prefs are the viewer's, not the character's — so unlike ✎, the
  // settings control is never permission-gated.
  await expect(page.locator('#pb-editor-toggle')).toBeHidden();
  await expect(page.locator('#pb-nav-settings')).toBeVisible();
  await openSettings(page);
});

// ── popup shape and apply-on-tap ────────────────────────────────────

test('the popup shows four rows in order and offers no OK control anywhere', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  await expect(page.locator(`${POPUP} .pb-popup-title`)).toHaveText('IMPOSTAZIONI');
  const labels = await page.locator(`${POPUP} .pb-settings-row .pb-label`).allTextContents();
  expect(labels).toEqual(['ORIENTAMENTO', 'VIBRAZIONE', 'SCHERMO SEMPRE ATTIVO', 'AUDIO']);

  await expect(row(page, 'orientation').locator('[data-value]')).toHaveText(['AUTO', 'VERTICALE', 'ORIZZONTALE']);
  await expect(row(page, 'vibration').locator('[data-value]')).toHaveText(['ON', 'OFF']);

  // A preference has no cancel semantics, so there is nothing to confirm.
  await expect(page.locator(`${POPUP} .pb-popup-actions`)).toHaveCount(0);
  await expect(page.locator(POPUP).getByText('OK', { exact: true })).toHaveCount(0);
});

test('the popup opens with the defaults active: AUTO, vibration on, wake lock on', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  await expect(option(page, 'orientation', 'auto')).toHaveClass(/active/);
  await expect(option(page, 'vibration', 'on')).toHaveClass(/active/);
  await expect(option(page, 'wakeLock', 'on')).toHaveClass(/active/);
});

test('a choice applies on tap, survives ✕ and a reload, and is reflected when reopened', async ({ page }) => {
  await stubDeviceApis(page);
  // Resume straight onto the sheet, so the reload below lands there too.
  await stubEnvironment(page, { lastCampaignId: 'camp-1', lastCharacterId: 'char-1' });
  await login(page);
  await page.locator('#pb-sheet-header').waitFor();
  await openSettings(page);

  await option(page, 'vibration', 'off').click();
  await expect(option(page, 'vibration', 'off')).toHaveClass(/active/);
  await expect(option(page, 'vibration', 'on')).not.toHaveClass(/active/);

  // Closing is not a cancel: the write already happened on tap.
  await page.locator(`${POPUP} [data-close]`).click();
  await expect(page.locator(POPUP)).toHaveCount(0);
  await openSettings(page);
  await expect(option(page, 'vibration', 'off')).toHaveClass(/active/);

  // ...and it is durable, not just in-memory.
  await page.reload();
  await page.locator('#pb-sheet-header').waitFor();
  await openSettings(page);
  await expect(option(page, 'vibration', 'off')).toHaveClass(/active/);
});

test('the backdrop dismisses the popup without reverting a choice', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  await option(page, 'wakeLock', 'off').click();
  await page.locator('.pb-popup-overlay').click({ position: { x: 4, y: 4 } });
  await expect(page.locator(POPUP)).toHaveCount(0);

  await openSettings(page);
  await expect(option(page, 'wakeLock', 'off')).toHaveClass(/active/);
});

test('a preference set on the sheet stays in effect off-sheet', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);
  await option(page, 'orientation', 'landscape').click();
  await page.locator(`${POPUP} [data-close]`).click();

  // Prefs are edited only from the sheet but applied globally: navigating to a
  // screen with no settings control must not drop the lock.
  await page.locator('#pb-nav-dossier').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect(page.locator('#pb-nav-settings')).toBeHidden();

  const stored = await page.evaluate(() => window.localStorage.getItem('pipboy:prefs'));
  expect(JSON.parse(stored!).orientation).toBe('landscape');
  expect((await readDevice(page)).orientation).toContain('lock:landscape');
});

// ── the audio row ───────────────────────────────────────────────────

test('the AUDIO row is disabled, marked N/D, and inert on tap', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  const audio = row(page, 'audio');
  await expect(audio).toHaveClass(/pb-settings-row--disabled/);
  await expect(audio.locator('.pb-settings-na')).toHaveText('N/D');
  await expect(audio.locator('[data-value="on"]')).toBeDisabled();
  await expect(audio.locator('[data-value="off"]')).toBeDisabled();

  await audio.locator('[data-value="on"]').click({ force: true });
  await expect(audio.locator('.pb-toggle.active')).toHaveCount(0);
  const stored = await page.evaluate(() => window.localStorage.getItem('pipboy:prefs'));
  expect(stored == null || !('audio' in JSON.parse(stored))).toBe(true);
});

// ── orientation ─────────────────────────────────────────────────────

test('each orientation option drives the runtime lock', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  await option(page, 'orientation', 'landscape').click();
  await expect.poll(async () => (await readDevice(page)).orientation).toContain('lock:landscape');

  await option(page, 'orientation', 'portrait').click();
  await expect.poll(async () => (await readDevice(page)).orientation).toContain('lock:portrait');

  await option(page, 'orientation', 'auto').click();
  await expect.poll(async () => (await readDevice(page)).orientation).toContain('unlock');
});

test('a persisted landscape preference locks at boot, with no popup opened', async ({ page }) => {
  await stubDeviceApis(page);
  await seedPrefs(page, { orientation: 'landscape', vibration: true, wakeLock: true });
  await stubEnvironment(page);
  await login(page);

  await expect.poll(async () => (await readDevice(page)).orientation).toEqual(['lock:landscape']);
  await expect(page.locator(POPUP)).toHaveCount(0);
});

test('a rejecting orientation lock (the browser-tab case) is absorbed silently', async ({ page }) => {
  await stubDeviceApis(page, { orientationRejects: true });
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  await option(page, 'orientation', 'landscape').click();
  await expect.poll(async () => (await readDevice(page)).orientation).toContain('lock:landscape');

  // No unhandled rejection, nothing user-facing, and the app stays interactive...
  const device = await readDevice(page);
  expect(device.unhandled).toEqual([]);
  await expect(option(page, 'orientation', 'landscape')).toHaveClass(/active/);
  await page.locator(`${POPUP} [data-close]`).click();
  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await expect(page.locator('#pb-dice-roll')).toBeEnabled();

  // ...and the preference still persists, so it takes effect once installed.
  const stored = await page.evaluate(() => window.localStorage.getItem('pipboy:prefs'));
  expect(JSON.parse(stored!).orientation).toBe('landscape');
});

// ── wake lock ───────────────────────────────────────────────────────

test('the wake lock is held while the sheet is mounted and released on leaving it', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);

  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('request:screen');

  await page.locator('#pb-nav-dossier').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('release');
});

test('leaving the sheet while the request is still in flight still releases the lock', async ({ page }) => {
  // The request is held pending, so leaving the sheet lands *mid-request* — the
  // window that really exists but is only a microtask wide against a real API.
  await stubDeviceApis(page, { wakeLockRequestDelayMs: 400 });
  await stubEnvironment(page);
  await openSheet(page);
  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('request:screen');

  // The sentinel must not arrive after the release and leave the screen locked
  // awake for the rest of the session with no handle left to free it.
  await page.locator('#pb-nav-dossier').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();

  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('release');
  await expect
    .poll(async () => {
      const { wakeLock } = await readDevice(page);
      return wakeLock.filter((c) => c === 'request:screen').length - wakeLock.filter((c) => c === 'release').length;
    })
    .toBe(0);
});

test('the wake lock is re-acquired when the page becomes visible again', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('request:screen');

  const requestsBefore = (await readDevice(page)).wakeLock.filter((c) => c === 'request:screen').length;

  // The browser releases the lock on hide and never restores it — the app must
  // notice it is visible again and ask for it back. Without this the feature
  // dies at the first backgrounding while appearing to work.
  await page.evaluate(() => {
    (window as unknown as { __PB_DEVICE__: { simulateHide: () => void } }).__PB_DEVICE__.simulateHide();
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect
    .poll(async () => (await readDevice(page)).wakeLock.filter((c) => c === 'request:screen').length)
    .toBeGreaterThan(requestsBefore);
});

test('toggling SCHERMO SEMPRE ATTIVO acquires and releases immediately, without navigation', async ({ page }) => {
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);
  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('request:screen');

  await option(page, 'wakeLock', 'off').click();
  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('release');

  const before = (await readDevice(page)).wakeLock.filter((c) => c === 'request:screen').length;
  await option(page, 'wakeLock', 'on').click();
  await expect
    .poll(async () => (await readDevice(page)).wakeLock.filter((c) => c === 'request:screen').length)
    .toBeGreaterThan(before);
});

test('a wake lock preference of off requests nothing when the sheet mounts', async ({ page }) => {
  await stubDeviceApis(page);
  await seedPrefs(page, { orientation: 'auto', vibration: true, wakeLock: false });
  await stubEnvironment(page);
  await openSheet(page);

  await expect(page.locator('#pb-sheet-header')).toBeVisible();
  expect((await readDevice(page)).wakeLock).toEqual([]);
});

test('a rejecting wake lock is absorbed silently', async ({ page }) => {
  await stubDeviceApis(page, { wakeLockRejects: true });
  await stubEnvironment(page);
  await openSheet(page);

  await expect.poll(async () => (await readDevice(page)).wakeLock).toContain('request:screen');
  expect((await readDevice(page)).unhandled).toEqual([]);
  await expect(page.locator('#pb-sheet-header')).toBeVisible();
});

// ── every platform API absent ───────────────────────────────────────

test('with every device API absent the app boots, settles a roll, and every wrapper stays silent', async ({ page }) => {
  await stubDeviceApis(page, { orientationAbsent: true, wakeLockAbsent: true, vibrateAbsent: true });
  await seedPrefs(page, { orientation: 'landscape', vibration: true, wakeLock: true });
  await stubEnvironment(page);
  await openSheet(page);

  await openSettings(page);
  await option(page, 'orientation', 'portrait').click();
  await option(page, 'wakeLock', 'off').click();
  await option(page, 'wakeLock', 'on').click();
  await page.locator(`${POPUP} [data-close]`).click();

  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await page.locator('#pb-dice-roll').click();
  await page.waitForTimeout(900);
  await expect(page.locator('#pb-dice-result')).toBeVisible();

  expect((await readDevice(page)).unhandled).toEqual([]);
});

// ── hostile / corrupt storage ───────────────────────────────────────

test('the app boots and the sheet renders when localStorage access throws', async ({ page }) => {
  await stubDeviceApis(page);
  await breakLocalStorage(page);
  await stubEnvironment(page);

  // The white-screen guard: an unguarded read runs at boot, so a throw here
  // would abort startup before anything rendered rather than degrade a feature.
  await openSheet(page);
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  // Prefs still work, in memory only, for the session.
  await openSettings(page);
  await expect(option(page, 'vibration', 'on')).toHaveClass(/active/);
  await option(page, 'vibration', 'off').click();
  await expect(option(page, 'vibration', 'off')).toHaveClass(/active/);
  expect((await readDevice(page)).unhandled).toEqual([]);
});

for (const [name, stored] of [
  ['unparseable JSON', '{not json'],
  ['JSON of the wrong shape', '[1,2,3]'],
  ['unrecognised field values', '{"orientation":"sideways","vibration":"yes","wakeLock":0}'],
] as const) {
  test(`stored prefs that are ${name} fall back to defaults`, async ({ page }) => {
    await stubDeviceApis(page);
    await seedPrefs(page, stored);
    await stubEnvironment(page);
    await openSheet(page);
    await openSettings(page);

    await expect(option(page, 'orientation', 'auto')).toHaveClass(/active/);
    await expect(option(page, 'vibration', 'on')).toHaveClass(/active/);
    await expect(option(page, 'wakeLock', 'on')).toHaveClass(/active/);
    expect((await readDevice(page)).unhandled).toEqual([]);
  });
}

// ── reduced motion ──────────────────────────────────────────────────

test('reduced-motion seeds the vibration default to off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubDeviceApis(page);
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  await expect(option(page, 'vibration', 'off')).toHaveClass(/active/);
  // It seeds the vibration default only — the other rows keep theirs.
  await expect(option(page, 'wakeLock', 'on')).toHaveClass(/active/);
});

test('an explicit stored vibration choice outranks reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await stubDeviceApis(page);
  await seedPrefs(page, { orientation: 'auto', vibration: true, wakeLock: true });
  await stubEnvironment(page);
  await openSheet(page);
  await openSettings(page);

  await expect(option(page, 'vibration', 'on')).toHaveClass(/active/);

  // A user who asks for reduced motion may still turn rumble on and have it honoured.
  await page.locator(`${POPUP} [data-close]`).click();
  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await page.locator('#pb-dice-roll').click();
  await page.waitForTimeout(900);
  expect((await readDevice(page)).vibrate.length).toBeGreaterThan(0);
});
