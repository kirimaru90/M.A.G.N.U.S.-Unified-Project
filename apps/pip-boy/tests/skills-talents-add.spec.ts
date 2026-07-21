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
  // The talents catalog endpoint exists but may fail/be unavailable: respond 400
  // and assert the client still degrades to an empty selection tab with no error.
  await page.route('**/talents-catalog*', (route) =>
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

// ── SPECIAL-requirement detail popup + dimming/ordering ──────────────

// The default character (see fixtures.ts) has every SPECIAL stat at 3, so an
// Endurance-4 requirement is unmet while a Perception-2 requirement is met.
const GUN_FU = { slug: 'gun-fu', name: 'Gun Fu', description: 'Combattimento a mani nude' };
const IRON_FIST = { slug: 'iron-fist', name: 'Iron Fist', specialRequirement: [0, 0, 4, 0, 0, 0, 0] };
const EAGLE_EYE = { slug: 'eagle-eye', name: 'Eagle Eye', specialRequirement: [0, 2, 0, 0, 0, 0, 0] };

async function openTalentsPicker(page: Page) {
  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-subtab', { hasText: 'Talents' }).click();
  await page.locator('[data-add-talent]').click();
  await page.locator('[data-open-existing]').click();
  await expect(page.locator('.pb-picker')).toBeVisible();
}

test('tapping a talent row opens its detail popup instead of picking immediately', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([GUN_FU]) }));

  await openTalentsPicker(page);
  await page.locator('.pb-picker-row', { hasText: 'Gun Fu' }).click();

  await expect(page.locator('.pb-picker-detail')).toBeVisible();
  await expect(page.locator('.pb-picker-detail')).toContainText('Gun Fu');
  await expect(page.locator('.pb-picker-detail')).toContainText('Combattimento a mani nude');
  // The picker list is still mounted underneath.
  await expect(page.locator('.pb-picker')).toBeVisible();
  // Nothing is selected yet: the add popup's field is still empty.
  await expect(page.locator('[data-open-existing]')).not.toContainText('Gun Fu');
});

test('Seleziona commits the detail popup talent and OK issues the perks PATCH', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([GUN_FU]) }));

  await openTalentsPicker(page);
  await page.locator('.pb-picker-row', { hasText: 'Gun Fu' }).click();
  await page.locator('[data-detail-select]').click();

  await expect(page.locator('.pb-picker-detail-overlay')).toHaveCount(0);
  await expect(page.locator('.pb-picker-overlay')).toHaveCount(0);
  await expect(page.locator('[data-open-existing]')).toContainText('Gun Fu');

  const req = page.waitForRequest((r) => r.url().includes('/perks') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({
    items: [{ name: 'Gun Fu', description: 'Combattimento a mani nude' }],
  });
});

test('closing the detail popup returns to the list with search and results preserved, no PATCH', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([GUN_FU, IRON_FIST]) }));

  let patched = false;
  page.on('request', (r) => {
    if (r.url().includes('/perks') && r.method() === 'PATCH') patched = true;
  });

  await openTalentsPicker(page);
  await page.locator('.pb-picker-search').fill('Gun');
  await expect(page.locator('.pb-picker-row')).toHaveCount(1);
  await page.locator('.pb-picker-row', { hasText: 'Gun Fu' }).click();
  await expect(page.locator('.pb-picker-detail')).toBeVisible();

  await page.locator('[data-detail-cancel]').click();
  await expect(page.locator('.pb-picker-detail-overlay')).toHaveCount(0);
  await expect(page.locator('.pb-picker')).toBeVisible();
  await expect(page.locator('.pb-picker-search')).toHaveValue('Gun');
  await expect(page.locator('.pb-picker-row')).toHaveCount(1);
  expect(patched).toBe(false);
});

test('a talent whose requirement is unmet renders dimmed and sorts after satisfied entries, and stays selectable', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([IRON_FIST, GUN_FU, EAGLE_EYE]) }));

  await openTalentsPicker(page);

  // Endurance 4 > character's 3 → Iron Fist unmet; Gun Fu (no requirement) and
  // Eagle Eye (Perception 2 ≤ 3) are both satisfied, so alphabetical among
  // themselves, with Iron Fist last. Iron Fist and Eagle Eye also carry a
  // requirement chip on their row, so read the row identity off `data-pick`
  // rather than its full text.
  const names = await page.locator('.pb-picker-row[data-pick]').evaluateAll(
    (els) => els.map((el) => el.getAttribute('data-pick')));
  expect(names).toEqual(['Eagle Eye', 'Gun Fu', 'Iron Fist']);

  const ironFistRow = page.locator('.pb-picker-row', { hasText: 'Iron Fist' });
  await expect(ironFistRow).toHaveClass(/pb-picker-row--unmet/);

  // Dimming is informational only — the row still opens its detail popup and
  // can still be selected end-to-end.
  await ironFistRow.click();
  await expect(page.locator('.pb-picker-detail')).toContainText('Iron Fist');
  await expect(page.locator('.pb-picker-detail')).toContainText('E · 4');
  await page.locator('[data-detail-select]').click();

  const req = page.waitForRequest((r) => r.url().includes('/perks') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({ items: [{ name: 'Iron Fist' }] });
});

// ── Inline requirement chips on the picker row ────────────────────────

test('a talent with a non-zero requirement shows the matching chip(s) inline on its row', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([IRON_FIST, EAGLE_EYE]) }));

  await openTalentsPicker(page);

  const ironFistRow = page.locator('.pb-picker-row', { hasText: 'Iron Fist' });
  await expect(ironFistRow.locator('.pb-picker-sub')).toContainText('E · 4');

  const eagleEyeRow = page.locator('.pb-picker-row', { hasText: 'Eagle Eye' });
  await expect(eagleEyeRow.locator('.pb-picker-sub')).toContainText('P · 2');
});

test('a talent with no requirement shows no chip row', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([GUN_FU]) }));

  await openTalentsPicker(page);

  const gunFuRow = page.locator('.pb-picker-row', { hasText: 'Gun Fu' });
  await expect(gunFuRow.locator('.pb-picker-sub')).toHaveCount(0);
});

test('tapping a chip-bearing row still opens the detail popup, not an immediate pick', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.route('**/talents-catalog*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([IRON_FIST]) }));

  await openTalentsPicker(page);
  await page.locator('.pb-picker-row', { hasText: 'Iron Fist' }).click();

  await expect(page.locator('.pb-picker-detail')).toBeVisible();
  await expect(page.locator('[data-open-existing]')).not.toContainText('Iron Fist');
});
