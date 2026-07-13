import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, type StubOptions } from './fixtures';

// Covers the full-screen catalog picker sheet (api-tag-catalog / pipboy-character-sheet):
// the add-item "Scegli esistente" tab and the gear editor's tag-name inputs both
// select through the picker instead of a native <datalist>.

async function openSheet(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

const ownedCharacter = (overrides: Record<string, unknown> = {}) =>
  makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player', ...overrides });

const taggedWeapon = {
  id: 'w1',
  name: 'Fucile',
  broken: false,
  tags: [{ name: 'PROIETTILI', type: 'core', damaged: false }],
};

// ── 7.1 add-item "Scegli esistente" via the picker ──────────────────

test('add-item Scegli esistente opens the picker, filters, and OK issues the same PATCH', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  // Weapons default to the "Scegli esistente" tab; tapping the field opens the
  // full-screen picker sheet (no native <datalist>).
  await page.locator('[data-add-open]').click();
  await page.locator('#pb-popup-existing').click();
  await expect(page.locator('.pb-picker')).toBeVisible();

  // Both starter weapons are listed; typing narrows to the match.
  await expect(page.locator('.pb-picker-row')).toHaveCount(2);
  await page.locator('.pb-picker-search').fill('Pistola');
  await expect(page.locator('.pb-picker-row')).toHaveCount(1);

  // Selecting a row closes the picker and fills the field.
  await page.locator('.pb-picker-row', { hasText: 'Pistola 10mm' }).click();
  await expect(page.locator('.pb-picker-overlay')).toHaveCount(0);
  await expect(page.locator('#pb-popup-existing')).toContainText('Pistola 10mm');

  const req = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({
    weapons: {
      items: [
        {
          name: 'Pistola 10mm',
          tags: [
            { name: 'PROIETTILI', type: 'core', damaged: false },
            { name: 'AFFIDABILE', type: 'extra', damaged: false },
          ],
        },
      ],
    },
  });
  await expect(page.locator('.pb-popup-overlay')).toHaveCount(0);
});

test('dismissing the picker selects nothing and issues no PATCH', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  let patched = false;
  page.on('request', (r) => {
    if (r.url().includes('/inventory') && r.method() === 'PATCH') patched = true;
  });

  await page.locator('[data-add-open]').click();
  await page.locator('#pb-popup-existing').click();
  await page.locator('.pb-picker-close').click();
  await expect(page.locator('.pb-picker-overlay')).toHaveCount(0);
  // Nothing was chosen, so OK keeps the popup open and writes nothing.
  await page.locator('[data-ok]').click();
  await expect(page.locator('.pb-popup')).toBeVisible();
  expect(patched).toBe(false);
});

// ── 7.2 gear editor tag-name autocomplete via the picker ────────────

test('gear editor tag add opens the picker over the tag catalog and fills the name', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      inventory: { weapons: [taggedWeapon], equip: [], consumables: [], misc: [] },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('#pb-editor-toggle').click();

  // Adding a core tag opens the picker over the tag catalog; picking fills the name.
  await page.locator('[data-add-tag][data-type="core"]').click();
  await expect(page.locator('.pb-picker')).toBeVisible();
  await expect(page.locator('.pb-picker-row', { hasText: 'PESANTE' })).toBeVisible();

  const req = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('.pb-picker-row', { hasText: 'PESANTE' }).click();
  expect((await req).postDataJSON()).toEqual({
    weapons: {
      items: [
        {
          id: 'w1',
          tags: [
            { name: 'PROIETTILI', type: 'core', damaged: false },
            { name: 'PESANTE', type: 'core', damaged: false },
          ],
        },
      ],
    },
  });
});

test('a freely-typed non-catalog tag is still accepted via the picker', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      inventory: { weapons: [taggedWeapon], equip: [], consumables: [], misc: [] },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('#pb-editor-toggle').click();

  await page.locator('[data-add-tag][data-type="extra"]').click();
  // A name not in the catalog is committed through the free-text row.
  await page.locator('.pb-picker-search').fill('SPERIMENTALE');

  const req = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-freetext]').click();
  expect((await req).postDataJSON()).toEqual({
    weapons: {
      items: [
        {
          id: 'w1',
          tags: [
            { name: 'PROIETTILI', type: 'core', damaged: false },
            { name: 'SPERIMENTALE', type: 'extra', damaged: false },
          ],
        },
      ],
    },
  });
});
