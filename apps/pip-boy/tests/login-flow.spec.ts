import { test, expect } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, TWO_CAMPAIGNS } from './fixtures';

test('login -> campaign select -> character select -> sheet', async ({ page }) => {
  // Two campaigns, so the picker renders rather than auto-selecting.
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await login(page);

  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toBeVisible();
  await page.getByText('Vault 111').click();

  await expect(page.locator('#pb-char-list')).toBeVisible();
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();

  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await expect(page.locator('.pb-tab.active')).toHaveText('S.P.E');
});

test('shows an error on invalid credentials without navigating', async ({ page }) => {
  await stubEnvironment(page);
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid credentials' }) }),
  );

  await page.goto('/index.html');
  await page.locator('#pb-login-username').fill('player1');
  await page.locator('#pb-login-password').fill('wrong');
  await page.locator('#pb-login-submit').click();

  await expect(page.locator('#pb-login-error')).toBeVisible();
  await expect(page.locator('#pb-login-error')).toContainText('CREDENZIALI NON VALIDE');
});

test('last-used defaulting skips selection when both campaign and character are set', async ({ page }) => {
  const character = makeCharacter({ id: 'char-1', campaignId: 'camp-1' });
  await stubEnvironment(page, {
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character,
    characters: [character],
  });
  await login(page);

  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).not.toBeVisible();
});

test('first-time user (no last selection) sees campaign selection', async ({ page }) => {
  await stubEnvironment(page, { lastCampaignId: null, lastCharacterId: null, campaigns: TWO_CAMPAIGNS });
  await login(page);

  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toBeVisible();
});
