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

/** Spend a SPECIAL plan of `[attr, +clicks]` pairs; the total must be 11. */
async function spend(page: Page, plan: Array<[string, number]>) {
  for (const [attr, times] of plan) {
    for (let i = 0; i < times; i++) {
      await page.locator(`[data-attr="${attr}"] button[data-dir="1"]`).click();
    }
  }
}

/** Spend step 2's 18 points exactly: seven attrs start at 1, so 11 remain.
 *  Leaves agility at 1 and endurance at 4, so PA derives to endurance/4. */
async function spendAllPoints(page: Page) {
  await spend(page, [
    ['strength', 3],
    ['perception', 3],
    ['endurance', 3],
    ['charisma', 2],
  ]);
  await expect(page.locator('#pb-cr-remaining')).toHaveText('0 rimasti');
}

/** Open the add-popup and pick a catalog skill by its display name. */
async function addCatalogSkill(page: Page, name: string) {
  await page.locator('[data-add-skill]').click();
  await page.locator('[data-open-existing]').click(); // opens the full-screen picker
  await page.locator(`[data-pick="${name}"]`).click(); // picks and closes the picker
  await page.locator('[data-ok]').click(); // confirms the add
}

// ── per-step validation ──────────────────────────────────────────────

test('AVANTI ▸ is disabled on a blank name', async ({ page }) => {
  await openWizard(page);

  await expect(page.locator('#pb-cr-counter')).toHaveText('1/5 · IDENTITÀ');
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

  await expect(page.locator('#pb-cr-counter')).toHaveText('2/5 · S.P.E.C.I.A.L.');
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

// ── five-step shell ──────────────────────────────────────────────────

test('the progress bar and counter track the current step', async ({ page }) => {
  await openWizard(page);
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();

  await expect(page.locator('#pb-cr-counter')).toHaveText('3/5 · TAG SKILLS');
  await expect(page.locator('.pb-progress-seg')).toHaveCount(5);
  await expect(page.locator('.pb-progress-seg.filled')).toHaveCount(3);
});

test('the PUNTI AZIONE MASSIMI step is absent; the five steps are as specified', async ({ page }) => {
  await openWizard(page);
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);

  await next(page).click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('3/5 · TAG SKILLS');
  await next(page).click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('4/5 · EQUIPAGGIAMENTO');
  await next(page).click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('5/5 · RIEPILOGO');

  await expect(page.getByText('PUNTI AZIONE MASSIMI')).toHaveCount(0);
});

test('every step renders an instruction block', async ({ page }) => {
  await openWizard(page);

  const hint = () => page.locator('#pb-cr-body .pb-hint').first();

  await expect(hint()).toBeVisible(); // 1 · IDENTITÀ
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();

  await expect(hint()).toBeVisible(); // 2 · S.P.E.C.I.A.L.
  await spendAllPoints(page);
  await next(page).click();

  await expect(hint()).toBeVisible(); // 3 · TAG SKILLS
  await next(page).click();

  await expect(hint()).toBeVisible(); // 4 · EQUIPAGGIAMENTO
  await next(page).click();

  await expect(hint()).toBeVisible(); // 5 · RIEPILOGO
});

// ── budget from the species catalog ──────────────────────────────────

test('the tag-skills budget is read from the species catalog: 4 for Umano, 3 otherwise', async ({ page }) => {
  await openWizard(page);

  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();
  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 0/4');

  // step back to identity and switch to Ghoul → budget 3
  await page.locator('#pb-cr-back').click();
  await page.locator('#pb-cr-back').click();
  await page.locator('[data-species="ghoul"]').click();
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

// ── Tag Skills add-flow ──────────────────────────────────────────────

async function reachSkillsStep(page: Page, species = 'human') {
  await page.locator(`[data-species="${species}"]`).click();
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('3/5 · TAG SKILLS');
}

test('the placeholder and the + control both open the add-popup', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page);

  await expect(page.locator('[data-add-skill-row]')).toBeVisible();
  await page.locator('[data-add-skill-row]').click();
  await expect(page.locator('.pb-popup')).toBeVisible();
  await page.locator('.pb-popup [data-cancel]').click();

  await page.locator('[data-add-skill]').click();
  await expect(page.locator('.pb-popup')).toBeVisible();
});

test('the catalog tab excludes already-added skills', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page);

  await addCatalogSkill(page, 'Scassinare');

  await page.locator('[data-add-skill]').click();
  await page.locator('[data-open-existing]').click();
  await expect(page.locator('[data-pick="Scassinare"]')).toHaveCount(0);
  await expect(page.locator('[data-pick="Scienza"]')).toBeVisible();
});

test('an added skill renders maestria squares, a stepper, and a remove control', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page);

  await addCatalogSkill(page, 'Scassinare'); // added at COMPETENTE (1 square)
  const row = page.locator('[data-skill-row="lockpicking"]');
  await expect(row.locator('.pb-pip.filled')).toHaveCount(1);

  // + steps up to ESPERTO (2 squares); − and ✕ are present
  await row.locator('[data-skill-inc="lockpicking"]').click();
  await expect(row.locator('.pb-pip.filled')).toHaveCount(2);
  await expect(row.locator('[data-skill-dec="lockpicking"]')).toBeVisible();
  await expect(row.locator('[data-remove-skill="lockpicking"]')).toBeVisible();

  // ✕ removes the skill, restoring the placeholder
  await row.locator('[data-remove-skill="lockpicking"]').click();
  await expect(page.locator('[data-skill-row="lockpicking"]')).toHaveCount(0);
  await expect(page.locator('[data-add-skill-row]')).toBeVisible();
});

test('the maestria readout updates as skills are added', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page); // Umano, budget 4

  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 0/4');
  await addCatalogSkill(page, 'Scassinare'); // COMPETENTE → cost 1
  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 1/4');
});

// ── advisory budget ──────────────────────────────────────────────────

test('the budget is advisory: over-budget keeps AVANTI ▸ enabled and CONTINUA advances', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page, 'ghoul'); // budget 3

  // two MAESTRO skills → cost 6, over the budget of 3
  await addCatalogSkill(page, 'Scassinare');
  await page.locator('[data-skill-inc="lockpicking"]').click();
  await page.locator('[data-skill-inc="lockpicking"]').click();
  await addCatalogSkill(page, 'Scienza');
  await page.locator('[data-skill-inc="science"]').click();
  await page.locator('[data-skill-inc="science"]').click();

  await expect(page.locator('#pb-cr-maestria')).toHaveText('MAESTRIA 6/3');
  await expect(next(page)).toBeEnabled();

  // forward raises a non-blocking confirm; CONTINUA advances to step 4
  await next(page).click();
  await expect(page.getByText('MAESTRIA OLTRE IL BUDGET (3)')).toBeVisible();
  await page.locator('[data-continue]').click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('4/5 · EQUIPAGGIAMENTO');
});

test('over-budget ANNULLA stays on the step', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page, 'ghoul'); // budget 3

  await addCatalogSkill(page, 'Scassinare');
  await page.locator('[data-skill-inc="lockpicking"]').click();
  await page.locator('[data-skill-inc="lockpicking"]').click();
  await addCatalogSkill(page, 'Scienza');
  await page.locator('[data-skill-inc="science"]').click();
  await page.locator('[data-skill-inc="science"]').click();

  await next(page).click();
  await page.locator('[data-cancel]').click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('3/5 · TAG SKILLS');
});

test('within-budget forward advances directly with no confirmation', async ({ page }) => {
  await openWizard(page);
  await reachSkillsStep(page); // Umano, budget 4

  await addCatalogSkill(page, 'Scassinare'); // cost 1, within budget
  await next(page).click();
  await expect(page.locator('#pb-cr-counter')).toHaveText('4/5 · EQUIPAGGIAMENTO');
});

// ── abandoning the wizard ────────────────────────────────────────────

test('abandoning the wizard before step 5 creates no character', async ({ page }) => {
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

// ── Equipaggiamento without scraps ───────────────────────────────────

test('step 4 lists starter templates from the catalog and offers no authoring', async ({ page }) => {
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

  await expect(page.locator('#pb-cr-counter')).toHaveText('4/5 · EQUIPAGGIAMENTO');
  expect(requested.some((u) => u.includes('starter=true'))).toBe(true);

  // two weapons, one armor in the stub set; the consumable is not pickable
  await expect(page.locator('#pb-cr-weapons .pb-equip-row')).toHaveCount(2);
  await expect(page.locator('#pb-cr-armors .pb-equip-row')).toHaveCount(1);
  await expect(page.getByText('Dotazione fissa: Stimpack incluso.')).toBeVisible();

  // no template-authoring controls
  await expect(page.locator('[data-add-item], [data-add-tag]')).toHaveCount(0);
});

test('step 4 shows no ROTTAMI INIZIALI row or scraps roll control', async ({ page }) => {
  await openWizard(page);
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click();
  await next(page).click();

  await expect(page.locator('#pb-cr-counter')).toHaveText('4/5 · EQUIPAGGIAMENTO');
  await expect(page.locator('#pb-cr-roll-scraps')).toHaveCount(0);
  await expect(page.locator('#pb-cr-scraps')).toHaveCount(0);
  await expect(page.getByText('ROTTAMI INIZIALI')).toHaveCount(0);
});

// ── submission ───────────────────────────────────────────────────────

async function completeWizard(page: Page, { keepsake = '' } = {}) {
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spendAllPoints(page);
  await next(page).click(); // step 3 · TAG SKILLS
  await addCatalogSkill(page, 'Scassinare');
  await page.locator('[data-skill-inc="lockpicking"]').click(); // COMPETENTE → ESPERTO
  await next(page).click(); // step 4 · EQUIPAGGIAMENTO

  await page.locator('[data-equip="pistola-10mm"]').click();
  await page.locator('[data-equip="giubbotto-di-pelle"]').click();
  if (keepsake) await page.locator('#pb-cr-keepsake').fill(keepsake);

  await next(page).click(); // step 5 · RIEPILOGO
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

  expect(reqs.patch('/skills')!.postDataJSON()).toEqual({
    items: [{ id: 'lockpicking', level: 'expert' }],
  });
});

// ── PA derivation ────────────────────────────────────────────────────

/** Fill identity + a SPECIAL plan, then step straight to create and submit. */
async function createWith(page: Page, plan: Array<[string, number]>) {
  await page.locator('#pb-cr-name').fill('Marta');
  await next(page).click();
  await spend(page, plan);
  await expect(page.locator('#pb-cr-remaining')).toHaveText('0 rimasti');
  await next(page).click(); // step 3
  await next(page).click(); // step 4
  await next(page).click(); // step 5
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();
}

test('PA derives to the higher of Agilità and Resistenza', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  // agility 3, endurance 2 → tracked by agility, paMax 3
  await createWith(page, [
    ['agility', 2],
    ['endurance', 1],
    ['strength', 3],
    ['perception', 3],
    ['charisma', 2],
  ]);

  expect(reqs.patch('/action-points')!.postDataJSON()).toEqual({
    paMax: 3,
    paCurrent: 3,
    paTrackedBy: 'agility',
  });
});

test('PA derivation resolves a tie to Agilità', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  // agility 2, endurance 2 → tie resolves to agility, paMax 2
  await createWith(page, [
    ['agility', 1],
    ['endurance', 1],
    ['strength', 3],
    ['perception', 3],
    ['intelligence', 3],
  ]);

  expect(reqs.patch('/action-points')!.postDataJSON()).toEqual({
    paMax: 2,
    paCurrent: 2,
    paTrackedBy: 'agility',
  });
});

test('PA tracks Resistenza when it is the higher stat', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  // spendAllPoints leaves agility 1, endurance 4 → tracked by endurance, paMax 4
  await completeWizard(page);
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  expect(reqs.patch('/action-points')!.postDataJSON()).toEqual({
    paMax: 4,
    paCurrent: 4,
    paTrackedBy: 'endurance',
  });
});

// ── inventory & resources ────────────────────────────────────────────

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

test('the starter stimpack is instantiated at quantity 1 and a blank keepsake adds no item', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page); // keepsake left blank
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  // Templates carry no quantity; instantiating a consumable always adds one.
  const inv = reqs.patch('/inventory')!.postDataJSON();
  expect(inv.consumables.items).toEqual([{ name: 'Stimpack', quantity: 1 }]);
  expect(inv).not.toHaveProperty('misc');
});

test('a non-blank keepsake is added to inventory.misc', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page, { keepsake: 'Foto di famiglia' });
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  const inv = reqs.patch('/inventory')!.postDataJSON();
  expect(inv.misc.items).toEqual([{ name: 'Foto di famiglia', quantity: 1 }]);
});

test('resources are seeded with scraps 0 and caps from luck', async ({ page }) => {
  await openWizard(page);
  const reqs = recordRequests(page);

  await completeWizard(page);
  await page.locator('#pb-cr-create').click();
  await expect(page.locator('#pb-sheet-header')).toBeVisible();

  const res = reqs.patch('/resources')!.postDataJSON();
  expect(res.caps).toBe(1); // luck stayed at its 1 floor
  expect(res.scraps).toBe(0); // starting scraps are always 0
});

// ── admin owner-picker ──────────────────────────────────────────────

test('an admin picks the owning player before the wizard, and the POST carries userId', async ({ page }) => {
  await openWizard(page, { role: 'admin', userId: 'user-admin' });
  const reqs = recordRequests(page);

  await expect(page.locator('[data-owner="user-player-2"]')).toBeVisible();
  await page.locator('[data-owner="user-player-2"]').click();

  await expect(page.locator('#pb-cr-counter')).toHaveText('1/5 · IDENTITÀ');
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

// ── post-create failure ──────────────────────────────────────────────

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

// ── single-campaign auto-select ─────────────────────────────────────

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
