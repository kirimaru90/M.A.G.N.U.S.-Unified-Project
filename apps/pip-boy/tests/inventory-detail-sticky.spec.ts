import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter } from './fixtures';

// Inventory quantity-row declutter + sticky resources + read-only item detail
// popup (Tasks 2 & 3).

const LONG_DESC =
  'Attrezzo multiuso lungo 30cm. '.repeat(200); // overflows the popup body

function manyConsumables(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `Consumabile ${i}`,
    description: i === 0 ? LONG_DESC : `descrizione ${i}`,
    quantity: i + 1,
  }));
}

async function openInvConsumables(page: Page, consumables: unknown[]) {
  const character = makeCharacter({
    id: 'char-1', campaignId: 'camp-1', userId: 'user-player',
    inventory: { weapons: [], equip: [], consumables, misc: [] },
  });
  await stubEnvironment(page, {
    role: 'player', userId: 'user-player',
    lastCampaignId: 'camp-1', lastCharacterId: 'char-1', character,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('.pb-subtab', { hasText: 'Consumabili' }).click();
}

test('consumable rows show the right-aligned stepper and no inline description', async ({ page }) => {
  await openInvConsumables(page, [
    { id: 'c1', name: 'Stimpak', description: 'Cura ferite', quantity: 3 },
  ]);

  const row = page.locator('[data-item="c1"]');
  // The description is not rendered inline in the row.
  await expect(row).not.toContainText('Cura ferite');
  // The stepper is present and sits to the right of the name.
  const nameBox = await row.locator('.pb-consumable-name').boundingBox();
  const stepperBox = await row.locator('.pb-consumable-stepper').boundingBox();
  expect(stepperBox!.x).toBeGreaterThan(nameBox!.x);
});

test('with a long list the resource band stays fixed above the footer, untouched by scrolling', async ({ page }) => {
  await openInvConsumables(page, manyConsumables(40));

  const content = page.locator('#pb-sheet-content');
  const band = page.locator('#pb-resource-band');
  const footer = page.locator('.pb-footer');
  await expect(band).toBeVisible();

  // The band's position before and after scrolling the item list is identical —
  // it lives outside the scroll container, so scrolling cannot move it.
  const before = await band.boundingBox();
  await content.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  const after = await band.boundingBox();
  expect(after!.y).toBeCloseTo(before!.y, 0);

  // The band sits below the scrolling content and above the footer.
  const contentBox = await content.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(after!.y).toBeGreaterThanOrEqual(contentBox!.y + contentBox!.height - 1);
  expect(after!.y + after!.height).toBeLessThanOrEqual(footerBox!.y + 1);
});

test('tapping an item name opens a read-only detail popup that scrolls and closes without writing', async ({ page }) => {
  await openInvConsumables(page, manyConsumables(3));

  let patched = false;
  page.on('request', (r) => {
    if (r.url().includes('/inventory') && r.method() === 'PATCH') patched = true;
  });

  await page.locator('[data-item="c0"] .pb-consumable-name').click();

  const popup = page.locator('.pb-info-popup');
  await expect(popup).toBeVisible();
  await expect(popup.locator('.pb-popup-title')).toHaveText('Consumabile 0');
  await expect(popup.locator('.pb-info-popup-body')).toContainText('Attrezzo multiuso');
  // Read-only: no edit controls, no OK action.
  await expect(popup.locator('input, [data-ok]')).toHaveCount(0);

  // The body scrolls internally while the popup itself stays a fixed box: the
  // body carries overflow-y:auto and its content overflows its client height,
  // yet the popup box is not taller than its overlay.
  const body = popup.locator('.pb-info-popup-body');
  expect(await body.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
  const overlayBox = await page.locator('.pb-popup-overlay').boundingBox();
  const popupBox = await popup.boundingBox();
  expect(popupBox!.height).toBeLessThanOrEqual(overlayBox!.height + 1);

  // The ✕ closes it with no write.
  await popup.locator('[data-cancel]').click();
  await expect(page.locator('.pb-info-popup')).toHaveCount(0);
  expect(patched).toBe(false);
});

test('an item with no description still opens the detail popup with an empty body', async ({ page }) => {
  await openInvConsumables(page, [{ id: 'c1', name: 'Senza Nota', quantity: 1 }]);

  await page.locator('[data-item="c1"] .pb-consumable-name').click();
  const popup = page.locator('.pb-info-popup');
  await expect(popup).toBeVisible();
  await expect(popup.locator('.pb-popup-title')).toHaveText('Senza Nota');
  await expect(popup.locator('.pb-info-popup-body')).toHaveText('');
});
