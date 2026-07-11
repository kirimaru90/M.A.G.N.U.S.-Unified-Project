import { test, expect, type Page, type Request } from '@playwright/test';
import { stubEnvironment, login, TWO_CAMPAIGNS, type StubOptions } from './fixtures';

/** Every write the wizard issues, so we can assert what was (and wasn't) sent. */
function recordRequests(page: Page) {
  const seen: Request[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' || r.method() === 'PATCH') seen.push(r);
  });
  return {
    posts: () =>
      seen.filter((r) => r.method() === 'POST' && /\/characters$/.test(new URL(r.url()).pathname)),
    patch: (fragment: string) =>
      seen.find((r) => r.method() === 'PATCH' && r.url().includes(fragment)),
  };
}

async function openWizard(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, { characters: [], ...opts });
  await login(page);
  await expect(page.locator('#pb-char-list')).toBeVisible();
  await page.locator('#pb-char-create').click();
}

const next = (page: Page) => page.locator('#pb-cr-next');

/** Spend step 2's 18 points exactly: seven attrs start at 1, so 11 remain. */
async function spendAllPoints(page: Page) {
  const plan: Array<[string, number]> = [
    ['strength', 3],
    ['perception', 3],
    ['endurance', 3],
    ['charisma', 2],
  ];
  for (const [attr, times] of plan) {
    for (let i = 0; i < times; i++) {
      await page.locator(`[data-attr="${attr}"] button[data-dir="1"]`).click();
    }
  }
  await expect(page.locator('#pb-cr-remaining')).toHaveText('0 rimasti');
}

// ── 6.T.1 / 6.T.3 per-step validation ───────────────────────────────

test('AVANTI ▸ is disabled on a blank name', async ({ page }) => {
  await openWizard(page);

  await expect(page.locator('#pb-cr-counter')).toHaveText('1/6 · IDENTITÀ');
  await expect(next(page)).toBeDisabled();

  await page.locator('#pb-cr-name').fill('   ');
  await expect(next(page)).toBeDisabled();

  await page.locator('#pb-cr-name').fill('Marta');
  await expect(next(page)).toBeEnabled();
});

test('attributes start at 1 with 11 rimasti; + disables at 4 and at 0 remaining', async ({ page }) => {
  await openWizard(page);
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();

  await expect(page.locator('#pb-cr-counter')).toHaveText('2/6 · S.P.E.C.I.A.L.');
  await expect(page.locator('#pb-cr-remaining')).toHaveText('11 rimasti');
  await expect(page.locator('#pb-cr-remaining')).toHaveClass(/amber/);
  await expect(next(page)).toBeDisabled();

  // − is disabled at the 1 floor
  await expect(page.locator('[data-attr="strength"] button[data-dir="-1"]')).toBeDisabled();

  // raise strength to the 4 ceiling
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-attr="strength"] button[data-dir="1"]').click();
  }
  await expect(page.locator('[data-attr="strength"] .value')).toHaveText('4');
  await expect(page.locator('[data-attr="strength"] button[data-dir="1"]')).toBeDisabled();
  await expect(page.locator('[data-attr="strength"] button[data-dir="-1"]')).toBeEnabled();

  // spend the rest: every + disables at 0 remaining, but − stays live
  for (let i = 0; i < 3; i++) await page.locator('[data-attr="perception"] button[data-dir="1"]').click();
  for (let i = 0; i < 3; i++) await page.locator('[data-attr="endurance"] button[data-dir="1"]').click();
  for (let i = 0; i < 2; i++) await page.locator('[data-attr="charisma"] button[data-dir="1"]').click();

  await expect(page.locator('#pb-cr-remaining')).toHaveText('0 rimasti');
  await expect(page.locator('#pb-cr-remaining')).toHaveClass(/zero/);

  // Exhausting the points disables every `+`, but never a `−`. (`luck` sits at
  // its 1 floor, so only the min clamp disables that row's `−`.)
  await expect(page.locator('[data-attr="luck"] button[data-dir="1"]')).toBeDisabled();
  await expect(page.locator('[data-attr="endurance"] button[data-dir="1"]')).toBeDisabled();
  await expect(page.locator('[data-attr="endurance"] button[data-dir="-1"]')).toBeEnabled();
  await expect(next(page)).toBeEnabled();
});

// ── 6.T.2 budget comes from the species catalog ─────────────────────

test('the step-4 budget is read from the species catalog: 4 for Umano, 3 otherwise', async ({ page }) => {
  await openWizard(page);

  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();
  await next(page).click();
  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 0/4');

  // step back to identity and switch to Ghoul → budget 3
  await page.locator('#pb-cr-back').click();
  await page.locator('#pb-cr-back').click();
  await page.locator('#pb-cr-back').click();
  await page.locator('[data-species="ghoul"]').click();
  await next(page).click();
  await next(page).click();
  await next(page).click();
  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 0/3');
});

test('the info box shows the selected species permesso and svantaggio', async ({ page }) => {
  await openWizard(page);

  await expect(page.locator('.pb-species-option')).toHaveCount(4);
  await expect(page.locator('.pb-info-perm')).toContainText('Versatilità completa.');

  await page.locator('[data-species="ghoul"]').click();
  await expect(page.locator('.pb-info-perm')).toContainText('Immune alle radiazioni.');
  await expect(page.locator('.pb-info-svan')).toContainText('Inviso agli umani.');
  await expect(page.locator('.pb-info-svan')).toHaveCSS('color', 'rgb(255, 176, 46)');
});

// ── 6.T.1 duplicate / over-budget warnings ──────────────────────────

async function reachSkillsStep(page: Page, species = 'human') {
  await page.locator(`[data-species="${species}"]`).click();
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();
  await next(page).click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('4/6 · TAG SKILLS');
}

test('duplicate skills block progress with ABILITÀ DUPLICATE', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page);

  await page.locator('[data-skill-slug="0"]').selectOption('lockpicking');
  await page.locator('[data-skill-level="0"] [data-level="competent"]').click();
  await page.locator('[data-skill-slug="1"]').selectOption('lockpicking');
  await page.locator('[data-skill-level="1"] [data-level="competent"]').click();

  await expect(page.locator('#pb-cr-warning')).toHaveText('ABILITÀ DUPLICATE');
  await expect(next(page)).toBeDisabled();
});

test('exceeding the budget blocks progress with MAESTRIA OLTRE IL BUDGET (N)', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page, 'ghoul'); // budget 3

  await page.locator('[data-skill-slug="0"]').selectOption('lockpicking');
  await page.locator('[data-skill-level="0"] [data-level="master"]').click();
  await page.locator('[data-skill-slug="1"]').selectOption('science');
  await page.locator('[data-skill-level="1"] [data-level="master"]').click();

  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 6/3');
  await expect(page.locator('#pb-cr-warning')).toHaveText('MAESTRIA OLTRE IL BUDGET (3)');
  await expect(next(page)).toBeDisabled();
});

test('a row cleared with «—» costs nothing', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page, 'ghoul');

  await page.locator('[data-skill-slug="0"]').selectOption('lockpicking');
  await page.locator('[data-skill-level="0"] [data-level="master"]').click();
  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 3/3');

  await page.locator('[data-skill-level="0"] [data-level=""]').click();
  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 0/3');
  await expect(next(page)).toBeEnabled();
});

// ── 6.T.4 abandoning the wizard ─────────────────────────────────────

test('abandoning the wizard before step 6 creates no character', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();

  // ◄ INDIETRO out of step 1 exits to the dossier
  await page.locator('#pb-cr-back').click();
  await page.locator('#pb-cr-back').click();
  await page.locator('#pb-cr-back').click();

  await expect(page.locator('#pb-char-list')).toBeVisible();
  expect(reqs.posts()).toHaveLength(0);
});

test('the progress bar and counter track the current step', async ({ page }) => {
  await openWizard(page);
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();

  await expect(page.locator('#pb-cr-counter')).toHaveText('3/6 · PUNTI AZIONE MASSIMI');
  await expect(page.locator('.pb-progress-seg')).toHaveCount(6);
  await expect(page.locator('.pb-progress-seg.filled')).toHaveCount(3);
});

// ── step 3 PA panels ────────────────────────────────────────────────

test('step 3 panels show the step-2 values and preview PA MASSIMI', async ({ page }) => {
  await openWizard(page);
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page); // agility stays 1, endurance becomes 4
  await next(page).click();

  await expect(page.locator('[data-pa="agility"] .pb-pa-panel-value')).toHaveText('1');
  await expect(page.locator('[data-pa="endurance"] .pb-pa-panel-value')).toHaveText('4');
  await expect(page.locator('#pb-cr-pamax')).toHaveText('1'); // agility is the default

  await page.locator('[data-pa="endurance"]').click();
  await expect(page.locator('#pb-cr-pamax')).toHaveText('4');
});

// ── step 5 equipment ────────────────────────────────────────────────

test('step 5 lists starter templates from the catalog and offers no authoring', async ({ page }) => {
  const requested: string[] = [];
  await stubEnvironment(page, { characters: [] });
  page.on('request', (r) => {
    if (r.url().includes('equipment-catalog')) requested.push(r.url());
  });
  await login(page);
  await page.locator('#pb-char-create').click();

  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();
  await next(page).click();
  await next(page).click();

  await expect(page.locator('#pb-cr-counter')).toHaveText('5/6 · EQUIPAGGIAMENTO');
  expect(requested.some((u) => u.includes('starter=true'))).toBe(true);

  // two weapons, one armor in the stub set; the consumable is not pickable
  await expect(page.locator('#pb-cr-weapons .pb-equip-row')).toHaveCount(2);
  await expect(page.locator('#pb-cr-armors .pb-equip-row')).toHaveCount(1);
  await expect(page.getByText('Dotazione fissa: 2 Stimpack inclusi.')).toBeVisible();

  // no template-authoring controls
  await expect(page.locator('[data-add-item], [data-add-tag]')).toHaveCount(0);
});

test('rolling ROTTAMI INIZIALI yields a value between 1 and 6', async ({ page }) => {
  await openWizard(page);
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();
  await next(page).click();
  await next(page).click();

  await expect(page.locator('#pb-cr-scraps')).toHaveText('0');
  await page.locator('#pb-cr-roll-scraps').click();

  const value = Number(await page.locator('#pb-cr-scraps').innerText());
  expect(value).toBeGreaterThanOrEqual(1);
  expect(value).toBeLessThanOrEqual(6);
});

// ── 6.T.5 / 6.T.6 / 6.T.7 submission ────────────────────────────────

async function completeWizard(page: Page, { keepsake = '' } = {}) {
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click(); // step 3
  await next(page).click(); // step 4
  await page.locator('[data-skill-slug="0"]').selectOption('lockpicking');
  await page.locator('[data-skill-level="0"] [data-level="expert"]').click();
  await next(page).click(); // step 5

  await page.locator('[data-equip="pistola-10mm"]').click();
  await page.locator('[data-equip="giubbotto-di-pelle"]').click();
  await page.locator('#pb-cr-roll-scraps').click();
  if (keepsake) await page.locator('#pb-cr-keepsake').fill(keepsake);

  await next(page).click(); // step 6
  await expect(page.locator('#pb-cr-create')).toHaveText('✓ CREA PERSONAGGIO');
}

test('submitting creates the character, opens its sheet, and derives species talents', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page);
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  const post = reqs.posts()[0];
  expect(post.postDataJSON()).toEqual({ name: 'Marta', species: 'human' });
  // a player omits userId and owns the character
  expect(post.postDataJSON()).not.toHaveProperty('userId');

  expect(reqs.patch('/perks')!.postDataJSON()).toEqual({
    items: [
      { name: 'SPECIE · Umano', description: 'Versatilità completa.' },
      { name: 'SVANTAGGIO', description: 'Nessun talento sovrannaturale.' },
    ],
  });

  expect(reqs.patch('/action-points')!.postDataJSON()).toEqual({
    paMax: 1,
    paCurrent: 1,
    paTrackedBy: 'agility',
  });

  expect(reqs.patch('/skills')!.postDataJSON()).toEqual({
    items: [{ id: 'lockpicking', level: 'expert' }],
  });
});

test('a selected starter weapon is copied with its tags and no catalog slug', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page);
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  const inv = reqs.patch('/inventory')!.postDataJSON();

  expect(inv.weapons.items[0]).toEqual({
    name: 'Pistola 10mm',
    tags: [
      { name: 'PROIETTILI', type: 'core', damaged: false },
      { name: 'AFFIDABILE', type: 'extra', damaged: false },
    ],
  });
  expect(inv.weapons.items[0]).not.toHaveProperty('slug');

  expect(inv.equip.items[0].name).toBe('Giubbotto di Pelle');
  expect(inv.equip.items[0]).not.toHaveProperty('slug');
});

test('the starter stimpack is instantiated at quantity 2 and a blank keepsake adds no item', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page); // keepsake left blank
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  const inv = reqs.patch('/inventory')!.postDataJSON();
  expect(inv.consumables.items).toEqual([{ name: 'Stimpack', quantity: 2 }]);
  expect(inv).not.toHaveProperty('other');
});

test('a non-blank keepsake is added to inventory.other', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page, { keepsake: 'Foto di famiglia' });
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  const inv = reqs.patch('/inventory')!.postDataJSON();
  expect(inv.other.items).toEqual([{ name: 'Foto di famiglia', quantity: 1 }]);
});

test('resources are seeded with the rolled scraps and caps from luck', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page);
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  const res = reqs.patch('/resources')!.postDataJSON();
  expect(res.caps).toBe(1); // luck stayed at its 1 floor
  expect(res.scraps).toBeGreaterThanOrEqual(1);
  expect(res.scraps).toBeLessThanOrEqual(6);
});

// ── admin owner-picker ──────────────────────────────────────────────

test('an admin picks the owning player before the wizard, and the POST carries userId', async ({ page }) => {
  await openWizard(page, { role: 'admin', userId: 'user-admin' });
  const reqs = recordRequests(page);

  await expect(page.locator('[data-owner="user-player-2"]')).toBeVisible();
  await page.locator('[data-owner="user-player-2"]').click();

  await expect(page.locator('#pb-cr-counter')).toHaveText('1/6 · IDENTITÀ');
  await completeWizard(page);
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  expect(reqs.posts()[0].postDataJSON()).toMatchObject({ userId: 'user-player-2' });
});

test('admin creation is blocked when the campaign has no assigned players', async ({ page }) => {
  await openWizard(page, { role: 'admin', userId: 'user-admin', players: [] });

  await expect(page.getByText(/Nessun giocatore assegnato/)).toBeVisible();
  await expect(page.locator('#pb-cr-counter')).toHaveCount(0);
});

// ── 6.9 post-create failure ─────────────────────────────────────────

test('a post-create failure shows a terminal-voiced error and opens the sheet anyway', async ({ page }) => {
  await openWizard(page);
  await page.route(/\/characters\/[^/]+\/special$/, (route) => route.fulfill({ status: 500, body: '{}' }));

  await completeWizard(page);
  await page.locator('#pb-cr-create').click();

  await expect(page.locator('#pb-sheet-header')).toBeVisible();
  await expect(page.locator('#pb-sheet-warning')).toContainText(
    'ERRORE — personaggio creato, dati incompleti',
  );
});

// ── 6.T.8 single-campaign auto-select ───────────────────────────────

test('a lone accessible campaign auto-selects without showing the picker', async ({ page }) => {
  await stubEnvironment(page);
  await login(page);

  await expect(page.locator('#pb-char-list')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toHaveCount(0);
});

test('two campaigns render the picker', async ({ page }) => {
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await login(page);

  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toBeVisible();
  await expect(page.getByText('Vault 88')).toBeVisible();
});

// ── dossier empty state ─────────────────────────────────────────────

test('an empty dossier shows the dashed NESSUN DOSSIER REGISTRATO box', async ({ page }) => {
  await stubEnvironment(page, { characters: [] });
  await login(page);

  const empty = page.locator('#pb-dossier-empty');
  await expect(empty).toContainText('NESSUN DOSSIER REGISTRATO');
  await expect(empty).toContainText('Crea il tuo primo personaggio.');
  await expect(empty).toHaveCSS('border-style', 'dashed');
  await expect(page.locator('#pb-char-create')).toHaveText('+ NUOVO PERSONAGGIO');
});
