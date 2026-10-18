import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, type StubOptions } from './fixtures';

// Covers the two-tab add-condition popup (pipboy-character-sheet): the SALUTE
// tab's `− NEGATIVA` / `+ POSITIVA` triggers each open a popup scoped to their
// polarity. Its "Scegli esistente" tab picks over that polarity's catalog
// presets via the full-screen picker, grouped BASE then MODERATA; its "custom"
// tab has a name, an optional description and a signed weight toggle (no sign
// toggle). Also covers quantity-1 instantiation.

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

// Supplied out of order on purpose: the picker groups and sorts client-side.
const MIXED_CATALOG = [
  { slug: 'stremato', name: 'STREMATO', polarity: 'negative', defaultSeverity: 'minor', description: 'Endurance e azioni prolungate' },
  { slug: 'avvelenato', name: 'AVVELENATO', polarity: 'negative', defaultSeverity: 'major', description: 'Endurance, tiri fisici' },
  { slug: 'ispirato', name: 'ISPIRATO', polarity: 'positive', defaultSeverity: 'minor' },
  { slug: 'cieco', name: 'CIECO', polarity: 'negative', defaultSeverity: 'minor' },
  { slug: 'mutilato', name: 'MUTILATO', polarity: 'negative', defaultSeverity: 'major' },
  { slug: 'adrenalina', name: 'ADRENALINA', polarity: 'positive', defaultSeverity: 'major', description: 'Strength e Agility' },
];

async function openPicker(page: Page, polarity: 'neg' | 'pos') {
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();
  await page.locator(`#pb-cond-add-${polarity}`).click();
  await page.locator('#pb-cond-existing').click();
  await expect(page.locator('.pb-picker')).toBeVisible();
}

const statusPatch = (page: Page) =>
  page.waitForRequest((r) => r.url().includes('/status') && r.method() === 'PATCH');

// ── polarity-scoped picker ──────────────────────────────────────────

test('− NEGATIVA opens a two-tab popup whose picker lists only negative presets; picking routes to negativeConditions', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  await page.locator('#pb-cond-add-neg').click();
  await expect(page.locator('.pb-popup')).toBeVisible();
  await expect(page.locator('.pb-popup-title')).toHaveText('AGGIUNGI · − NEGATIVA');
  await expect(page.locator('[data-ptab="existing"]')).toHaveCount(1);
  await expect(page.locator('[data-ptab="custom"]')).toHaveCount(1);

  await page.locator('#pb-cond-existing').click();
  await expect(page.locator('.pb-picker-name')).toHaveText(['Avvelenato']);
  await page.locator('.pb-picker-row', { hasText: 'Avvelenato' }).click();
  await expect(page.locator('.pb-picker-overlay')).toHaveCount(0);

  const req = statusPatch(page);
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toMatchObject({
    negativeConditions: { items: [{ name: 'Avvelenato', severity: 'major' }] },
  });
  await expect(page.locator('.pb-popup-overlay')).toHaveCount(0);
});

test('+ POSITIVA lists only positive presets and routes to positiveConditions', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await openPicker(page, 'pos');
  await expect(page.locator('.pb-popup-title')).toHaveText('AGGIUNGI · + POSITIVA');
  await expect(page.locator('.pb-picker-name')).toHaveText(['Ben Nutrito']);

  await page.locator('.pb-picker-row', { hasText: 'Ben Nutrito' }).click();
  const req = statusPatch(page);
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toMatchObject({
    positiveConditions: { items: [{ name: 'Ben Nutrito', severity: 'minor' }] },
  });
});

// ── grouping, signed values, descriptions ───────────────────────────

test('the picker groups BASE before MODERATA, alphabetical within each, with header counts', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter(), conditionsCatalog: MIXED_CATALOG });
  await openPicker(page, 'neg');

  const sections = page.locator('.pb-picker-section');
  await expect(sections.locator('.pb-picker-section-label')).toHaveText(['BASE · −1', 'MODERATA · −2']);
  await expect(sections.locator('.pb-picker-section-count')).toHaveText(['2', '2']);

  // DOM order: header, its rows, next header, its rows.
  const order = await page.locator('.pb-picker-section-label, .pb-picker-name').allInnerTexts();
  expect(order).toEqual(['BASE · −1', 'CIECO', 'STREMATO', 'MODERATA · −2', 'AVVELENATO', 'MUTILATO']);
});

test('picker rows show a signed value and the description, never ×1/×2', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter(), conditionsCatalog: MIXED_CATALOG });
  await openPicker(page, 'neg');

  const avv = page.locator('.pb-picker-row', { hasText: 'AVVELENATO' });
  await expect(avv.locator('.pb-picker-lead')).toHaveText('−2');
  await expect(avv.locator('.pb-picker-desc')).toHaveText('Endurance, tiri fisici');
  await expect(avv).toHaveClass(/pb-picker-row--neg/);
  // No description → no second line.
  await expect(page.locator('.pb-picker-row', { hasText: 'CIECO' }).locator('.pb-picker-desc')).toHaveCount(0);
  await expect(page.locator('.pb-picker-list')).not.toContainText('×');

  await page.locator('.pb-picker-close').click();
  await page.locator('.pb-popup-close').click();
  await page.locator('#pb-cond-add-pos').click();
  await page.locator('#pb-cond-existing').click();
  const isp = page.locator('.pb-picker-row', { hasText: 'ISPIRATO' });
  await expect(isp.locator('.pb-picker-lead')).toHaveText('+1');
  await expect(isp).toHaveClass(/pb-picker-row--pos/);
  await expect(page.locator('.pb-picker-section-label')).toHaveText(['BASE · +1', 'MODERATA · +2']);
});

test('picking a preset carries its description into the PATCH', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter(), conditionsCatalog: MIXED_CATALOG });
  await openPicker(page, 'neg');
  await page.locator('.pb-picker-row', { hasText: 'STREMATO' }).click();

  const req = statusPatch(page);
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toMatchObject({
    negativeConditions: {
      items: [{ name: 'STREMATO', severity: 'minor', description: 'Endurance e azioni prolungate' }],
    },
  });
});

// ── custom tab: no sign toggle, signed weights, description ─────────

test('the custom tab has no sign toggle and labels the weights with signed values', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  await page.locator('#pb-cond-add-neg').click();
  await page.locator('[data-ptab="custom"]').click();
  await expect(page.locator('[data-sign]')).toHaveCount(0);
  await expect(page.locator('#pb-cond-description')).toBeVisible();
  await expect(page.locator('[data-weight]')).toHaveText(['BASE −1', 'MODERATA −2']);
  await page.locator('.pb-popup-close').click();

  await page.locator('#pb-cond-add-pos').click();
  await page.locator('[data-ptab="custom"]').click();
  await expect(page.locator('[data-sign]')).toHaveCount(0);
  await expect(page.locator('[data-weight]')).toHaveText(['BASE +1', 'MODERATA +2']);
});

test('the custom tab adds a negative condition and persists criticalState on crossing the margin', async ({ page }) => {
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
  await expect(page.locator('#pb-health-value')).toHaveText('2/4');

  await page.locator('#pb-cond-add-neg').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-cond-name').fill('IRRADIATO');
  await page.locator('[data-weight="major"]').click(); // net wear 2 → 4, health → 0

  const req = statusPatch(page);
  await page.locator('[data-ok]').click();
  const body = (await req).postDataJSON();
  expect(body).toMatchObject({
    negativeConditions: { items: [{ name: 'IRRADIATO', severity: 'major' }] },
    criticalState: true,
  });
  // A blank description sends no description key.
  expect(body.negativeConditions.items[0]).not.toHaveProperty('description');
  await expect(page.locator('#pb-health-value')).toHaveText('0/4');
});

test('a positive custom condition with a description routes to positiveConditions and sends it', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  await page.locator('#pb-cond-add-pos').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-cond-name').fill('CARISMATICO');
  await page.locator('#pb-cond-description').fill('  Charisma e tiri sociali  ');
  await page.locator('[data-weight="major"]').click();

  const req = statusPatch(page);
  await page.locator('[data-ok]').click();
  expect((await req).postDataJSON()).toMatchObject({
    positiveConditions: {
      items: [{ name: 'CARISMATICO', severity: 'major', description: 'Charisma e tiri sociali' }],
    },
  });
});

test('a whitespace-only custom description sends no description key', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  await page.locator('#pb-cond-add-pos').click();
  await page.locator('[data-ptab="custom"]').click();
  await page.locator('#pb-cond-name').fill('BEN NUTRITO');
  await page.locator('#pb-cond-description').fill('   ');

  const req = statusPatch(page);
  await page.locator('[data-ok]').click();
  const body = (await req).postDataJSON();
  expect(body.positiveConditions.items).toEqual([{ name: 'BEN NUTRITO', severity: 'minor' }]);
});

// ── catalog fetch failure ───────────────────────────────────────────

test('with the catalog fetch failing, − NEGATIVA lists the fallback presets and + POSITIVA opens on the custom tab', async ({ page }) => {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: ownedCharacter(),
  });
  await page.route('**/conditions-catalog*', (route) => route.fulfill({ status: 500, body: '{}' }));
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();

  await openPicker(page, 'neg');
  await expect(page.locator('.pb-picker-row')).toHaveCount(7);
  await page.locator('.pb-picker-close').click();
  await page.locator('.pb-popup-close').click();

  // The fallback list holds negatives only, so the positive popup has no presets.
  await page.locator('#pb-cond-add-pos').click();
  await expect(page.locator('[data-ptab="custom"]')).toHaveClass(/active/);
  await expect(page.locator('#pb-cond-name')).toBeVisible();
  await expect(page.locator('#pb-cond-existing')).toBeDisabled();
});

test('the red ✕ cancels the condition popup with no write', async ({ page }) => {
  await openSheet(page, { character: ownedCharacter() });
  await page.locator('.pb-tab', { hasText: 'SALUTE' }).click();

  let patched = false;
  page.on('request', (r) => {
    if (r.url().includes('/status') && r.method() === 'PATCH') patched = true;
  });

  await page.locator('#pb-cond-add-neg').click();
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
