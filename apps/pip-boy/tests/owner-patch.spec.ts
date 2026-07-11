import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

async function openSheetAsOwner(page: Page) {
  const character = makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' });
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

test('owner action-points stepper round-trips via PATCH .../action-points', async ({ page }) => {
  await openSheetAsOwner(page);

  // The PA stepper lives in the sheet header, not a tab.
  const patchReq = page.waitForRequest((r) => r.url().includes('/action-points') && r.method() === 'PATCH');
  await page.locator('#pb-pa-stepper button[data-dir="1"]').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({ paCurrent: 4 });
  await expect(page.locator('#pb-pa-stepper .value')).toHaveText('4');
  // paMax = 5, paCurrent = 4 → five pips, four filled
  await expect(page.locator('#pb-pa-pips .pb-pip')).toHaveCount(5);
  await expect(page.locator('#pb-pa-pips .pb-pip.filled')).toHaveCount(4);
});

test('owner resources edit round-trips via PATCH .../resources', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.locator('.pb-tab', { hasText: 'ZAINO' }).click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/resources') && r.method() === 'PATCH');
  await page.locator('[data-resource-input="caps"]').fill('25');
  await page.locator('[data-resource-input="caps"]').blur();
  const req = await patchReq;

  expect(req.postDataJSON()).toMatchObject({ caps: 25 });
  // the footer's TAPPI readout tracks caps
  await expect(page.locator('#pb-footer-caps')).toHaveText('TAPPI 25');
});

test('owner adds a custom condition round-trips via PATCH .../status', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  await page.locator('#pb-cond-name').fill('Ferito');
  await page.locator('[data-weight="major"]').click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('#pb-cond-add').click();
  const req = await patchReq;

  // criticalState rides along on the same PATCH: net wear 2 < 4, so false.
  expect(req.postDataJSON()).toEqual({
    negativeConditions: { items: [{ name: 'Ferito', severity: 'major' }] },
    criticalState: false,
  });
  await expect(page.locator('#pb-cond-list')).toContainText('Ferito');
});

test('owner adds a weapon round-trips via PATCH .../inventory', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.locator('.pb-tab', { hasText: 'ZAINO' }).click();
  // Adding items is an editor-mode affordance.
  await page.locator('#pb-editor-toggle').click();

  await page.locator('#pb-add-weapons-name').fill('Fucile a pompa');
  const patchReq = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-add-item="weapons"]').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({ weapons: { items: [{ name: 'Fucile a pompa' }] } });
  // In editor mode the item's name renders as an inline input, not static text.
  await expect(page.locator('[data-section-list="weapons"] [data-item-name]')).toHaveValue(
    'Fucile a pompa',
  );

  // Leaving editor mode shows it as static text.
  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('[data-section-list="weapons"]')).toContainText('Fucile a pompa');
});
