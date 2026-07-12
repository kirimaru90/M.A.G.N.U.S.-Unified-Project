import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, seedDice } from './fixtures';

const SETTLE_MS = 900; // tumble is 9 ticks × 60ms ≈ 540ms

/**
 * `seedDice` must run before the app boots, so it is applied inside this helper
 * rather than after navigation.
 */
async function openDice(
  page: Page,
  { faces, character = {} }: { faces: number[]; character?: Record<string, unknown> },
) {
  await seedDice(page, faces);
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({
      id: 'char-1',
      campaignId: 'camp-1',
      userId: 'user-player',
      special: { strength: 3, perception: 3, endurance: 3, charisma: 3, intelligence: 3, agility: 3, luck: 3 },
      actionPoints: { paMax: 5, paCurrent: 3, paTrackedBy: 'agility' },
      ...character,
    }),
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
}

const rollAndSettle = async (page: Page) => {
  await page.locator('#pb-dice-roll').click();
  await page.waitForTimeout(SETTLE_MS);
};

// ── 7.T.1 pool composition ──────────────────────────────────────────

test('pool = approach + advantage + modifier, never below one die', async ({ page }) => {
  await openDice(page, { faces: [1] });

  // strength is 3
  await page.locator('[data-approach="strength"]').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('3d6');

  await page.locator('#pb-dice-adv').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('4d6');

  // +1 advantage, −2 modifier → 3 + 1 − 2 = 2
  await page.locator('#pb-dice-mod button[data-dir="-1"]').click();
  await page.locator('#pb-dice-mod button[data-dir="-1"]').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('2d6');

  // clamped to a minimum of one die
  for (let i = 0; i < 4; i++) await page.locator('#pb-dice-mod button[data-dir="-1"]').click();
  await expect(page.locator('#pb-dice-mod .value')).toHaveText('-6');
  await expect(page.locator('#pb-dice-pool')).toHaveText('1d6');
});

test('VANTAGGIO and SVANTAGGIO are mutually exclusive', async ({ page }) => {
  await openDice(page, { faces: [1] });

  await page.locator('#pb-dice-adv').click();
  await expect(page.locator('#pb-dice-adv')).toHaveClass(/active/);

  await page.locator('#pb-dice-dis').click();
  await expect(page.locator('#pb-dice-dis')).toHaveClass(/active/);
  await expect(page.locator('#pb-dice-adv')).not.toHaveClass(/active/);
});

test('the modifier stepper is bounded −6..+6', async ({ page }) => {
  await openDice(page, { faces: [1] });

  for (let i = 0; i < 6; i++) await page.locator('#pb-dice-mod button[data-dir="1"]').click();
  await expect(page.locator('#pb-dice-mod .value')).toHaveText('+6');
  await expect(page.locator('#pb-dice-mod button[data-dir="1"]')).toBeDisabled();

  for (let i = 0; i < 12; i++) await page.locator('#pb-dice-mod button[data-dir="-1"]').click();
  await expect(page.locator('#pb-dice-mod .value')).toHaveText('-6');
  await expect(page.locator('#pb-dice-mod button[data-dir="-1"]')).toBeDisabled();
});

test('the result box reads — TIRA I DADI — before any roll', async ({ page }) => {
  await openDice(page, { faces: [1] });
  await expect(page.locator('#pb-dice-result')).toHaveText('— TIRA I DADI —');
  await expect(page.locator('.pb-die')).toHaveCount(0);
});

// ── 7.T.2 outcome resolution ────────────────────────────────────────

const OUTCOMES: Array<[number[], string]> = [
  [[2, 6, 3], 'SUCCESSO PIENO'],
  [[2, 5, 3], 'SUCCESSO CON COSTO'],
  [[1, 2, 3], 'FALLIMENTO'],
];

for (const [faces, outcome] of OUTCOMES) {
  test(`a roll of [${faces}] resolves ${outcome}`, async ({ page }) => {
    await openDice(page, { faces });
    await page.locator('[data-approach="strength"]').click(); // 3-die pool
    await rollAndSettle(page);

    await expect(page.locator('#pb-dice-result')).toHaveText(outcome);
    await expect(page.locator('.pb-die')).toHaveCount(3);
  });
}

test('a 6 glows bright, 4/5 render plain, and 1–3 render dim', async ({ page }) => {
  await openDice(page, { faces: [6, 4, 1] });
  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);

  await expect(page.locator('.pb-die--full')).toHaveCount(1);
  await expect(page.locator('.pb-die--cost')).toHaveCount(1);
  await expect(page.locator('.pb-die--fail')).toHaveCount(1);
  await expect(page.locator('.pb-die--full')).toHaveCSS('color', 'rgb(170, 255, 192)');
});

// ── 7.T.3 svantaggio drops the highest die ──────────────────────────

test('SVANTAGGIO drops the highest die before evaluation and it is unselectable', async ({ page }) => {
  await openDice(page, { faces: [6, 4, 2] });
  await page.locator('[data-approach="strength"]').click();
  await page.locator('#pb-dice-dis').click();
  await rollAndSettle(page);

  // the 6 is dropped, so [4, 2] resolves as a costly success
  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO CON COSTO');

  const dropped = page.locator('.pb-die.dropped');
  await expect(dropped).toHaveCount(1);
  await expect(dropped).toHaveText('6');
  await expect(dropped).toHaveCSS('text-decoration-line', 'line-through');

  // a dropped die is a span, not a button, so it can never be selected
  await dropped.click();
  await expect(page.locator('#pb-dice-hint')).toContainText('0 selezionati');
});

// ── 7.T.4 PA refunds ────────────────────────────────────────────────

test('three sixes refund 2 PA via PATCH .../action-points', async ({ page }) => {
  await openDice(page, { faces: [6, 6, 6] });
  await page.locator('[data-approach="strength"]').click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/action-points') && r.method() === 'PATCH');
  await rollAndSettle(page);
  const req = await patchReq;

  // paCurrent 3 + refund 2 = 5, and paMax is 5
  expect(req.postDataJSON()).toEqual({ paCurrent: 5 });
  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
});

test('the refund is capped at paMax', async ({ page }) => {
  await openDice(page, {
    faces: [6, 6, 6],
    character: { actionPoints: { paMax: 6, paCurrent: 5, paTrackedBy: 'agility' } },
  });
  await page.locator('[data-approach="strength"]').click();

  const patchReq = page.waitForRequest((r) => r.url().includes('/action-points') && r.method() === 'PATCH');
  await rollAndSettle(page);

  expect((await patchReq).postDataJSON()).toEqual({ paCurrent: 6 });
});

test('a single six refunds nothing and issues no action-points request', async ({ page }) => {
  await openDice(page, { faces: [6, 2, 3] });
  await page.locator('[data-approach="strength"]').click();

  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') requests.push(r.url());
  });
  await rollAndSettle(page);

  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
  expect(requests.filter((u) => u.includes('/action-points'))).toEqual([]);
});

test('FORTUNA never refunds and shows its note', async ({ page }) => {
  await openDice(page, { faces: [6, 6, 6] });
  await page.locator('[data-approach="luck"]').click();

  await expect(page.locator('#pb-dice-fortuna')).toHaveText(
    'FORTUNA · il Rischio sale di un grado · nessun PA dai 6',
  );

  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') requests.push(r.url());
  });
  await rollAndSettle(page);

  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
  expect(requests.filter((u) => u.includes('/action-points'))).toEqual([]);
});

test('a dropped six does not count toward the refund', async ({ page }) => {
  await openDice(page, { faces: [6, 6, 2] });
  await page.locator('[data-approach="strength"]').click();
  await page.locator('#pb-dice-dis').click();

  const requests: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH') requests.push(r.url());
  });
  await rollAndSettle(page);

  // one 6 dropped, one 6 kept → sixes - 1 = 0
  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
  expect(requests.filter((u) => u.includes('/action-points'))).toEqual([]);
});

// ── 7.T.5 reroll ────────────────────────────────────────────────────

test('the reroll control is disabled without a skill, without dice, or at 0 PA', async ({ page }) => {
  await openDice(page, { faces: [1, 2, 3] });
  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);

  // a skill is chosen but no die is selected
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');
  await expect(page.locator('#pb-dice-reroll')).toBeDisabled();

  // a die is selected but no skill is chosen
  await page.locator('#pb-dice-reroll-skill').selectOption('');
  await page.locator('button[data-die="0"]').click();
  await expect(page.locator('#pb-dice-hint')).toContainText('1 selezionati');
  await expect(page.locator('#pb-dice-reroll')).toBeDisabled();

  // both → enabled
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');
  await expect(page.locator('#pb-dice-reroll')).toBeEnabled();
});

test('the reroll control is disabled at paCurrent 0', async ({ page }) => {
  await openDice(page, {
    faces: [1, 2, 3],
    character: { actionPoints: { paMax: 5, paCurrent: 0, paTrackedBy: 'agility' } },
  });
  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);

  await page.locator('button[data-die="0"]').click();
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');
  await expect(page.locator('#pb-dice-reroll')).toBeDisabled();
});

test('a reroll costs exactly 1 PA and never refunds, even on sixes', async ({ page }) => {
  // first three draws are the roll; the next wrap around to 6s for the reroll
  await openDice(page, { faces: [1, 2, 3, 6, 6, 6] });
  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);
  await expect(page.locator('#pb-dice-result')).toHaveText('FALLIMENTO');

  await page.locator('button[data-die="0"]').click();
  await page.locator('button[data-die="1"]').click();
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');

  const patches: Array<Record<string, unknown>> = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/action-points')) {
      patches.push(r.postDataJSON());
    }
  });

  await page.locator('#pb-dice-reroll').click();
  await page.waitForTimeout(SETTLE_MS);

  // paCurrent 3 → 2, and no refund follows even though the reroll shows sixes
  expect(patches).toEqual([{ paCurrent: 2 }]);
  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
});

// ── 7.T.6 register ──────────────────────────────────────────────────

test('the register records the expression and outcome, keeping only the last 8', async ({ page }) => {
  await openDice(page, { faces: [6, 2, 3] });
  await page.locator('[data-approach="perception"]').click();
  await page.locator('#pb-dice-mod button[data-dir="1"]').click(); // +1 → 4d6

  await rollAndSettle(page);
  await expect(page.locator('#pb-dice-register .pb-spend-row').first()).toContainText('P 4d6+1');
  await expect(page.locator('#pb-dice-register .pb-spend-row').first()).toContainText('PIENO');

  // roll eight more times: the register caps at eight rows
  for (let i = 0; i < 8; i++) await rollAndSettle(page);
  await expect(page.locator('#pb-dice-register .pb-spend-row')).toHaveCount(8);
});

test('the register is empty after reopening the sheet, and no roll is ever persisted', async ({ page }) => {
  await openDice(page, { faces: [6, 2, 3] });

  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);
  await expect(page.locator('#pb-dice-register .pb-spend-row')).toHaveCount(1);

  // the register survives a tab switch...
  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await expect(page.locator('#pb-dice-register .pb-spend-row')).toHaveCount(1);

  // ...but dies with the sheet
  await page.locator('#pb-nav-dossier').click();
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await expect(page.locator('#pb-dice-register')).toContainText('Nessun tiro');

  expect(requests.some((u) => u.includes('/dice') || u.includes('/roll'))).toBe(false);
});

// ── 7.T.4 tap-to-roll preselect + no mechanical maestria effect ─────

test('maestria has no mechanical effect on the pool size', async ({ page }) => {
  await openDice(page, {
    faces: [1],
    character: { skills: [{ id: 'lockpicking', level: 'master' }] },
  });

  // strength is 3, and a MAESTRO tag skill must not change that
  await page.locator('[data-approach="strength"]').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('3d6');
});

test('dice are not selectable mid-tumble', async ({ page }) => {
  await openDice(page, { faces: [1, 2, 3] });
  await page.locator('[data-approach="strength"]').click();

  await page.locator('#pb-dice-roll').click();
  // mid-tumble: every die button is disabled
  await expect(page.locator('.pb-die[disabled]').first()).toBeVisible();
  await expect(page.locator('#pb-dice-roll')).toBeDisabled();

  await page.waitForTimeout(SETTLE_MS);
  await expect(page.locator('.pb-die[disabled]')).toHaveCount(0);
  await expect(page.locator('#pb-dice-roll')).toBeEnabled();
});

// ── 7.T.7 display ordering + reroll animation scope ─────────────────

test('settled dice render highest→lowest for display', async ({ page }) => {
  await openDice(page, { faces: [3, 6, 1, 5] });
  await page.locator('[data-approach="strength"]').click(); // 3d6
  await page.locator('#pb-dice-mod button[data-dir="1"]').click(); // +1 → 4d6
  await rollAndSettle(page);

  // the roll order is [3, 6, 1, 5]; the settled grid reads it sorted descending
  await expect(page.locator('.pb-dice-grid .pb-die')).toHaveText(['6', '5', '3', '1']);
});

test('SVANTAGGIO drops the highest die, which sorts to the front and is unselectable', async ({ page }) => {
  await openDice(page, { faces: [4, 6, 2] });
  await page.locator('[data-approach="strength"]').click(); // 3d6
  await page.locator('#pb-dice-dis').click();
  await rollAndSettle(page);

  // the 6 (highest, dropped) sorts to the front of the descending display
  const dice = page.locator('.pb-dice-grid .pb-die');
  await expect(dice).toHaveText(['6', '4', '2']);
  await expect(dice.first()).toHaveClass(/dropped/);
  await expect(dice.first()).toHaveCSS('text-decoration-line', 'line-through');

  // a dropped die is a span, not a button, so tapping it selects nothing
  await dice.first().click();
  await expect(page.locator('#pb-dice-hint')).toContainText('0 selezionati');
});

test('a reroll animates only the selected die; the kept dice hold steady and the full pool resolves', async ({ page }) => {
  // four initial dice, then the fifth draw feeds the single rerolled die a 6
  await openDice(page, { faces: [1, 2, 3, 4, 6] });
  await page.locator('[data-approach="strength"]').click();
  await page.locator('#pb-dice-mod button[data-dir="1"]').click(); // +1 → 4d6
  await rollAndSettle(page);

  // settled display sorts 4,3,2,1; select the die showing 2 (original index 1).
  // Identity is index-keyed, so data-die stays 1 regardless of sorted position.
  await page.locator('button[data-die="1"]').click();
  await expect(page.locator('#pb-dice-hint')).toContainText('1 selezionati');
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');

  await page.locator('#pb-dice-reroll').click();

  // Mid-tumble the kept dice (original indices 0, 2, 3) hold their settled faces
  // while only the selected die flickers. data-die identity is stable, so these
  // hold before, during, and after the tumble.
  let sawTumble = false;
  for (let i = 0; i < 14; i++) {
    if (await page.locator('#pb-dice-roll').isDisabled()) sawTumble = true;
    await expect(page.locator('button[data-die="0"]')).toHaveText('1');
    await expect(page.locator('button[data-die="2"]')).toHaveText('3');
    await expect(page.locator('button[data-die="3"]')).toHaveText('4');
    await page.waitForTimeout(50);
  }
  expect(sawTumble).toBe(true);

  await page.waitForTimeout(SETTLE_MS);
  // the rerolled die lands a 6 → the full pool [1, 6, 3, 4] resolves as a full success
  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
});
