import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, gotoTab, type StubOptions } from './fixtures';

// End-to-end coverage of INFO › Quest (pipboy-quests): status grouping with the
// collapsed COMPLETATE group, row markers, the in-pane detail with its REGISTRO
// timeline, and the device-local AGGIORNATA badge. The API is mocked with the
// already-projected shape, so these specs exercise rendering only.

const SEEN_KEY = 'pb.quests.seen.camp-1.char-1';

type Stage = {
  id: string;
  title: string;
  description?: string | null;
  reward?: string | null;
  status?: 'in_corso' | 'standby' | 'completata';
  isMilestone?: boolean;
  revealedAt?: string;
};

function stage(s: Stage) {
  return {
    description: null,
    reward: null,
    status: 'in_corso',
    isMilestone: false,
    revealedAt: '2026-03-01T10:00:00Z',
    ...s,
  };
}

function quest(id: string, stages: Stage[], extra: Record<string, unknown> = {}) {
  const projected = stages.map(stage);
  const current = projected[projected.length - 1];
  return {
    id,
    kind: 'story',
    stages: projected,
    current,
    updatedAt: current.revealedAt,
    ...extra,
  };
}

const ownedCharacter = () =>
  makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' });

async function openQuests(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: ownedCharacter(),
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await gotoTab(page, 'INFO', 'Quest');
}

/** Pre-seed the device's seen record before the app boots. */
async function seedSeen(page: Page, record: Record<string, string[]>) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SEEN_KEY, JSON.stringify(record)]);
}

const row = (page: Page, title: string) => page.locator('.pb-quest-row', { hasText: title });

const GROUPED = [
  quest('q-run', [{ id: 'a1', title: 'Il segnale', status: 'in_corso' }]),
  quest('q-wait', [{ id: 'b1', title: 'La radio muta', status: 'standby' }]),
  quest('q-done1', [{ id: 'c1', title: 'Acqua pulita', status: 'completata' }]),
  quest('q-done2', [{ id: 'd1', title: 'Il generatore', status: 'completata' }]),
];

// ── list ────────────────────────────────────────────────────────────

test('quests are grouped by status with COMPLETATE collapsed until activated', async ({ page }) => {
  await openQuests(page, { quests: GROUPED });

  await expect(page.locator('[data-group="in_corso"] .pb-section-head')).toHaveText('IN CORSO');
  await expect(page.locator('[data-group="in_corso"] .pb-quest-row')).toHaveCount(1);
  await expect(page.locator('[data-group="standby"] .pb-quest-row')).toHaveCount(1);

  const head = page.locator('[data-toggle-completed]');
  await expect(head).toHaveText('▸ COMPLETATE (2)');
  await expect(page.locator('[data-group="completata"] .pb-quest-row')).toHaveCount(0);

  await head.click();
  await expect(page.locator('[data-group="completata"] .pb-quest-row')).toHaveCount(2);

  // Group order is IN CORSO, STANDBY, COMPLETATE.
  const order = await page.locator('[data-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')));
  expect(order).toEqual(['in_corso', 'standby', 'completata']);
});

test('empty groups do not render and rows sort by updatedAt, newest first', async ({ page }) => {
  await openQuests(page, {
    quests: [
      quest('old', [{ id: 'o1', title: 'Vecchia', revealedAt: '2026-01-01T00:00:00Z' }]),
      quest('new', [{ id: 'n1', title: 'Nuova', revealedAt: '2026-05-01T00:00:00Z' }]),
    ],
  });
  await expect(page.locator('[data-group]')).toHaveCount(1);
  await expect(page.locator('.pb-quest-row-title')).toHaveText(['Nuova', 'Vecchia']);
});

test('rows carry the milestone, kind and shared markers', async ({ page }) => {
  await openQuests(page, {
    quests: [
      quest('story', [{ id: 's1', title: 'Arco principale', isMilestone: true }]),
      quest('mine', [{ id: 'm1', title: 'Solo mia' }], { kind: 'personal', involved: [] }),
      quest('shared', [{ id: 'x1', title: 'Con Nick' }], {
        kind: 'personal',
        involved: [{ id: 'char-2', name: 'Nick' }],
      }),
    ],
  });

  const story = row(page, 'Arco principale');
  await expect(story.locator('[data-milestone]')).toHaveText('★');
  await expect(story.locator('[data-kind]')).toHaveText('STORIA');
  await expect(story.locator('[data-shared]')).toHaveCount(0);

  await expect(row(page, 'Solo mia').locator('[data-kind]')).toHaveText('PERSONALE');
  await expect(row(page, 'Solo mia').locator('[data-shared]')).toHaveCount(0);
  await expect(row(page, 'Solo mia').locator('[data-milestone]')).toHaveCount(0);

  await expect(row(page, 'Con Nick').locator('[data-kind]')).toHaveText('PERSONALE');
  await expect(row(page, 'Con Nick').locator('[data-shared]')).toHaveText('CONDIVISA');
});

test('no quests shows the empty state', async ({ page }) => {
  await openQuests(page, { quests: [] });
  await expect(page.locator('[data-quests-empty]')).toHaveText('Nessuna quest attiva');
});

test('a failed fetch shows an Italian error, not a blank pane', async ({ page }) => {
  await openQuests(page, { quests: 500 });
  await expect(page.locator('[data-quests-error]')).toContainText('Impossibile caricare le quest');
});

// ── detail ──────────────────────────────────────────────────────────

const LONG_QUEST = quest('long', [
  { id: 'l1', title: 'Un segnale strano', description: 'Un ronzio nella radio.', reward: '50 tappi', isMilestone: true, revealedAt: '2026-01-10T10:00:00Z' },
  { id: 'l2', title: 'La torre', description: 'La fonte è una torre.', revealedAt: '2026-02-10T10:00:00Z' },
  { id: 'l3', title: 'Il segnale della Vault 81', description: 'Porta sigillata.', reward: 'Accesso alla Vault', status: 'standby', revealedAt: '2026-03-10T10:00:00Z' },
], { kind: 'personal', involved: [{ id: 'char-2', name: 'Nick' }] });

test('the detail shows the header, the other holders, the current stage and its reward', async ({ page }) => {
  await openQuests(page, { quests: [LONG_QUEST] });
  await row(page, 'Il segnale della Vault 81').click();

  const detail = page.locator('[data-quest-detail]');
  await expect(detail.locator('.pb-quest-title')).toHaveText('Il segnale della Vault 81');
  await expect(detail.locator('[data-status]')).toHaveText('STANDBY');
  await expect(detail.locator('[data-kind]')).toHaveText('PERSONALE');
  // Lost milestone: the current stage is not one, so no header badge…
  await expect(detail.locator('.pb-quest-head [data-milestone]')).toHaveCount(0);

  // Only the *other* holders, as the API provides them.
  await expect(detail.locator('[data-involved]')).toHaveText('Condivisa con: Nick');
  await expect(detail.locator('[data-involved]')).not.toContainText('Marta Voss');

  await expect(detail.locator('[data-current]')).toContainText('Porta sigillata.');
  await expect(detail.locator('[data-current] [data-reward]')).toHaveText('Accesso alla Vault');
});

test('REGISTRO lists only the past stages, newest first without ordinals; entries expand to their own content', async ({ page }) => {
  await openQuests(page, { quests: [LONG_QUEST] });
  await row(page, 'Il segnale della Vault 81').click();

  // The current stage is shown above the log, so the log leaves it out.
  const entries = page.locator('[data-log] [data-stage-id]');
  await expect(entries).toHaveCount(2);
  await expect(entries.locator('.pb-quest-entry-title')).toHaveText([
    'La torre',
    '★ Un segnale strano', // …while the log keeps the earlier milestone
  ]);
  await expect(page.locator('[data-log] [data-stage-id="l3"]')).toHaveCount(0);
  await expect(page.locator('[data-log]')).not.toContainText('#');

  // Past entries start collapsed.
  await expect(entries.locator('[data-entry-body]')).toHaveCount(0);

  await entries.nth(1).locator('[data-entry-toggle]').click();
  const oldest = page.locator('[data-stage-id="l1"] [data-entry-body]');
  await expect(oldest).toContainText('Un ronzio nella radio.');
  await expect(oldest.locator('[data-reward]')).toHaveText('50 tappi');
});

test('a quest with a single stage has no REGISTRO', async ({ page }) => {
  await openQuests(page, {
    quests: [quest('one', [{ id: 'o1', title: 'Appena iniziata', description: 'Primo passo.' }])],
  });
  await row(page, 'Appena iniziata').click();
  await expect(page.locator('[data-current]')).toContainText('Primo passo.');
  await expect(page.locator('[data-log]')).toHaveCount(0);
  await expect(page.locator('[data-quest-detail]')).not.toContainText('REGISTRO');
});

test('an absent reward renders no RICOMPENSA section', async ({ page }) => {
  await openQuests(page, {
    quests: [quest('nr', [{ id: 'r1', title: 'Senza premio', description: 'Solo gloria.' }])],
  });
  await row(page, 'Senza premio').click();
  await expect(page.locator('[data-current]')).toContainText('Solo gloria.');
  await expect(page.locator('[data-current]')).not.toContainText('RICOMPENSA');
  await expect(page.locator('[data-current] [data-reward]')).toHaveCount(0);
});

test('◀ returns to the list with the group expansion preserved', async ({ page }) => {
  await openQuests(page, { quests: GROUPED });
  await page.locator('[data-toggle-completed]').click();
  await row(page, 'Acqua pulita').click();
  await expect(page.locator('[data-quest-detail]')).toBeVisible();

  await page.locator('[data-quest-back]').click();
  await expect(page.locator('[data-quest-detail]')).toHaveCount(0);
  await expect(page.locator('[data-toggle-completed]')).toHaveText('▾ COMPLETATE (2)');
  await expect(page.locator('[data-group="completata"] .pb-quest-row')).toHaveCount(2);
});

// ── AGGIORNATA ──────────────────────────────────────────────────────

test('the first load on a device seeds the seen record without badges', async ({ page }) => {
  await openQuests(page, { quests: GROUPED });
  await expect(page.locator('.pb-quest-row').first()).toBeVisible();
  await expect(page.locator('[data-updated]')).toHaveCount(0);

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), SEEN_KEY);
  expect(stored).toMatchObject({ 'q-run': ['a1'], 'q-wait': ['b1'] });
});

test('an unseen public stage raises AGGIORNATA, and opening the quest clears it', async ({ page }) => {
  // The device has seen stage a1 only; a2 was published since. q-new is a quest
  // revealed since the last visit, absent from the record entirely.
  await seedSeen(page, { 'q-run': ['a1'], 'q-wait': ['b1'] });
  await openQuests(page, {
    quests: [
      quest('q-run', [{ id: 'a1', title: 'Primo' }, { id: 'a2', title: 'Il segnale si sposta' }]),
      quest('q-wait', [{ id: 'b1', title: 'La radio muta', status: 'standby' }]),
      quest('q-new', [{ id: 'n1', title: 'Appena rivelata' }]),
    ],
  });

  await expect(row(page, 'Il segnale si sposta').locator('[data-updated]')).toHaveText('AGGIORNATA');
  await expect(row(page, 'Appena rivelata').locator('[data-updated]')).toHaveText('AGGIORNATA');
  await expect(row(page, 'La radio muta').locator('[data-updated]')).toHaveCount(0);

  await row(page, 'Il segnale si sposta').click();
  await page.locator('[data-quest-back]').click();
  await expect(row(page, 'Il segnale si sposta').locator('[data-updated]')).toHaveCount(0);
  await expect(row(page, 'Appena rivelata').locator('[data-updated]')).toHaveText('AGGIORNATA');

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), SEEN_KEY);
  expect(stored['q-run']).toEqual(['a1', 'a2']);
});

test('when storage throws, the list renders normally without badges', async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith('pb.quests.')) throw new Error('denied');
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('pb.quests.')) throw new Error('denied');
      return setItem.call(this, key, value);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await openQuests(page, { quests: GROUPED });
  await expect(page.locator('.pb-quest-row')).toHaveCount(2);
  await expect(page.locator('[data-updated]')).toHaveCount(0);

  await row(page, 'Il segnale').click();
  await expect(page.locator('[data-quest-detail]')).toBeVisible();
  expect(errors).toEqual([]);
});

// ── personal quest writes ───────────────────────────────────────────

type Call = { method: string; path: string; body: any };

/**
 * Answer the player write routes with `respond(call)` (a projected quest, a
 * status number, or `undefined` for a 204) and record every call. Registered
 * after `stubEnvironment`, so it takes precedence over the fixture's read-only
 * quest route; GETs fall through to it.
 */
async function stubWrites(page: Page, respond: (call: Call) => unknown) {
  const calls: Call[] = [];
  await page.route(/\/characters\/char-1\/quests(\/.*)?$/, (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fallback();
    const call = {
      method: req.method(),
      path: new URL(req.url()).pathname.replace(/^.*\/quests/, ''),
      body: req.postDataJSON(),
    };
    calls.push(call);
    const out = respond(call);
    if (typeof out === 'number') return route.fulfill({ status: out, contentType: 'application/json', body: '{}' });
    if (out === undefined) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  return calls;
}

const personal = (id: string, stages: Stage[], isOwn: boolean) =>
  quest(id, stages, { kind: 'personal', involved: [], isOwn });

const OWN_STAGES: Stage[] = [
  { id: 'o1', title: 'Ritrovare Duke', description: 'Ultimo avvistamento a Diamond City.', revealedAt: '2026-03-01T10:00:00Z' },
  { id: 'o2', title: 'Seguire la pista', description: 'Le tracce portano a nord.', reward: 'Risposte', revealedAt: '2026-03-05T10:00:00Z' },
];
const OWN = personal('own', OWN_STAGES, true);
const ASSIGNED = personal('assigned', [{ id: 'm1', title: 'Il debito di Nick' }], false);

test('a personal quest is created from the list and opens in the detail', async ({ page }) => {
  await openQuests(page, { quests: [] });
  const created = personal('new', [{ id: 'n1', title: 'Cercare il medico', description: 'Serve aiuto.', status: 'standby' }], true);
  const calls = await stubWrites(page, () => created);

  await page.locator('[data-quest-add]').click();
  const editor = page.locator('[data-quest-editor]');
  await expect(editor.locator('.pb-popup-title')).toHaveText('NUOVA QUEST');

  // An empty title blocks the save.
  await editor.locator('[data-save]').click();
  await expect(editor.locator('[data-title]')).toHaveClass(/pb-input--invalid/);
  expect(calls).toHaveLength(0);

  await editor.locator('[data-title]').fill('Cercare il medico');
  await editor.locator('[data-description]').fill('Serve aiuto.');
  await editor.locator('[data-status-value="standby"]').click();
  await editor.locator('[data-save]').click();

  await expect(editor).toHaveCount(0);
  expect(calls).toEqual([{
    method: 'POST',
    path: '',
    body: { stage: { title: 'Cercare il medico', description: 'Serve aiuto.', status: 'standby', isMilestone: false } },
  }]);
  await expect(page.locator('[data-quest-detail] .pb-quest-title')).toHaveText('Cercare il medico');
});

test('story quests stay read-only; only own personal quests can be deleted', async ({ page }) => {
  await openQuests(page, { quests: [OWN, ASSIGNED, quest('story', [{ id: 's1', title: 'La Confraternita' }])] });

  await row(page, 'La Confraternita').click();
  await expect(page.locator('[data-quest-advance]')).toHaveCount(0);
  await expect(page.locator('[data-stage-edit]')).toHaveCount(0);
  await page.locator('[data-quest-back]').click();

  await row(page, 'Il debito di Nick').click();
  await expect(page.locator('[data-quest-advance]')).toBeVisible();
  await expect(page.locator('[data-quest-delete]')).toHaveCount(0);
  await page.locator('[data-quest-back]').click();

  await row(page, 'Seguire la pista').click();
  await expect(page.locator('[data-quest-delete]')).toBeVisible();
});

test('AGGIORNA pre-fills from the current stage and adds one without raising AGGIORNATA', async ({ page }) => {
  await openQuests(page, { quests: [OWN] });
  const advanced = personal('own', [
    ...OWN_STAGES,
    { id: 'o3', title: 'Seguire la pista', description: 'Trovato il rifugio.', reward: 'Risposte', status: 'completata', revealedAt: '2026-04-01T10:00:00Z' },
  ], true);
  const calls = await stubWrites(page, () => advanced);

  await row(page, 'Seguire la pista').click();
  await page.locator('[data-quest-advance]').click();
  const editor = page.locator('[data-quest-editor]');
  await expect(editor.locator('.pb-popup-title')).toHaveText('AGGIORNA QUEST');
  await expect(editor.locator('[data-title]')).toHaveValue('Seguire la pista');
  await expect(editor.locator('[data-reward]')).toHaveValue('Risposte');

  await editor.locator('[data-description]').fill('Trovato il rifugio.');
  await editor.locator('[data-status-value="completata"]').click();
  await editor.locator('[data-save]').click();

  await expect(page.locator('[data-current]')).toContainText('Trovato il rifugio.');
  expect(calls[0]).toMatchObject({
    method: 'POST',
    path: '/own/stages',
    body: { title: 'Seguire la pista', description: 'Trovato il rifugio.', reward: 'Risposte', status: 'completata' },
  });
  await expect(page.locator('[data-status]')).toHaveText('COMPLETATA');
  await expect(page.locator('[data-log] [data-stage-id]')).toHaveCount(2);

  await page.locator('[data-quest-back]').click();
  await page.locator('[data-toggle-completed]').click();
  await expect(row(page, 'Seguire la pista')).toBeVisible();
  await expect(row(page, 'Seguire la pista').locator('[data-updated]')).toHaveCount(0);
});

test('a past stage is edited from its expanded log entry', async ({ page }) => {
  await openQuests(page, { quests: [OWN] });
  const calls = await stubWrites(page, (call) =>
    personal('own', [{ ...OWN_STAGES[0], title: call.body.title }, OWN_STAGES[1]], true));

  await row(page, 'Seguire la pista').click();
  const entry = page.locator('[data-log] [data-stage-id="o1"]');
  await entry.locator('[data-entry-toggle]').click();
  await entry.locator('[data-stage-edit]').click();

  const editor = page.locator('[data-quest-editor]');
  await expect(editor.locator('.pb-popup-title')).toHaveText('MODIFICA STADIO');
  await expect(editor.locator('[data-delete]')).toHaveCount(0); // only the current stage can be undone
  await editor.locator('[data-title]').fill('Ritrovare Duke a ogni costo');
  await editor.locator('[data-save]').click();

  await expect(page.locator('[data-log] [data-stage-id="o1"] .pb-quest-entry-title')).toHaveText('Ritrovare Duke a ogni costo');
  expect(calls[0]).toMatchObject({ method: 'PATCH', path: '/own/stages/o1', body: { title: 'Ritrovare Duke a ogni costo' } });
});

test('the current stage can be undone after a confirmation', async ({ page }) => {
  await openQuests(page, { quests: [OWN] });
  const calls = await stubWrites(page, () => personal('own', [OWN_STAGES[0]], true));

  await row(page, 'Seguire la pista').click();
  await page.locator('.pb-quest-actions [data-stage-edit]').click();
  await page.locator('[data-quest-editor] [data-delete]').click();
  await page.locator('.pb-confirm-dialog [data-confirm]').click();

  await expect(page.locator('[data-quest-editor]')).toHaveCount(0);
  expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/own/stages/o2' });
  await expect(page.locator('.pb-quest-title')).toHaveText('Ritrovare Duke');
  await expect(page.locator('[data-log]')).toHaveCount(0);
});

test('an own quest is deleted after a confirmation', async ({ page }) => {
  await openQuests(page, { quests: [OWN, ASSIGNED] });
  const calls = await stubWrites(page, () => undefined);

  await row(page, 'Seguire la pista').click();
  await page.locator('[data-quest-delete]').click();
  await expect(page.locator('.pb-confirm-dialog')).toContainText('Seguire la pista');
  await page.locator('.pb-confirm-dialog [data-confirm]').click();

  await expect(page.locator('.pb-quest-row')).toHaveCount(1);
  expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/own' });
  await expect(row(page, 'Il debito di Nick')).toBeVisible();
});

test('a failed save keeps the editor open with an error and the text intact', async ({ page }) => {
  await openQuests(page, { quests: [OWN] });
  await stubWrites(page, () => 500);

  await row(page, 'Seguire la pista').click();
  await page.locator('[data-quest-advance]').click();
  const editor = page.locator('[data-quest-editor]');
  await editor.locator('[data-description]').fill('Non salvato.');
  await editor.locator('[data-save]').click();

  await expect(editor.locator('[data-error]')).toBeVisible();
  await expect(editor.locator('[data-description]')).toHaveValue('Non salvato.');
  await expect(editor.locator('[data-save]')).toBeEnabled();
});
