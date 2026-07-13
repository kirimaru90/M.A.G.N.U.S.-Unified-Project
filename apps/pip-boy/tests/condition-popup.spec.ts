import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, type StubOptions } from './fixtures';

// Covers the two-tab add-condition popup (pipboy-character-sheet): the SALUTE
// tab's `+ AGGIUNGI CONDIZIONE` opens a popup whose "Scegli esistente" tab picks
// over the conditions catalog via the full-screen picker, and whose "custom" tab
// carries the sign/weight toggles. Also covers quantity-1 instantiation.

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

// ── 5.1 existing-tab picker, routed by polarity ─────────────────────

test('+ AGGIUNGI CONDIZIONE opens a two-tab popup; picking a negative preset routes to negativeConditions', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  await page.locator('#pb-cond-add').click();
  await expect(page.locator('.pb-popup')).toBeVisible();
  await expect(page.locator('[data-ptab="existing"]')).toHaveCount(1);
  await expect(page.locator('[data-ptab="custom"]')).toHaveCount(1);

  // The existing tab opens the picker over the stubbed conditions catalog.
  await page.locator('#pb-cond-existing').click();
  await expect(page.locator('.pb-picker')).toBeVisible();
  await page.locator('.pb-picker-row', { hasText: 'Avvelenato' }).click();
  await expect(page.locator('.pb-picker-overlay')).toHaveCount(0);

  // Confirming routes the negative-polarity preset to negativeConditions with
  // the entry's name/severity.
  const req = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toMatchObject({
    negativeConditions: { items: [{ name: 'Avvelenato', severity: 'major' }] },
  });
  await expect(page.locator('.pb-popup-overlay')).toHaveCount(0);
});

// ── 5.2 custom tab sign/weight, criticalState on threshold ──────────

test('the custom tab adds a condition with the chosen sign/weight and persists criticalState on crossing 4', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      status: {
        criticalState: false,
        negativeConditions: [{ id: 'n1', name: 'FERITO', severity: 'major' }],
        positiveConditions: [],
      },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();
  await expect(page.locator('#pb-net-value')).toHaveText('2');

  await page.locator('#pb-cond-add').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-cond-name').fill('IRRADIATO');
  await page.locator('[data-weight="major"]').click(); // net wear 2 → 4

  const req = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  const body = (await req).postDataJSON();
  expect(body).toMatchObject({
    negativeConditions: { items: [{ name: 'IRRADIATO', severity: 'major' }] },
    criticalState: true,
  });
  await expect(page.locator('#pb-net-value')).toHaveText('4');
});

test('a positive custom condition routes to positiveConditions', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  await page.locator('#pb-cond-add').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-cond-name').fill('BEN NUTRITO');
  await page.locator('[data-sign="positive"]').click();

  const req = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toMatchObject({
    positiveConditions: { items: [{ name: 'BEN NUTRITO', severity: 'minor' }] },
  });
});

test('the red ✕ cancels the condition popup with no write', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  let patched = false;
  page.on('request', (r) => {
    if (r.url().includes('/status') && r.method() === 'PATCH') patched = true;
  });

  await page.locator('#pb-cond-add').click();
  await page.locator('.pb-popup-close').click();
  await expect(page.locator('.pb-popup-overlay')).toHaveCount(0);
  expect(patched).toBe(false);
});

// ── 5.3 instantiating a misc/consumable template adds quantity 1 ────

test('instantiating a misc template adds quantity 1 regardless of the template', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('.pb-subtab', { hasText: 'Vari' }).click();

  await page.locator('[data-add-open]').click();
  await page.locator('#pb-popup-existing').click();
  await page.locator('.pb-picker-row', { hasText: 'Chiave inglese' }).click();

  const req = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({
    misc: { items: [{ name: 'Chiave inglese', quantity: 1, description: 'Attrezzo' }] },
  });
});
