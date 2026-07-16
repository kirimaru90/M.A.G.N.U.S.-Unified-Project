import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, TWO_CAMPAIGNS } from './fixtures';

const VIEWPORTS = {
  mobilePortrait: { width: 390, height: 844 },
  mobileLandscape: { width: 844, height: 390 },
  desktop: { width: 1280, height: 800 },
};

async function assertNoPageScroll(page: Page) {
  const overflow = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflow,
    body: getComputedStyle(document.body).overflow,
  }));
  expect(overflow.html).toBe('hidden');
  expect(overflow.body).toBe('hidden');

  await page.mouse.wheel(0, 2000);
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBe(0);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`no page-level scrollbar at ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubEnvironment(page);
    await login(page);

    await assertNoPageScroll(page);
  });
}

test('.pb-case bounding box is constant across login -> campaign-select -> character-select -> sheet', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });

  await page.goto('/index.html');
  const loginBox = await page.locator('.pb-case').boundingBox();

  await page.locator('#pb-login-username').fill('player1');
  await page.locator('#pb-login-password').fill('pass');
  await page.locator('#pb-login-submit').click();
  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toBeVisible();
  const campaignSelectBox = await page.locator('.pb-case').boundingBox();

  await page.getByText('Vault 111').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  const characterSelectBox = await page.locator('.pb-case').boundingBox();

  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  const sheetBox = await page.locator('.pb-case').boundingBox();

  expect(campaignSelectBox).toEqual(loginBox);
  expect(characterSelectBox).toEqual(loginBox);
  expect(sheetBox).toEqual(loginBox);
});

test('.pb-case widens beyond the portrait 460px cap in landscape', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobileLandscape);
  await stubEnvironment(page);
  await login(page);

  const box = await page.locator('.pb-case').boundingBox();
  expect(box!.width).toBeGreaterThan(460 + 100);
});

// The test above is a width regression guard, not a usability check. Unlocking
// rotation (manifest `orientation: "any"` + the runtime ORIENTAMENTO lock) makes
// this 390px-tall layout reachable on a real device for the first time, where the
// statusbar, header, tab nav, content pane and footer all compete for the height.
// So assert the chrome a player needs is actually there and tappable, rather than
// discovering it at the table.
test('the status bar, tab nav and footer stay visible and hit-testable in landscape', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobileLandscape);
  await stubEnvironment(page);
  await login(page);
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();

  for (const sel of ['#pb-statusbar', '#pb-nav-dossier', '#pb-nav-settings', '#pb-nav-logout', '.pb-footer']) {
    await expect(page.locator(sel)).toBeInViewport();
  }

  // Six since the MAPPA tab landed — the point of the assertion is that every
  // one of them stays in the viewport in landscape, not the specific number.
  const tabs = page.locator('#pb-tabs-top .pb-tab');
  await expect(tabs).toHaveCount(6);
  for (let i = 0; i < 6; i++) await expect(tabs.nth(i)).toBeInViewport();

  // Hit-testable, not merely painted: a tap must actually reach the control.
  await tabs.filter({ hasText: 'DADI' }).click();
  await expect(page.locator('#pb-dice-roll')).toBeVisible();
  await expect(page.locator('#pb-footer-tab')).toHaveText('DADI');

  await assertNoPageScroll(page);
});

test('on a wide desktop viewport .pb-case fills the viewport minus the small margin and exceeds the old 900px cap', async ({ page }) => {
  // The `body` padding is the "small uniform margin"; the case fills the rest.
  const MARGIN = 12;
  await page.setViewportSize(VIEWPORTS.desktop);
  await stubEnvironment(page);
  await login(page);
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();

  const box = await page.locator('.pb-case').boundingBox();
  expect(box!.width).toBeCloseTo(VIEWPORTS.desktop.width - MARGIN * 2, 0);
  expect(box!.height).toBeCloseTo(VIEWPORTS.desktop.height - MARGIN * 2, 0);
  // The old landscape cap left the case floating at 900px; it now fills the width.
  expect(box!.width).toBeGreaterThan(900);

  await assertNoPageScroll(page);

  // Scrolling still lives only inside the terminal's content pane.
  const contentOverflow = await page
    .locator('#pb-sheet-content')
    .evaluate((el) => getComputedStyle(el).overflowY);
  expect(contentOverflow).toBe('auto');
});
