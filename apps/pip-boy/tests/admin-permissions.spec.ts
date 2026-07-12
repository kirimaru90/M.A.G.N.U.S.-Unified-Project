import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

// The sheet is owner-editable: the `✎` toggle reveals edit affordances for the
// character's owner and for any admin. A non-owner player never reaches a sheet
// at all — the API 404s them — so no read-only sheet variant exists.

async function openSheet(page: Page, role: 'player' | 'admin') {
  const character = makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' });
  await stubEnvironment(page, {
    role,
    userId: role === 'admin' ? 'user-admin' : 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

test('an owning player sees the ✎ toggle and no read-only note', async ({ page }) => {
  await openSheet(page, 'player');

  await expect(page.locator('#pb-editor-toggle')).toBeVisible();
  await expect(page.locator('.pb-lock-note')).toHaveCount(0);
  await expect(page.getByText(/sola lettura/i)).toHaveCount(0);
});

test("an admin sees the ✎ toggle on another player's sheet", async ({ page }) => {
  await openSheet(page, 'admin');
  await expect(page.locator('#pb-editor-toggle')).toBeVisible();
});

test('S.P.E shows approach rows in view mode and steppers in editor mode', async ({ page }) => {
  await openSheet(page, 'player');

  // view mode: seven tappable approach rows with pips, no steppers
  await expect(page.locator('.pb-approach-row')).toHaveCount(7);
  await expect(page.locator('#pb-special-grid .pb-stepper')).toHaveCount(0);
  await expect(page.locator('.pb-approach-row .pb-pip').first()).toBeVisible();

  await page.locator('#pb-editor-toggle').click();

  // editor mode: seven 1..5 steppers, plus FONTE PA and MAX PA
  await expect(page.locator('#pb-special-grid .pb-stepper')).toHaveCount(7);
  await expect(page.locator('#pb-pa-source')).toBeVisible();
  await expect(page.locator('#pb-pa-max-stepper')).toBeVisible();
  await expect(page.locator('.pb-approach-row')).toHaveCount(0);
});

test('editor mode reveals add and remove controls on abilities and talents', async ({ page }) => {
  await openSheet(page, 'player');
  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-subtab', { hasText: 'Abilità' }).click();

  await expect(page.locator('#pb-skill-add-btn')).toHaveCount(0);
  await expect(page.locator('[data-remove-skill]')).toHaveCount(0);

  await page.locator('#pb-editor-toggle').click();

  // Abilità subtab: skills add + remove.
  await expect(page.locator('#pb-skill-add-btn')).toBeVisible();
  await expect(page.locator('[data-remove-skill]').first()).toBeVisible();

  // Talents subtab (editor mode persists across subtab switches): perks add.
  await page.locator('.pb-subtab', { hasText: 'Talents' }).click();
  await expect(page.locator('#pb-perk-add-btn')).toBeVisible();
});

test('the + add trigger is present on the weapons and armor subtabs', async ({ page }) => {
  await openSheet(page, 'player');
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  // The popup add-path is available in view mode (both modes) on every subtab.
  await expect(page.locator('[data-add-open]')).toHaveCount(1);
  await page.locator('.pb-subtab', { hasText: 'Armature' }).click();
  await expect(page.locator('[data-add-open]')).toHaveCount(1);

  // Editor mode keeps the same single + trigger — no separate inline add row.
  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('[data-add-open]')).toHaveCount(1);
});

test('paMax and paTrackedBy are not editable from the header', async ({ page }) => {
  await openSheet(page, 'player');

  await expect(page.locator('#pb-pa-stepper')).toBeVisible();
  await expect(page.locator('#pb-sheet-header #pb-pa-max-stepper')).toHaveCount(0);
  await expect(page.locator('#pb-sheet-header #pb-pa-source')).toHaveCount(0);
});

test('an owning non-admin can increment the BOBBLEHEAD stepper and it persists', async ({ page }) => {
  await openSheet(page, 'player');
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/resources') && r.method() === 'PATCH');
  await page.locator('[data-resource="bobbleheads"] button[data-dir="1"]').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({ bobbleheads: 2 });
  await expect(page.locator('[data-resource-input="bobbleheads"]')).toHaveValue('2');
});
