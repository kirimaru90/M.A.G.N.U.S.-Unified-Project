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

const withConsumable = {
  inventory: { weapons: [], equip: [], consumables: [{ id: 'c1', name: 'Stimpak', quantity: 2 }], misc: [] },
};

test('owner action-points stepper round-trips via PATCH .../action-points', async ({ page }) => {
  await openSheetAsOwner(page);

  // The PA stepper lives in the sheet header, not a tab.
  const patchReq = page.waitForRequest((r) => r.url().includes('/action-points') && r.method() === 'PATCH');
  await page.locator('#pb-pa-stepper button[data-dir="1"]').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({ paCurrent: 4 });
  // Squares only, no numeric readout: paMax = 5, paCurrent = 4 → five pips, four filled.
  await expect(page.locator('#pb-pa-pips .pb-pip')).toHaveCount(5);
  await expect(page.locator('#pb-pa-pips .pb-pip.filled')).toHaveCount(4);
  await expect(page.locator('#pb-pa-stepper .value')).toHaveCount(0);
});

test('owner resources edit round-trips via PATCH .../resources', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

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

  // The add-path is the two-tab popup; the custom tab carries the name + sign +
  // weight the inline builder used to.
  await page.locator('#pb-cond-add').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-cond-name').fill('Ferito');
  await page.locator('[data-weight="major"]').click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  const req = await patchReq;

  // criticalState rides along on the same PATCH: net wear 2 < 4, so false.
  expect(req.postDataJSON()).toEqual({
    negativeConditions: { items: [{ name: 'Ferito', severity: 'major' }] },
    criticalState: false,
  });
  await expect(page.locator('#pb-cond-list')).toContainText('Ferito');
});

test('owner renames a consumable in editor mode and it persists across a reload', async ({ page }) => {
  await openSheetAsOwner(page, withConsumable);
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('.pb-subtab', { hasText: 'Consumabili' }).click();
  await page.locator('#pb-editor-toggle').click();

  const nameInput = page.locator('[data-item-name="c1"]');
  await expect(nameInput).toHaveValue('Stimpak');

  const patchReq = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await nameInput.fill('RadAway');
  await nameInput.blur();
  const req = await patchReq;
  expect(req.postDataJSON()).toEqual({ consumables: { items: [{ id: 'c1', name: 'RadAway' }] } });

  // The stub persists the rename; a reload deep-links back to the sheet.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('.pb-subtab', { hasText: 'Consumabili' }).click();
  // Back in view mode, the name renders as static text carrying the new value.
  await expect(page.locator('[data-item="c1"] .pb-consumable-name')).toHaveText('RadAway');
});

test('adjusting a consumable quantity leaves its name unchanged; a resource edit leaves the other two', async ({ page }) => {
  await openSheetAsOwner(page, withConsumable);
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('.pb-subtab', { hasText: 'Consumabili' }).click();

  // Quantity stepper is a view-mode affordance; the name must survive it.
  const patchReq = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-qty="c1"] button[data-dir="1"]').click();
  const req = await patchReq;
  expect(req.postDataJSON()).toEqual({ consumables: { items: [{ id: 'c1', quantity: 3 }] } });
  await expect(page.locator('[data-item="c1"] .pb-consumable-name')).toHaveText('Stimpak');
  await expect(page.locator('[data-item="c1"] .pb-label')).toHaveText('×3');

  // One resource counter changes; the other two are untouched (the original clobber guard).
  const resReq = page.waitForRequest((r) => r.url().includes('/resources') && r.method() === 'PATCH');
  await page.locator('[data-resource-input="caps"]').fill('25');
  await page.locator('[data-resource-input="caps"]').blur();
  await resReq;
  await expect(page.locator('[data-resource-input="caps"]')).toHaveValue('25');
  await expect(page.locator('[data-resource-input="scraps"]')).toHaveValue('2');
  await expect(page.locator('[data-resource-input="bobbleheads"]')).toHaveValue('1');
});

test('owner adds a custom weapon via the popup, round-tripping PATCH .../inventory', async ({ page }) => {
  await openSheetAsOwner(page);
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  // The add-path is the popup, available in view mode. Weapons have catalog
  // entries so the popup opens on "Scegli esistente"; switch to custom.
  await page.locator('[data-add-open]').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-popup-name').fill('Fucile a pompa');

  const patchReq = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({ weapons: { items: [{ name: 'Fucile a pompa' }] } });
  // The popup closes and the new item renders as static text in view mode.
  await expect(page.locator('.pb-popup-overlay')).toHaveCount(0);
  await expect(page.locator('[data-section-list="weapons"]')).toContainText('Fucile a pompa');
});
