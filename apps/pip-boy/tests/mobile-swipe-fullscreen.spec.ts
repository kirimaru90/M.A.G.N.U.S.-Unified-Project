import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, type StubOptions } from './fixtures';

// Covers the mobile-swipe-and-fullscreen-pwa change: reliable touch delivery
// (`touch-action: pan-y`), whole-surface distance-based tap/swipe discrimination
// with trailing-click suppression, the fullscreen manifest + iOS web-app meta,
// and the safe-area edge-to-edge shell.

async function openSheet(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

const ownedCharacter = (overrides: Record<string, unknown> = {}) =>
  makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player', ...overrides });

/**
 * Synthesise a touch swipe: pointerdown on `startSelector` (or the content
 * pane), pointerup on the content pane offset by (dx, dy). The handler reads
 * clientX/Y at down and up, so exact coordinates drive it.
 */
async function swipe(page: Page, dx: number, dy = 0, startSelector?: string) {
  await page.evaluate(({ dx, dy, startSelector }) => {
    const content = document.querySelector('#pb-sheet-content')!;
    const start = startSelector ? document.querySelector(startSelector)! : content;
    const rect = start.getBoundingClientRect();
    const x0 = rect.left + Math.min(20, rect.width / 2);
    const y0 = rect.top + rect.height / 2;
    const opts = (x: number, y: number) => ({ clientX: x, clientY: y, pointerType: 'touch', bubbles: true, cancelable: true });
    start.dispatchEvent(new PointerEvent('pointerdown', opts(x0, y0)));
    content.dispatchEvent(new PointerEvent('pointerup', opts(x0 + dx, y0 + dy)));
  }, { dx, dy, startSelector });
}

// ── 5.1 reliable touch delivery ─────────────────────────────────────

test('.pb-screen-content declares touch-action: pan-y', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  const touchAction = await page
    .locator('#pb-sheet-content')
    .evaluate((el) => getComputedStyle(el).touchAction);
  expect(touchAction).toBe('pan-y');
});

// ── 5.2 distance-based swipe navigation ─────────────────────────────

test('a horizontal swipe left advances and right retreats the active tab', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');

  await swipe(page, -120); // left → next
  await expect(page.locator('.pb-subtab.active')).toHaveText('Abilità');

  await swipe(page, 120); // right → previous
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');
});

test('a below-threshold drag does not navigate; a predominantly-vertical drag does not navigate', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await swipe(page, -40); // under the 60px threshold
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');

  await swipe(page, 20, -200); // vertical dominates → native scroll, no nav
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');
});

// ── 5.3 whole-surface swipe over a control + tap discrimination ──────

test('a swipe beginning over a control navigates and suppresses the trailing click', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');

  // Swipe left starting on the STRENGTH approach row (a button that, if
  // activated, would jump to DADI). It should navigate to Abilità instead, and
  // the trailing synthetic click must be swallowed.
  const clickPrevented = await page.evaluate(() => {
    const content = document.querySelector('#pb-sheet-content')!;
    const row = document.querySelector('.pb-approach-row[data-approach="strength"]')!;
    const rect = row.getBoundingClientRect();
    const x0 = rect.left + 10;
    const y0 = rect.top + rect.height / 2;
    const opts = (x: number) => ({ clientX: x, clientY: y0, pointerType: 'touch', bubbles: true, cancelable: true });
    row.dispatchEvent(new PointerEvent('pointerdown', opts(x0)));
    content.dispatchEvent(new PointerEvent('pointerup', opts(x0 - 120)));
    // Model the trailing click the browser fires after the gesture.
    const click = new MouseEvent('click', { clientX: x0 - 120, clientY: y0, bubbles: true, cancelable: true });
    const notCancelled = content.dispatchEvent(click);
    return !notCancelled; // preventDefault() was called on the click
  });

  expect(clickPrevented).toBe(true);
  // Navigated by swipe, and did NOT activate the approach row (which would show DADI).
  await expect(page.locator('.pb-subtab.active')).toHaveText('Abilità');
  await expect(page.locator('.pb-tab.active')).toHaveText('STATS');
});

test('a plain tap on a control fires the control without navigating by swipe', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');

  // A tap (no travel) on the STRENGTH approach row activates it → jumps to DADI.
  await page.evaluate(() => {
    const content = document.querySelector('#pb-sheet-content')!;
    const row = document.querySelector('.pb-approach-row[data-approach="strength"]')!;
    const rect = row.getBoundingClientRect();
    const x0 = rect.left + 10;
    const y0 = rect.top + rect.height / 2;
    const opts = { clientX: x0, clientY: y0, pointerType: 'touch', bubbles: true, cancelable: true };
    row.dispatchEvent(new PointerEvent('pointerdown', opts));
    content.dispatchEvent(new PointerEvent('pointerup', opts));
    row.dispatchEvent(new MouseEvent('click', { clientX: x0, clientY: y0, bubbles: true, cancelable: true }));
  });

  await expect(page.locator('.pb-tab.active')).toHaveText('DADI');
});

// ── 5.4 fullscreen manifest + iOS web-app meta ──────────────────────

test('manifest requests fullscreen with a standalone fallback', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')!.getAttribute('href')!;
    const res = await fetch(href);
    return res.json();
  });

  expect(manifest.display_override).toEqual(['fullscreen', 'standalone']);
  expect(manifest.display).toBe('standalone');
});

test('index.html declares the web-app meta tags and viewport-fit=cover', async ({ page }) => {
  await stubEnvironment(page);
  await page.goto('/index.html');

  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black-translucent');

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
});

// ── 5.5 safe-area edge-to-edge shell ────────────────────────────────

test('the case reaches the viewport edge when no safe-area inset exists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubEnvironment(page);
  await page.goto('/index.html');

  // Emulate fullscreen (the display-mode media query collapses the floating
  // margin) with no reported insets: the case should sit flush at the edges.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--pb-edge-margin', '0px');
  });

  const box = await page.locator('.pb-case').boundingBox();
  expect(box!.x).toBeCloseTo(0, 0);
  expect(box!.y).toBeCloseTo(0, 0);
  expect(box!.width).toBeCloseTo(390, 0);
});

test('header and footer content is inset from non-zero safe-area regions', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  // Emulate a device that reports a top notch and a bottom home indicator.
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--pb-safe-top', '44px');
    document.documentElement.style.setProperty('--pb-safe-bottom', '34px');
  });

  const statusPadTop = await page
    .locator('.pb-statusbar')
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
  expect(statusPadTop).toBeGreaterThanOrEqual(44);

  const footerPadBottom = await page
    .locator('.pb-footer')
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(footerPadBottom).toBeGreaterThanOrEqual(34);
});
