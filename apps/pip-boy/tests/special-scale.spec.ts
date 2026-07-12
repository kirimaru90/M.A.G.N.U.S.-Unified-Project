import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

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

const strengthStepper = (page: Page) => page.locator('.pb-stepper[data-key="strength"]');

// --- Task 2.T.1: SPECIAL 1..5 steppers, MAX PA decoupled to its own 0..8 ---

test('SPECIAL "+" disables at 5', async ({ page }) => {
  await openSheetAsOwner(page, {
    special: { strength: 4, perception: 3, endurance: 3, charisma: 3, intelligence: 3, agility: 3, luck: 3 },
  });
  await page.locator('#pb-editor-toggle').click();

  const stepper = strengthStepper(page);
  await expect(stepper.locator('.value')).toHaveText('4');
  await expect(stepper.locator('button[data-dir="1"]')).toBeEnabled();

  // 4 → 5 hits the ceiling; the increment disables.
  await stepper.locator('button[data-dir="1"]').click();
  await expect(stepper.locator('.value')).toHaveText('5');
  await expect(stepper.locator('button[data-dir="1"]')).toBeDisabled();
});

test('SPECIAL "−" disables at 1', async ({ page }) => {
  await openSheetAsOwner(page, {
    special: { strength: 1, perception: 3, endurance: 3, charisma: 3, intelligence: 3, agility: 3, luck: 3 },
  });
  await page.locator('#pb-editor-toggle').click();

  const stepper = strengthStepper(page);
  await expect(stepper.locator('.value')).toHaveText('1');
  await expect(stepper.locator('button[data-dir="-1"]')).toBeDisabled();
});

test('MAX PA stepper is decoupled from SPECIAL and still reaches 8', async ({ page }) => {
  // paMax starts at 5, exactly the new SPECIAL ceiling — proving the decoupling
  // means the stepper must continue past 5 toward its own 0..8 bound.
  await openSheetAsOwner(page, { actionPoints: { paMax: 5, paCurrent: 3, paTrackedBy: 'agility' } });
  await page.locator('#pb-editor-toggle').click();

  const stepper = page.locator('#pb-pa-max-stepper');
  await expect(stepper.locator('.value')).toHaveText('5');
  await expect(stepper.locator('button[data-dir="1"]')).toBeEnabled();

  // 5 → 6 → 7 → 8, then the ceiling disables.
  for (const value of ['6', '7', '8']) {
    await stepper.locator('button[data-dir="1"]').click();
    await expect(stepper.locator('.value')).toHaveText(value);
  }
  await expect(stepper.locator('button[data-dir="1"]')).toBeDisabled();
});

// --- Task 3.T.1: skill maestria renders as three competence squares ---

test('a skill at ESPERTO shows two of three filled squares; the select drives the fill', async ({ page }) => {
  await openSheetAsOwner(page, { skills: [{ id: 'lockpicking', level: 'expert' }] });
  await page.locator('.pb-tab', { hasText: 'ABIL' }).click();

  // View mode: ESPERTO → 2 of 3 filled, right of the skill name.
  const viewPips = page.locator('#pb-skills-list .pb-pips').first();
  await expect(viewPips.locator('.pb-pip')).toHaveCount(3);
  await expect(viewPips.locator('.pb-pip.filled')).toHaveCount(2);

  // Editor mode keeps the <select>; changing it re-renders the squares.
  await page.locator('#pb-editor-toggle').click();
  const select = page.locator('[data-skill-level="lockpicking"]');
  await expect(select).toBeVisible();

  const editPips = page.locator('#pb-skills-list .pb-pips').first();
  await expect(editPips.locator('.pb-pip.filled')).toHaveCount(2);

  await select.selectOption('master');
  await expect(page.locator('#pb-skills-list .pb-pips').first().locator('.pb-pip.filled')).toHaveCount(3);

  await page.locator('[data-skill-level="lockpicking"]').selectOption('competent');
  await expect(page.locator('#pb-skills-list .pb-pips').first().locator('.pb-pip.filled')).toHaveCount(1);
});
