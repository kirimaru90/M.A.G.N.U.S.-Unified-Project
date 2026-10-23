import { test, expect, type Page } from '@playwright/test';
import {
  stubEnvironment,
  login,
  makeCharacter,
  gotoTab,
  DEFAULT_MAP_CONFIG,
  type StubOptions,
} from './fixtures';

// End-to-end coverage of INFO › Codex (pipboy-codex): grouped, collapsible
// categories with search and type filter; the detail with its contained image,
// map line and edit controls; the editor popup; soft delete. The codex body
// stands in for what the API has already projected for this character.

const entry = (over: Record<string, unknown>) => ({
  description: null,
  imageUrl: null,
  isPublic: false,
  isEditable: false,
  isOwn: false,
  mapPlaceSlug: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...over,
});

const DIAMOND = entry({ id: 'e-dc', type: 'luogo', name: 'Diamond City', isPublic: true, mapPlaceSlug: 'dc' });
const GOODNEIGHBOR = entry({ id: 'e-gn', type: 'luogo', name: 'Goodneighbor' });
const RAILROAD = entry({ id: 'e-rr', type: 'fazione', name: 'Railroad', isEditable: true, isOwn: true, description: 'Agenti segreti.' });

const PLACES = [
  { slug: 'dc', name: 'Diamond City', type: 'settlement', lat: 41.9, lng: 12.5, hasLocalMap: false, isPublic: true, parent: null },
  { slug: 'vault-111', name: 'Vault 111', type: 'vault', lat: 41.91, lng: 12.51, hasLocalMap: false, isPublic: true, parent: null },
];

async function openCodex(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character: makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' }),
    campaignMap: { config: DEFAULT_MAP_CONFIG, places: PLACES },
    ...opts,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await gotoTab(page, 'INFO', 'Codex');
}

const heads = (page: Page) => page.locator('[data-codex-group-toggle]');
const rows = (page: Page) => page.locator('[data-codex-id]');
const codexWrite = (page: Page, method: string) =>
  page.waitForRequest((r) => r.method() === method && /\/characters\/char-1\/codex/.test(r.url()));

test.describe('list', () => {
  test('INFO lands on Codex and shows only non-empty categories, collapsed', async ({ page }) => {
    await openCodex(page, { codex: [DIAMOND, GOODNEIGHBOR, RAILROAD] });
    await expect(page.locator('.pb-subtab.active')).toHaveText('Codex');
    await expect(heads(page)).toHaveText([/▸ LUOGHI \(2\)/, /▸ FAZIONI \(1\)/]);
    await expect(rows(page)).toHaveCount(0);
  });

  test('a group expands on tap, rows by name, with the PUBBLICA marker', async ({ page }) => {
    await openCodex(page, { codex: [GOODNEIGHBOR, DIAMOND, RAILROAD] });
    await page.locator('[data-codex-group-toggle="luogo"]').click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText('Diamond City');
    await expect(rows(page).first().locator('[data-public]')).toHaveText('PUBBLICA');
    await expect(rows(page).nth(1).locator('[data-public]')).toHaveCount(0);
  });

  test('search auto-expands matching groups, and clearing it restores the toggles', async ({ page }) => {
    await openCodex(page, { codex: [DIAMOND, GOODNEIGHBOR, RAILROAD] });
    const search = page.locator('[data-codex-search]');
    await search.fill('dia');
    await expect(heads(page)).toHaveText([/▾ LUOGHI \(1\)/]);
    await expect(rows(page)).toHaveText([/Diamond City/]);
    // The box keeps focus while typing: only the groups below it repaint.
    await expect(search).toBeFocused();

    await search.fill('');
    await expect(heads(page)).toHaveText([/▸ LUOGHI/, /▸ FAZIONI/]);
    await expect(rows(page)).toHaveCount(0);
  });

  test('the type select narrows to one category', async ({ page }) => {
    await openCodex(page, { codex: [DIAMOND, RAILROAD] });
    await page.locator('[data-codex-type]').selectOption('fazione');
    await expect(heads(page)).toHaveText([/FAZIONI \(1\)/]);
  });

  test('empty codex and no-result states', async ({ page }) => {
    await openCodex(page, { codex: [] });
    await expect(page.locator('[data-codex-empty]')).toHaveText('Nessuna voce nel codex');
  });

  test('a filter matching nothing says so', async ({ page }) => {
    await openCodex(page, { codex: [DIAMOND] });
    await page.locator('[data-codex-search]').fill('zzz');
    await expect(page.locator('[data-codex-no-results]')).toHaveText('Nessun risultato');
  });

  test('a failed fetch shows an error, not a blank pane', async ({ page }) => {
    await openCodex(page, { codex: 500 });
    await expect(page.locator('[data-codex-error]')).toContainText('Impossibile caricare il codex');
  });
});

test.describe('detail', () => {
  test('the image is contained and capped at 40% of the viewport height', async ({ page }) => {
    await page.route('https://img.test/tall.svg', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="3000"><rect width="300" height="3000" fill="#0f0"/></svg>',
      }),
    );
    await openCodex(page, { codex: [entry({ id: 'e1', type: 'creatura', name: 'Behemoth', imageUrl: 'https://img.test/tall.svg' })] });
    await page.locator('[data-codex-group-toggle="creatura"]').click();
    await rows(page).first().click();

    const img = page.locator('[data-codex-img]');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    const box = (await img.boundingBox())!;
    const viewport = page.viewportSize()!;
    const pane = (await page.locator('#pb-sheet-content').boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(viewport.height * 0.4 + 1);
    expect(box.width).toBeLessThanOrEqual(pane.width);
    // Proportions kept: 1:10, measured inside the frame's 1px border.
    expect((box.height - 2) / (box.width - 2)).toBeCloseTo(10, 0);
    expect(await img.evaluate((el) => getComputedStyle(el).objectFit)).toBe('contain');
  });

  test('a broken image leaves no block behind', async ({ page }) => {
    await page.route('https://img.test/missing.png', (route) => route.fulfill({ status: 404, body: '' }));
    await openCodex(page, { codex: [entry({ id: 'e1', type: 'creatura', name: 'Ghost', imageUrl: 'https://img.test/missing.png' })] });
    await page.locator('[data-codex-group-toggle="creatura"]').click();
    await rows(page).first().click();
    await expect(page.locator('[data-codex-name]')).toHaveText('Ghost');
    await expect(page.locator('[data-codex-img-wrap]')).toHaveCount(0);
  });

  test('back returns to the list with search, type and groups preserved', async ({ page }) => {
    await openCodex(page, { codex: [DIAMOND, GOODNEIGHBOR, RAILROAD] });
    await page.locator('[data-codex-type]').selectOption('luogo');
    await page.locator('[data-codex-group-toggle="luogo"]').click();
    await rows(page).first().click();
    await expect(page.locator('[data-codex-detail]')).toBeVisible();

    await page.locator('[data-codex-back]').click();
    await expect(page.locator('[data-codex-type]')).toHaveValue('luogo');
    await expect(heads(page)).toHaveText([/▾ LUOGHI \(2\)/]);
    await expect(rows(page)).toHaveCount(2);
  });

  test('a non-editable entry has no edit controls; a linked visible place shows its map line', async ({ page }) => {
    await openCodex(page, { codex: [DIAMOND] });
    await page.locator('[data-codex-group-toggle="luogo"]').click();
    await rows(page).first().click();
    await expect(page.locator('[data-codex-place]')).toContainText('Luogo: Diamond City');
    await expect(page.locator('[data-codex-map]')).toHaveText('MAPPA');
    await expect(page.locator('[data-codex-edit]')).toHaveCount(0);
    await expect(page.locator('[data-codex-delete]')).toHaveCount(0);
  });

  test('a place the character cannot see shows no map line', async ({ page }) => {
    await openCodex(page, { codex: [entry({ id: 'e1', type: 'luogo', name: 'Institute', mapPlaceSlug: 'secret' })] });
    await page.locator('[data-codex-group-toggle="luogo"]').click();
    // The detail reads the map on demand; let that land before asserting absence.
    const mapRead = page.waitForResponse(/\/campaigns\/camp-1\/map$/);
    await rows(page).first().click();
    await expect(page.locator('[data-codex-name]')).toHaveText('Institute');
    await mapRead;
    await expect(page.locator('[data-codex-place]')).toHaveCount(0);
    await expect(page.locator('[data-codex-map]')).toHaveCount(0);
  });

  test('MAPPA opens the map focused on the place, with its popup open', async ({ page }) => {
    await openCodex(page, { codex: [DIAMOND] });
    await page.locator('[data-codex-group-toggle="luogo"]').click();
    await rows(page).first().click();
    await page.locator('[data-codex-map]').click();
    await expect(page.locator('.pb-tab.active')).toHaveText('MAPPA');
    await expect(page.locator('.pb-map-popup-name')).toHaveText('Diamond City');
  });
});

test.describe('editor', () => {
  test('creates an entry and opens its detail', async ({ page }) => {
    await openCodex(page, { codex: [] });
    await page.locator('[data-codex-add]').click();
    const editor = page.locator('[data-codex-editor]');
    await expect(editor.locator('.pb-popup-title')).toHaveText('NUOVA VOCE');
    await editor.locator('[data-type-value="creatura"]').click();
    await editor.locator('[data-name]').fill('Mirelurk');

    const post = codexWrite(page, 'POST');
    await editor.locator('[data-save]').click();
    expect((await post).postDataJSON()).toEqual({ type: 'creatura', name: 'Mirelurk', isPublic: false });
    await expect(editor).toHaveCount(0);
    await expect(page.locator('[data-codex-name]')).toHaveText('Mirelurk');
    await expect(page.locator('[data-codex-edit]')).toBeVisible();
  });

  test('saving without a name issues nothing and keeps the popup open', async ({ page }) => {
    await openCodex(page, { codex: [] });
    let posted = false;
    page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/codex')) posted = true; });
    await page.locator('[data-codex-add]').click();
    const editor = page.locator('[data-codex-editor]');
    await editor.locator('[data-type-value="luogo"]').click();
    await editor.locator('[data-save]').click();
    await expect(editor.locator('[data-name]')).toHaveClass(/pb-input--invalid/);
    await expect(editor).toBeVisible();
    expect(posted).toBe(false);
  });

  test('edits only the changed fields and repaints the detail', async ({ page }) => {
    await openCodex(page, { codex: [RAILROAD] });
    await page.locator('[data-codex-group-toggle="fazione"]').click();
    await rows(page).first().click();
    await page.locator('[data-codex-edit]').click();
    const editor = page.locator('[data-codex-editor]');
    await expect(editor.locator('.pb-popup-title')).toHaveText('MODIFICA VOCE');
    await editor.locator('[data-description]').fill('Liberano i sintetici.');

    const patch = codexWrite(page, 'PATCH');
    await editor.locator('[data-save]').click();
    expect((await patch).postDataJSON()).toEqual({ description: 'Liberano i sintetici.' });
    await expect(page.locator('[data-codex-desc]')).toHaveText('Liberano i sintetici.');
  });

  test('the place picker sets the slug', async ({ page }) => {
    await openCodex(page, { codex: [RAILROAD] });
    await page.locator('[data-codex-group-toggle="fazione"]').click();
    await rows(page).first().click();
    await page.locator('[data-codex-edit]').click();
    const editor = page.locator('[data-codex-editor]');
    await expect(editor.locator('[data-place]')).toHaveText('Nessuno');
    await editor.locator('[data-place]').click();
    await page.locator('.pb-picker [data-pick="Vault 111"]').click();
    await expect(editor.locator('[data-place]')).toHaveText('Vault 111');

    const patch = codexWrite(page, 'PATCH');
    await editor.locator('[data-save]').click();
    expect((await patch).postDataJSON()).toEqual({ mapPlaceSlug: 'vault-111' });
  });

  test("making someone else's public entry private warns first, and a 204 drops it", async ({ page }) => {
    const shared = entry({ id: 'e-sh', type: 'luogo', name: 'Sanctuary', isPublic: true, isEditable: true, isOwn: false });
    await openCodex(page, { codex: [shared] });
    await page.route(/\/characters\/char-1\/codex\/e-sh$/, (route) =>
      route.request().method() === 'PATCH' ? route.fulfill({ status: 204, body: '' }) : route.fallback(),
    );
    await page.locator('[data-codex-group-toggle="luogo"]').click();
    await rows(page).first().click();
    await page.locator('[data-codex-edit]').click();
    const editor = page.locator('[data-codex-editor]');
    await editor.locator('[data-public]').click();
    await editor.locator('[data-save]').click();

    const dialog = page.locator('.pb-confirm-dialog');
    await expect(dialog).toContainText('Rendendola privata potresti non vederla più. Continuare?');
    await dialog.locator('[data-cancel]').click();
    await expect(editor).toBeVisible();

    await editor.locator('[data-save]').click();
    const patch = codexWrite(page, 'PATCH');
    await page.locator('.pb-confirm-dialog [data-confirm]').click();
    expect((await patch).postDataJSON()).toEqual({ isPublic: false });
    await expect(page.locator('[data-codex-empty]')).toHaveText('Nessuna voce nel codex');
  });

  test('ELIMINA asks first, then soft-deletes and returns to the list', async ({ page }) => {
    await openCodex(page, { codex: [RAILROAD, DIAMOND] });
    await page.locator('[data-codex-group-toggle="fazione"]').click();
    await rows(page).first().click();
    await page.locator('[data-codex-delete]').click();
    const dialog = page.locator('.pb-confirm-dialog');
    await expect(dialog).toContainText('Eliminare questa voce?');

    const del = codexWrite(page, 'DELETE');
    await dialog.locator('[data-confirm]').click();
    expect((await del).url()).toMatch(/\/codex\/e-rr$/);
    await expect(page.locator('[data-codex-detail]')).toHaveCount(0);
    await expect(heads(page)).toHaveText([/LUOGHI \(1\)/]);
  });
});
