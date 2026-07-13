import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

// The unified two-tab add popup for skills and talents (Task 5). Covers the
// talents-catalog 400 tolerance and the custom-add path for both flows.

async function openSheetAsOwner(page: Page, overrides: Record<string, unknown> = {}) {
  const character = makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player', ...overrides });
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

async function openAbilita(page: Page) {
  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-subtab', { hasText: 'Abilità' }).click();
}

test('the skills + opens the two-tab popup; a catalog pick adds a skill keyed by its slug', async ({ page }) => {
  // The default character already has `lockpicking`; `science` remains addable.
  await openSheetAsOwner(page);
  await openAbilita(page);

  await page.locator('[data-add-skill]').click();
  await expect(page.locator('.pb-popup-tab', { hasText: 'Scegli esistente' })).toBeVisible();
  await expect(page.locator('.pb-popup-tab', { hasText: 'Aggiungi custom' })).toBeVisible();

  await page.locator('[data-open-existing]').click();
  await page.locator('.pb-picker-row', { hasText: 'Scienza' }).click();

  const req = page.waitForRequest((r) => r.url().includes('/skills') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({ items: [{ id: 'science', level: 'competent' }] });
});

test('a custom skill adds with a client-derived slug and the chosen maestria', async ({ page }) => {
  await openSheetAsOwner(page);
  await openAbilita(page);

  await page.locator('[data-add-skill]').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('[data-pane="custom"] [data-name]').fill('Armi da fuoco');
  await page.locator('[data-pane="custom"] [data-maestria] [data-level="master"]').click();

  const req = page.waitForRequest((r) => r.url().includes('/skills') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({ items: [{ id: 'armi-da-fuoco', level: 'master' }] });
});

test('the talents catalog 400 degrades to an empty selection tab with no error; custom add still works', async ({ page }) => {
  await openSheetAsOwner(page);
  // The talents catalog endpoint does not exist yet: respond 400.
  await page.route('**/talents-catalog', (route) =>
    route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"not available"}' }));

  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-subtab', { hasText: 'Talents' }).click();

  await page.locator('[data-add-talent]').click();

  // The custom tab is the default usable pane when the catalog is empty; the
  // "Scegli esistente" tab still exists and, when opened, lists nothing with no
  // error banner anywhere.
  await expect(page.locator('[data-pane="custom"]')).toBeVisible();
  await expect(page.locator('.pb-error, .pb-offline-banner')).toHaveCount(0);
  await page.locator('[data-ptab="existing"]').click();
  await expect(page.locator('.pb-popup [data-pane="existing"] .pb-empty')).toBeVisible();
  await expect(page.locator('.pb-error, .pb-offline-banner')).toHaveCount(0);
  await page.locator('[data-ptab="custom"]').click();

  await page.locator('[data-pane="custom"] [data-name]').fill('Rissaiolo');
  await page.locator('[data-pane="custom"] [data-desc]').fill('Bonus in mischia');

  const req = page.waitForRequest((r) => r.url().includes('/perks') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({ items: [{ name: 'Rissaiolo', description: 'Bonus in mischia' }] });

  await expect(page.locator('#pb-perks-list')).toContainText('Rissaiolo');
});
