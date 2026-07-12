import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, type StubOptions } from './fixtures';

// Covers the new pipboy-sheet-navigation capability (two-level tabs, the
// flattened prev/next order, swipe with a deadzone) plus the character-sheet
// deltas that ride with it (STATS split, squares-only PA control, the inventory
// add-item popup, Vari→inventory.other, and the tag/skill display orderings).

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

/**
 * Synthesise a horizontal swipe by dispatching pointerdown/up on the content
 * region (or on `startSelector`, to model a gesture that begins on a control).
 * The handler reads clientX at down and up, so exact coordinates drive it.
 */
async function swipe(page: Page, dx: number, dy = 0, startSelector?: string) {
  await page.evaluate(({ dx, dy, startSelector }) => {
    const content = document.querySelector('#pb-sheet-content')!;
    const start = startSelector ? document.querySelector(startSelector)! : content;
    const rect = start.getBoundingClientRect();
    const x0 = rect.left + Math.min(20, rect.width / 2);
    const y0 = rect.top + rect.height / 2;
    start.dispatchEvent(new PointerEvent('pointerdown', { clientX: x0, clientY: y0, bubbles: true }));
    content.dispatchEvent(new PointerEvent('pointerup', { clientX: x0 + dx, clientY: y0 + dy, bubbles: true }));
  }, { dx, dy, startSelector });
}

// ── two-level layout + conditional subtab row ───────────────────────

test('the subtab row appears only for tabs that define subtabs', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  // STATS (default) → three subtabs.
  await expect(page.locator('.pb-subtab')).toHaveText(['S.P.E.C.I.A.L.', 'Abilità', 'Talents']);

  // SALUTE / DADI / NOTES → no subtab row.
  for (const label of ['SALUTE', 'DADI', 'NOTES']) {
    await page.locator('.pb-tab', { hasText: label }).click();
    await expect(page.locator('.pb-subtabs')).toBeHidden();
    await expect(page.locator('.pb-subtab')).toHaveCount(0);
  }

  // INV → four subtabs.
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await expect(page.locator('.pb-subtab')).toHaveText(['Armi', 'Armature', 'Consumabili', 'Vari']);
});

test('each first-level tab remembers its last-active subtab', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('.pb-subtab', { hasText: 'Consumabili' }).click();
  await expect(page.locator('.pb-subtab.active')).toHaveText('Consumabili');

  // Leave and come back — the subtab is restored, not reset to Armi.
  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await expect(page.locator('.pb-subtab.active')).toHaveText('Consumabili');
});

// ── flattened swipe traversal with a deadzone ───────────────────────

test('swipe left advances and spills from a section into the next tab; right retreats', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');

  await swipe(page, -120); // → Abilità
  await expect(page.locator('.pb-subtab.active')).toHaveText('Abilità');

  await swipe(page, -120); // → Talents
  await expect(page.locator('.pb-subtab.active')).toHaveText('Talents');

  await swipe(page, -120); // spill: Talents is the last STATS subtab → SALUTE
  await expect(page.locator('.pb-tab.active')).toHaveText('SALUTE');
  await expect(page.locator('.pb-subtabs')).toBeHidden();

  await swipe(page, 120); // back into the last STATS subtab
  await expect(page.locator('.pb-tab.active')).toHaveText('STATS');
  await expect(page.locator('.pb-subtab.active')).toHaveText('Talents');
});

test('a short, vertical, or on-control gesture does not navigate', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await swipe(page, -30); // below the distance threshold
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');

  await swipe(page, 15, -150); // predominantly vertical (scroll)
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');

  // A long horizontal drag that begins on an interactive control is ignored.
  await swipe(page, -120, 0, '.pb-approach-row[data-approach="strength"]');
  await expect(page.locator('.pb-subtab.active')).toHaveText('S.P.E.C.I.A.L.');
});

// ── STATS split ─────────────────────────────────────────────────────

test('STATS splits into S.P.E.C.I.A.L. (with the dice legend), Abilità (+ SPESA PA), and Talents', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({ perks: [{ id: 'p1', name: 'Ratto di Fogna', description: 'noto' }] }),
  });

  // S.P.E.C.I.A.L. carries the dice-outcome legend.
  await expect(page.locator('.pb-legend')).toContainText('Successo Pieno');

  // Abilità: skills + the read-only SPESA PA block, no perks.
  await page.locator('.pb-subtab', { hasText: 'Abilità' }).click();
  await expect(page.locator('#pb-skills-list')).toBeVisible();
  await expect(page.locator('#pb-pa-spend')).toContainText('V.A.T.S.');
  await expect(page.locator('#pb-perks-list')).toHaveCount(0);

  // Talents: perks only, no skills.
  await page.locator('.pb-subtab', { hasText: 'Talents' }).click();
  await expect(page.locator('#pb-perks-list')).toContainText('Ratto di Fogna');
  await expect(page.locator('#pb-skills-list')).toHaveCount(0);
});

test('skills render alphabetically by catalog name', async ({ page }) => {
  // Stored reversed; Scassinare (lockpicking) must sort before Scienza (science).
  await openSheet(page, {
    character: ownedCharacter({
      skills: [
        { id: 'science', level: 'expert' },
        { id: 'lockpicking', level: 'competent' },
      ],
    }),
  });
  await page.locator('.pb-subtab', { hasText: 'Abilità' }).click();

  const names = await page.locator('#pb-skills-list .pb-row > span').allInnerTexts();
  expect(names).toEqual(['Scassinare', 'Scienza']);
});

// ── squares-only PA control ─────────────────────────────────────────

test('the PA header control is squares flanked by − and + with no numeric readout', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  const track = page.locator('#pb-pa-stepper');
  await expect(track.locator('button[data-dir="-1"]')).toHaveCount(1);
  await expect(track.locator('button[data-dir="1"]')).toHaveCount(1);
  await expect(track.locator('#pb-pa-pips')).toHaveCount(1);
  await expect(track.locator('.value')).toHaveCount(0);

  // − precedes the pips which precede + in DOM order.
  const order = await track.evaluate((el) =>
    [...el.children].map((c) => (c.tagName === 'BUTTON' ? c.getAttribute('data-dir') : c.id)));
  expect(order).toEqual(['-1', 'pb-pa-pips', '1']);
});

// ── inventory add-item popup ────────────────────────────────────────

test('the popup opens in view mode; the red ✕ cancels with no write', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  let inventoryPatched = false;
  page.on('request', (r) => {
    if (r.url().includes('/inventory') && r.method() === 'PATCH') inventoryPatched = true;
  });

  await page.locator('[data-add-open]').click();
  await expect(page.locator('.pb-popup')).toBeVisible();
  // Weapons have a catalog kind, so both tabs are present.
  await expect(page.locator('[data-ptab="existing"]')).toHaveCount(1);
  await expect(page.locator('[data-ptab="custom"]')).toHaveCount(1);

  await page.locator('.pb-popup-close').click();
  await expect(page.locator('.pb-popup-overlay')).toHaveCount(0);
  expect(inventoryPatched).toBe(false);
});

test('a custom weapon in the popup carries its tags; the Vari popup hides the existing-item tab', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  // Armi: custom add with a core tag.
  await page.locator('[data-add-open]').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-popup-name').fill('Coltello');
  await page.locator('[data-add-custom-tag="core"]').click();
  await page.locator('[data-custom-tag-name]').fill('AFFILATO');

  const weaponReq = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await weaponReq).postDataJSON()).toEqual({
    weapons: { items: [{ name: 'Coltello', tags: [{ name: 'AFFILATO', type: 'core' }] }] },
  });

  // Vari has no catalog kind: the popup opens straight on Aggiungi custom with
  // only name/description/quantity, and no "Scegli esistente" tab.
  await page.locator('.pb-subtab', { hasText: 'Vari' }).click();
  await page.locator('[data-add-open]').click();
  await expect(page.locator('[data-ptab="existing"]')).toHaveCount(0);
  await expect(page.locator('#pb-popup-desc')).toBeVisible();
  await expect(page.locator('[data-add-custom-tag]')).toHaveCount(0);
});

test('a custom Vari item persists to inventory.other and renders under Vari', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('.pb-subtab', { hasText: 'Vari' }).click();

  await page.locator('[data-add-open]').click();
  await page.locator('#pb-popup-name').fill('Chiave inglese');
  await page.locator('#pb-popup-desc').fill('arrugginita');
  await page.locator('#pb-popup-qty button[data-dir="1"]').click(); // 1 → 2

  const req = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toEqual({
    other: { items: [{ name: 'Chiave inglese', quantity: 2, description: 'arrugginita' }] },
  });

  await expect(page.locator('[data-section-list="other"]')).toContainText('Chiave inglese');
});

// ── tag display ordering with correct edit routing ──────────────────

test('tags render core→extra→alpha, and editing a reordered chip targets the stored tag', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      inventory: {
        weapons: [{
          id: 'w1', name: 'Fucile', broken: false,
          tags: [
            { name: 'Zeta', type: 'extra', damaged: false },
            { name: 'Alfa', type: 'core', damaged: false },
            { name: 'Beta', type: 'core', damaged: false },
          ],
        }],
        equip: [], consumables: [], other: [],
      },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  // Display order: Alfa (core), Beta (core), Zeta (extra).
  const chipTexts = await page.locator('[data-item="w1"] .pb-chip').allInnerTexts();
  expect(chipTexts.map((t) => t.trim().split(/\s+/)[0])).toEqual(['Alfa', 'Beta', 'Zeta']);

  // The displayed-first chip is Alfa, whose STORED index is 1. Toggling it must
  // flip the stored tag at index 1, not the tag at stored index 0 (Zeta).
  const req = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-item="w1"] .pb-chip').first().click();
  const tags = (await req).postDataJSON().weapons.items[0].tags;
  expect(tags[1]).toMatchObject({ name: 'Alfa', damaged: true });
  expect(tags[0]).toMatchObject({ name: 'Zeta', damaged: false });
});

// ── resources relocated to the bottom, fitting the width ────────────

test('resources sit at the bottom of an INV subtab and do not overflow the width', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'INV' }).click();

  // The resource row follows the item list in DOM order.
  const resourceAfterList = await page.locator('#pb-sheet-content').evaluate((el) => {
    const list = el.querySelector('[data-section-list]')!;
    const res = el.querySelector('.pb-resource-row')!;
    return !!(list.compareDocumentPosition(res) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(resourceAfterList).toBe(true);

  // The three boxes fit the content width — no horizontal overflow.
  const overflow = await page.locator('#pb-sheet-content').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
