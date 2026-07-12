import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, type StubOptions } from './fixtures';

const TAB_LABELS = ['S.P.E', 'ABIL', 'SALUTE', 'ZAINO', 'DADI'];

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

// ── 5.T.1 tabs, underline, footer ───────────────────────────────────

test('exactly five tabs plus one ✎ toggle, with the active tab underlined', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await expect(page.locator('.pb-tab[data-tab]')).toHaveCount(5);
  await expect(page.locator('.pb-tab[data-tab]')).toHaveText(TAB_LABELS);
  await expect(page.locator('#pb-editor-toggle')).toHaveCount(1);

  const active = page.locator('.pb-tab.active');
  await expect(active).toHaveText('S.P.E');

  // The underline is a 2px glowing ::after, not an inset box-shadow.
  const underline = await active.evaluate((el) => {
    const cs = getComputedStyle(el, '::after');
    return { height: cs.height, boxShadow: cs.boxShadow, content: cs.content };
  });
  expect(underline.height).toBe('2px');
  expect(underline.boxShadow).toContain('rgb(51, 255, 102)');
});

test('the footer tracks the active tab, caps, and shows an HH:MM clock', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await expect(page.locator('#pb-footer-tab')).toHaveText('S.P.E');
  await expect(page.locator('#pb-footer-caps')).toHaveText('TAPPI 10');
  await expect(page.locator('#pb-footer-clock')).toHaveText(/^\d{2}:\d{2}$/);

  await page.locator('.pb-tab', { hasText: 'ZAINO' }).click();
  await expect(page.locator('#pb-footer-tab')).toHaveText('ZAINO');
});

test('the header shows a species chip and the PA source line', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await expect(page.locator('.pb-species-chip')).toHaveText('human');
  await expect(page.locator('#pb-sheet-header')).toContainText('PA · AGILITÀ');
  await expect(page.locator('#pb-sheet-header')).toContainText('PUNTI AZIONE');
});

// ── 5.T.3 editor mode is view state ─────────────────────────────────

test('editor mode is off again after leaving and reopening the sheet', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('.pb-editor-strip')).toBeVisible();

  await page.locator('#pb-nav-dossier').click();
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();

  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await expect(page.locator('.pb-editor-strip')).toHaveCount(0);
  await expect(page.locator('.pb-approach-row')).toHaveCount(7);
});

test('the ◉ EDITOR strip appears only while editor mode is on', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await expect(page.locator('.pb-editor-strip')).toHaveCount(0);
  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('.pb-editor-strip')).toContainText(
    '◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti',
  );
  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('.pb-editor-strip')).toHaveCount(0);
});

// ── 5.T.4 tap-to-roll ───────────────────────────────────────────────

test('tapping the PERCEZIONE approach row opens DADI with it preselected', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });

  await page.locator('.pb-approach-row[data-approach="perception"]').click();

  await expect(page.locator('.pb-tab.active')).toHaveText('DADI');
  // the DADI tab's approach picker shows PERCEZIONE selected, and sizes the pool from it
  await expect(page.locator('#pb-dice-approaches .pb-seg.active')).toHaveText('P');
  await expect(page.locator('#pb-dice-pool')).toHaveText('3d6');
});

// ── 5.T.5 net wear ──────────────────────────────────────────────────

test('VALORE NETTO reads 3 and renders amber, with negatives sorted above positives', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      status: {
        criticalState: false,
        negativeConditions: [
          { id: 'n1', name: 'FERITO', severity: 'major' },
          { id: 'n2', name: 'STREMATO', severity: 'major' },
        ],
        positiveConditions: [{ id: 'p1', name: 'BEN NUTRITO', severity: 'minor' }],
      },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  // 2 + 2 − 1 = 3
  await expect(page.locator('#pb-net-value')).toHaveText('3');
  await expect(page.locator('#pb-net-value')).toHaveClass(/amber/);
  await expect(page.locator('#pb-net-value')).toHaveCSS('color', 'rgb(255, 176, 46)');

  const names = await page.locator('.pb-cond-name').allInnerTexts();
  expect(names).toEqual(['FERITO', 'STREMATO', 'BEN NUTRITO']);

  await expect(page.locator('.pb-cond-row').first()).toContainText('MODERATA ×2');
  await expect(page.locator('.pb-cond-row').last()).toContainText('BASE');
});

test('an empty condition list renders the dashed empty state', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  const empty = page.locator('.pb-empty-dashed');
  await expect(empty).toHaveText('nessuna condizione attiva');
  await expect(empty).toHaveCSS('border-style', 'dashed');
  await expect(page.locator('#pb-net-value')).toHaveText('0');
});

// ── 5.T.6 critical threshold ────────────────────────────────────────

test('crossing net wear to 4 persists criticalState and banners every tab', async ({ page }) => {
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

  // Add a `major` negative: net wear 2 → 4, which is the critical threshold.
  await page.locator('#pb-cond-name').fill('IRRADIATO');
  await page.locator('[data-weight="major"]').click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('#pb-cond-add').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toMatchObject({ criticalState: true });
  await expect(page.locator('#pb-net-value')).toHaveText('4');

  // The banner rides above the content on every tab, not just SALUTE.
  for (const label of TAB_LABELS) {
    await page.locator('.pb-tab', { hasText: label }).click();
    await expect(page.locator('.pb-banner-critical')).toContainText(
      '⚠ STATO CRITICO — NON PUOI AGIRE',
    );
  }
  await expect(page.locator('#pb-critical-ring')).toBeVisible();
});

test('the critical banner takes precedence over the editor strip', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      status: { criticalState: true, negativeConditions: [], positiveConditions: [] },
    }),
  });

  await page.locator('#pb-editor-toggle').click();
  await expect(page.locator('.pb-banner-critical')).toBeVisible();
  await expect(page.locator('.pb-editor-strip')).toHaveCount(0);
});

// ── 5.T.7 conditions-catalog fallback ───────────────────────────────

test('a conditions-catalog fetch failure falls back to the hardcoded presets', async ({ page }) => {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: ownedCharacter(),
  });
  await page.route('**/conditions-catalog', (route) => route.fulfill({ status: 500, body: '{}' }));

  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  const presets = page.locator('[data-preset]');
  await expect(presets).toHaveCount(7);
  await expect(page.locator('[data-preset="ferito"]')).toContainText('FERITO');
  await expect(page.locator('[data-preset="in-down"]')).toBeVisible();
});

test('a catalog preset routes by polarity', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  // The stub catalog's `well-fed` entry is positive, `poisoned` is negative.
  const positiveReq = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('[data-preset="well-fed"]').click();
  expect((await positiveReq).postDataJSON()).toMatchObject({
    positiveConditions: { items: [{ name: 'Ben Nutrito', severity: 'minor' }] },
  });

  const negativeReq = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('[data-preset="poisoned"]').click();
  expect((await negativeReq).postDataJSON()).toMatchObject({
    negativeConditions: { items: [{ name: 'Avvelenato', severity: 'major' }] },
  });
});

test('tapping a condition row removes it', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      status: {
        criticalState: false,
        negativeConditions: [{ id: 'n1', name: 'FERITO', severity: 'minor' }],
        positiveConditions: [],
      },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');
  await page.locator('[data-remove-condition="n1"]').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({
    negativeConditions: { deletedIds: ['n1'] },
    criticalState: false,
  });
  await expect(page.locator('.pb-empty-dashed')).toBeVisible();
});

// ── 5.T.8 gear chips ────────────────────────────────────────────────

const taggedWeapon = {
  id: 'w1',
  name: 'Pistola 10mm',
  broken: false,
  tags: [
    { name: 'PROIETTILI', type: 'core', damaged: false },
    { name: 'AFFIDABILE', type: 'extra', damaged: false },
  ],
};

test('core and extra chips render with distinct border styles', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      inventory: { weapons: [taggedWeapon], equip: [], consumables: [], other: [] },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'ZAINO' }).click();

  const core = page.locator('.pb-chip--core').first();
  const extra = page.locator('.pb-chip--extra').first();

  await expect(core).toHaveCSS('border-style', 'solid');
  await expect(extra).toHaveCSS('border-style', 'dashed');
  // core is tinted, extra is unfilled
  await expect(extra).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(core).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('tapping a tag chip in view mode marks it damaged and shows DANNEGGIATA', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      inventory: { weapons: [taggedWeapon], equip: [], consumables: [], other: [] },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'ZAINO' }).click();

  await expect(page.locator('.pb-danger-tag')).toHaveCount(0);

  const patchReq = page.waitForRequest((r) => r.url().includes('/inventory') && r.method() === 'PATCH');
  await page.locator('[data-toggle-tag="w1"][data-index="0"]').click();
  const req = await patchReq;

  expect(req.postDataJSON().weapons.items[0].tags[0]).toMatchObject({
    name: 'PROIETTILI',
    damaged: true,
  });
  await expect(page.locator('.pb-danger-tag')).toHaveText('DANNEGGIATA');
  await expect(page.locator('.pb-chip.damaged').first()).toBeVisible();
});

test('tag add and remove controls appear only in editor mode', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      inventory: { weapons: [taggedWeapon], equip: [], consumables: [], other: [] },
    }),
  });
  await page.locator('.pb-tab', { hasText: 'ZAINO' }).click();

  await expect(page.locator('[data-add-tag]')).toHaveCount(0);
  await expect(page.locator('[data-remove-tag]')).toHaveCount(0);

  await page.locator('#pb-editor-toggle').click();

  await expect(page.locator('[data-add-tag][data-type="core"]')).toHaveCount(1);
  await expect(page.locator('[data-add-tag][data-type="extra"]')).toHaveCount(1);
  await expect(page.locator('[data-remove-tag]')).toHaveCount(2);
});

// ── 5.T.10 lowering MAX PA clamps paCurrent ─────────────────────────

test('lowering MAX PA beneath paCurrent clamps and persists paCurrent', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      actionPoints: { paMax: 5, paCurrent: 5, paTrackedBy: 'agility' },
    }),
  });
  await page.locator('#pb-editor-toggle').click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/action-points') && r.method() === 'PATCH');
  await page.locator('#pb-pa-max-stepper button[data-dir="-1"]').click();
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({ paMax: 4, paCurrent: 4 });
  await expect(page.locator('#pb-pa-pips .pb-pip')).toHaveCount(4);
  await expect(page.locator('#pb-pa-stepper .value')).toHaveText('4');
});

test('changing FONTE PA persists paTrackedBy and updates the header line', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('#pb-editor-toggle').click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/action-points') && r.method() === 'PATCH');
  await page.locator('#pb-pa-source').selectOption('endurance');
  const req = await patchReq;

  expect(req.postDataJSON()).toEqual({ paTrackedBy: 'endurance' });
  await expect(page.locator('#pb-sheet-header')).toContainText('PA · RESISTENZA');
});

test('SPECIAL steppers are bounded 1..5', async ({ page }) => {
  await openSheet(page, {
    character: ownedCharacter({
      special: { strength: 5, perception: 1, endurance: 3, charisma: 3, intelligence: 3, agility: 3, luck: 3 },
    }),
  });
  await page.locator('#pb-editor-toggle').click();

  await expect(page.locator('[data-key="strength"] button[data-dir="1"]')).toBeDisabled();
  await expect(page.locator('[data-key="strength"] button[data-dir="-1"]')).toBeEnabled();
  await expect(page.locator('[data-key="perception"] button[data-dir="-1"]')).toBeDisabled();
  await expect(page.locator('[data-key="perception"] button[data-dir="1"]')).toBeEnabled();
});

test('the SPESA PA block is never editable', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'ABIL' }).click();
  await page.locator('#pb-editor-toggle').click();

  const spend = page.locator('#pb-pa-spend');
  await expect(spend).toContainText('RITIRA FALLITI');
  await expect(spend).toContainText('RUBA LA SCENA');
  await expect(spend).toContainText('V.A.T.S.');
  await expect(spend.locator('input, select, button')).toHaveCount(0);
});
