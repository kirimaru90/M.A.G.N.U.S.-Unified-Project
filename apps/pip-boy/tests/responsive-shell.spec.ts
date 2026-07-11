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
