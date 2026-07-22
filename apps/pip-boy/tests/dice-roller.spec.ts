import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, seedDice, stubDeviceApis, readDevice, seedPrefs } from './fixtures';

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
  const stub = await stubEnvironment(page, {
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
  return stub;
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

test('the result box shows a dash before the first roll; a seeded roll then shows the outcome', async ({ page }) => {
  await openDice(page, { faces: [2, 6, 3] });
  await page.locator('[data-approach="strength"]').click(); // 3d6

  // Before any roll the result box is present at full opacity, showing a dash
  // that reserves the box's space without claiming a result exists.
  const result = page.locator('#pb-dice-result');
  await expect(result).toHaveCount(1);
  await expect(result).toHaveText('-');
  await expect(result).toHaveCSS('opacity', '1');

  // The idle grid previews the pool with placeholder dice, all showing 6.
  await expect(page.locator('.pb-die')).toHaveCount(3);
  await expect(page.locator('.pb-die--placeholder')).toHaveCount(3);
  const placeholderText = await page.locator('.pb-die--placeholder').allTextContents();
  expect(placeholderText).toEqual(['6', '6', '6']);

  await rollAndSettle(page);

  // Once the tumble settles the result box shows the resolved outcome.
  await expect(result).toHaveText('SUCCESSO PIENO');
  await expect(result).toHaveCSS('opacity', '1');
});

test('idle placeholder dice are non-interactive', async ({ page }) => {
  await openDice(page, { faces: [2, 6, 3] });
  await page.locator('[data-approach="strength"]').click(); // 3d6

  const placeholders = page.locator('.pb-die--placeholder');
  await expect(placeholders).toHaveCount(3);

  await placeholders.first().click();

  // Tapping a placeholder carries no reroll semantics — nothing is selected
  // and the placeholder styling stays exactly as it was.
  await expect(placeholders).toHaveCount(3);
  await expect(page.locator('#pb-dice-hint')).toHaveCount(0);
});

test('the idle placeholder count tracks pool-size changes before rolling', async ({ page }) => {
  await openDice(page, { faces: [1] });
  await page.locator('[data-approach="strength"]').click(); // 3d6
  await expect(page.locator('.pb-die--placeholder')).toHaveCount(3);

  await page.locator('#pb-dice-adv').click(); // VANTAGGIO: +1 → 4d6
  await expect(page.locator('#pb-dice-pool')).toHaveText('4d6');
  await expect(page.locator('.pb-die--placeholder')).toHaveCount(4);
});

test('placeholder dice never reappear after the first roll', async ({ page }) => {
  await openDice(page, { faces: [2, 6, 3] });
  await page.locator('[data-approach="strength"]').click(); // 3d6
  await rollAndSettle(page);

  await expect(page.locator('.pb-die--placeholder')).toHaveCount(0);
  await expect(page.locator('.pb-die')).toHaveCount(3);

  // Changing the pool-affecting controls afterward must not bring placeholders
  // back — the grid keeps showing the previous roll's real dice.
  await page.locator('#pb-dice-adv').click();
  await expect(page.locator('.pb-die--placeholder')).toHaveCount(0);
  await expect(page.locator('.pb-die')).toHaveCount(3);
});

test('a reroll holds the previous outcome in the result box until it settles', async ({ page }) => {
  await openDice(page, { faces: [1, 2, 3, 6] });
  await page.locator('[data-approach="strength"]').click(); // 3d6
  await rollAndSettle(page);
  await expect(page.locator('#pb-dice-result')).toHaveText('FALLIMENTO');

  await page.locator('button[data-die="0"]').click();
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');
  await page.locator('#pb-dice-reroll').click();

  // Mid-tumble the box keeps showing the previous outcome, unchanged.
  await expect(page.locator('#pb-dice-result')).toHaveText('FALLIMENTO');
  await expect(page.locator('#pb-dice-result')).toHaveCSS('opacity', '1');

  await page.waitForTimeout(SETTLE_MS);
  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
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

// ── haptic feedback while the dice tumble ───────────────────────────
// The vibration motor cannot be driven from a desktop browser, so these assert
// what the app *asks the platform to do*: navigator.vibrate is stubbed to record
// its calls. Whether the motor spins is a hardware fact no harness can observe.

const TUMBLE_PULSES = 9; // one per tumble tick

/** `openDice` seeds before boot, so the device stub and prefs must precede it. */
async function openDiceWithHaptics(
  page: Page,
  { faces, vibration = true, character = {} }: { faces: number[]; vibration?: boolean; character?: Record<string, unknown> },
) {
  await stubDeviceApis(page);
  await seedPrefs(page, { orientation: 'auto', vibration, wakeLock: false });
  return openDice(page, { faces, character });
}

const vibrations = async (page: Page) => (await readDevice(page)).vibrate;

test('a roll pulses once per tumble tick, and not after settling', async ({ page }) => {
  await openDiceWithHaptics(page, { faces: [1, 2, 3] });
  await page.locator('[data-approach="strength"]').click(); // 3d6
  await rollAndSettle(page);

  expect(await vibrations(page)).toHaveLength(TUMBLE_PULSES);

  // The rumble stops when the dice do: settling emits nothing further.
  await page.waitForTimeout(300);
  expect(await vibrations(page)).toHaveLength(TUMBLE_PULSES);
});

test('a larger pool rattles more strongly but for no longer', async ({ page }) => {
  await openDiceWithHaptics(page, { faces: [1, 2, 3, 4, 5] });

  // strength 3, −1 → 2d6
  await page.locator('[data-approach="strength"]').click();
  await page.locator('#pb-dice-mod button[data-dir="-1"]').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('2d6');
  await rollAndSettle(page);
  const twoDie = await vibrations(page);

  // +2 from there → 5d6
  for (let i = 0; i < 3; i++) await page.locator('#pb-dice-mod button[data-dir="1"]').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('5d6');
  await rollAndSettle(page);
  const fiveDie = (await vibrations(page)).slice(twoDie.length);

  // Duration is the only lever the API exposes — there is no amplitude control.
  expect(fiveDie[0]).toBeGreaterThan(twoDie[0]);
  // The tumble is nine ticks whatever the pool, so pool size varies the strength
  // of each pulse and never the length of the rattle.
  expect(twoDie).toHaveLength(TUMBLE_PULSES);
  expect(fiveDie).toHaveLength(TUMBLE_PULSES);
});

test('every pulse fits inside its 60ms tick, so consecutive pulses never cancel', async ({ page }) => {
  // A ten-die pool sits past the cap: 8 + 3×10 = 38, clamped at 40.
  await openDiceWithHaptics(page, { faces: [1] });
  await page.locator('[data-approach="strength"]').click();
  for (let i = 0; i < 6; i++) await page.locator('#pb-dice-mod button[data-dir="1"]').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('9d6');
  await rollAndSettle(page);

  for (const ms of await vibrations(page)) expect(ms).toBeLessThan(60);
});

test('a reroll pulses for the dice in flight, not for the whole pool', async ({ page }) => {
  // five initial dice, then the sixth and seventh draws feed the two rerolled dice
  await openDiceWithHaptics(page, { faces: [1, 2, 3, 4, 5, 6, 6] });
  await page.locator('[data-approach="strength"]').click();
  await page.locator('#pb-dice-mod button[data-dir="1"]').click();
  await page.locator('#pb-dice-mod button[data-dir="1"]').click();
  await expect(page.locator('#pb-dice-pool')).toHaveText('5d6');
  await rollAndSettle(page);
  const rollPulses = await vibrations(page);
  expect(rollPulses).toHaveLength(TUMBLE_PULSES);

  await page.locator('button[data-die="0"]').click();
  await page.locator('button[data-die="1"]').click();
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');
  await page.locator('#pb-dice-reroll').click();
  await page.waitForTimeout(SETTLE_MS);

  const rerollPulses = (await vibrations(page)).slice(rollPulses.length);
  expect(rerollPulses).toHaveLength(TUMBLE_PULSES);
  // Two dice in flight out of five: the rumble reports the reroll, not the pool.
  expect(rerollPulses[0]).toBeLessThan(rollPulses[0]);
});

test('vibration off issues no vibration request from a roll or a reroll', async ({ page }) => {
  await openDiceWithHaptics(page, { faces: [1, 2, 3, 6], vibration: false });
  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);
  expect(await vibrations(page)).toEqual([]);

  await page.locator('button[data-die="0"]').click();
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');
  await page.locator('#pb-dice-reroll').click();
  await page.waitForTimeout(SETTLE_MS);

  // Not "a request that does nothing" — no request at all.
  expect(await vibrations(page)).toEqual([]);
});

test('a seeded roll resolves identically with vibration on and off', async ({ page }) => {
  const readRoll = async (p: Page) => ({
    faces: await p.locator('.pb-dice-grid .pb-die').allTextContents(),
    order: await p.locator('.pb-dice-grid .pb-die').evaluateAll((els) => els.map((e) => e.getAttribute('data-die'))),
    outcome: await p.locator('#pb-dice-result').textContent(),
  });

  const patches: Array<Record<string, unknown>> = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes('/action-points')) patches.push(r.postDataJSON());
  });

  // Haptics are a side effect only: they must not perturb resolution, refunds or ordering.
  const { character } = await openDiceWithHaptics(page, { faces: [6, 2, 6], vibration: true });
  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);
  const withHaptics = await readRoll(page);
  expect((await vibrations(page)).length).toBe(TUMBLE_PULSES);
  const patchesWithHaptics = [...patches];

  // Replay the same seeded roll with vibration off. The stub character carries
  // the first roll's refund, so reset its PA — otherwise the second run starts
  // from a different paCurrent and the refunds are incomparable.
  patches.length = 0;
  (character as Record<string, unknown>).actionPoints = { paMax: 5, paCurrent: 3, paTrackedBy: 'agility' };
  // A later addInitScript applies from the next navigation on, so this overrides
  // the vibration-on seed installed by openDiceWithHaptics.
  await seedPrefs(page, { orientation: 'auto', vibration: false, wakeLock: false });
  await page.reload();
  await page.locator('.pb-tab', { hasText: 'DADI' }).click();
  await page.locator('[data-approach="strength"]').click();
  await rollAndSettle(page);
  const withoutHaptics = await readRoll(page);

  expect(await vibrations(page)).toEqual([]);
  expect(withoutHaptics).toEqual(withHaptics);
  expect(patches).toEqual(patchesWithHaptics);
});

test('a reroll holds every die in its settled cell during the tumble and re-sorts only after settling', async ({ page }) => {
  // initial four dice, then the fifth draw feeds the reroll a 6
  await openDice(page, { faces: [1, 2, 3, 4, 6] });
  await page.locator('[data-approach="strength"]').click();
  await page.locator('#pb-dice-mod button[data-dir="1"]').click(); // +1 → 4d6
  await rollAndSettle(page);

  // Settled display is sorted highest→lowest; each cell keeps its die identity
  // (data-die), so we track *positions* by the identity sequence, not by value.
  const dice = page.locator('.pb-dice-grid .pb-die');
  const cellOrder = () => dice.evaluateAll((els) => els.map((e) => e.getAttribute('data-die')));
  await expect(dice).toHaveText(['4', '3', '2', '1']);
  const settledOrder = await cellOrder();
  expect(settledOrder).toEqual(['3', '2', '1', '0']); // faces 4,3,2,1 by identity

  // Select the die showing 1 (identity index 0, in the last cell) and reroll it.
  await page.locator('button[data-die="0"]').click();
  await expect(page.locator('#pb-dice-hint')).toContainText('1 selezionati');
  await page.locator('#pb-dice-reroll-skill').selectOption('lockpicking');
  await page.locator('#pb-dice-reroll').click();

  // Sample the cell order synchronously for the whole tumble (auto-waiting
  // matchers would race past the ~540ms animation). Every mid-tumble sample must
  // equal the pre-reroll order: no die shifts cell, and the incoming 6 has NOT
  // jumped to the front, so the pool is not re-sorted mid-animation.
  //
  // Read the rolling flag and the order in ONE evaluate: split across two
  // round-trips the tumble can settle and re-sort between them, and the sample
  // then reads the post-settle order while still believing it is mid-tumble.
  const sample = () => page.evaluate(() => ({
    rolling: (document.querySelector('#pb-dice-roll') as HTMLButtonElement).disabled,
    order: [...document.querySelectorAll('.pb-dice-grid .pb-die')].map((e) => e.getAttribute('data-die')),
  }));

  const samples: (string | null)[][] = [];
  for (let i = 0; i < 120; i++) {
    const { rolling, order } = await sample();
    if (rolling) {
      samples.push(order);
    } else if (samples.length > 0) {
      break; // settled, after we captured the tumble
    }
    await page.waitForTimeout(8);
  }
  expect(samples.length).toBeGreaterThan(0);
  for (const order of samples) expect(order).toEqual(settledOrder);

  await page.waitForTimeout(SETTLE_MS);
  // Only after settling is the pool re-sorted: the rerolled 6 moves to the front.
  await expect(dice).toHaveText(['6', '4', '3', '2']);
  expect(await cellOrder()).toEqual(['0', '3', '2', '1']);
  await expect(page.locator('#pb-dice-result')).toHaveText('SUCCESSO PIENO');
});
