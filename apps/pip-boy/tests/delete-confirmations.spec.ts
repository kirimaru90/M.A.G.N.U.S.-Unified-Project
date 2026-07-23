import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, openSheet, makeCharacter } from './fixtures';

// Coverage for the five destructive actions gated behind `openConfirm` (see
// proposal/add-pipboy-delete-confirmations): character delete, skill delete,
// talent/perk delete, item/equipment delete, and logout. Tag removal is the
// regression guard proving the fix stayed scoped to actual deletions.

/** Record every request to a given URL fragment, so a test can assert none fired. */
function recordRequests(page: Page, urlFragment: string) {
  const reqs: Array<{ method: string; url: string; body: string | null }> = [];
  page.on('request', (r) => {
    if (r.url().includes(urlFragment)) reqs.push({ method: r.method(), url: r.url(), body: r.postData() });
  });
  return reqs;
}

// ── 1. Character deletion (dossier) ─────────────────────────────────

async function openDossierWithTwoCharacters(page: Page) {
  let characters = [
    makeCharacter({ id: 'char-1', name: 'Marta Voss' }),
    makeCharacter({ id: 'char-2', name: 'Doc Mitchell' }),
  ];
  await stubEnvironment(page, { characters });
  // The fixture's characters-list route is static; override it here so a
  // successful delete is reflected on the next reload, and track deletes
  // against the same closure so the two routes agree on state.
  await page.route(/\/campaigns\/[^/]+\/characters$/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(characters) });
  });
  await page.route(/\/campaigns\/[^/]+\/characters\/[^/]+$/, (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const id = new URL(route.request().url()).pathname.split('/').pop();
    characters = characters.filter((c) => c.id !== id);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await login(page);
  await expect(page.locator('#pb-char-list')).toBeVisible();
}

test('deleting a character asks for confirmation naming it; cancelling (button and backdrop) leaves it listed', async ({ page }) => {
  const reqs = recordRequests(page, '/characters/char-2');
  await openDossierWithTwoCharacters(page);

  await expect(page.locator('.pb-dossier-card')).toHaveCount(2);

  // Cancel via the cancel button.
  await page.locator('.pb-dossier-card', { hasText: 'Doc Mitchell' }).locator('[data-delete]').click();
  const dialog = page.locator('.pb-confirm-dialog');
  await expect(dialog).toContainText('Eliminare Doc Mitchell?');
  await dialog.locator('[data-cancel]').click();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(page.locator('.pb-dossier-card')).toHaveCount(2);

  // Cancel via the backdrop.
  await page.locator('.pb-dossier-card', { hasText: 'Doc Mitchell' }).locator('[data-delete]').click();
  await page.locator('.pb-confirm-overlay').click({ position: { x: 4, y: 4 } });
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(page.locator('.pb-dossier-card')).toHaveCount(2);

  expect(reqs.some((r) => r.method === 'DELETE')).toBe(false);
});

test('confirming character deletion removes it from the dossier', async ({ page }) => {
  const reqs = recordRequests(page, '/characters/char-2');
  await openDossierWithTwoCharacters(page);

  await page.locator('.pb-dossier-card', { hasText: 'Doc Mitchell' }).locator('[data-delete]').click();
  await page.locator('.pb-confirm-dialog [data-confirm]').click();

  await expect(page.locator('.pb-dossier-card')).toHaveCount(1);
  await expect(page.locator('.pb-dossier-card')).toContainText('Marta Voss');
  expect(reqs.some((r) => r.method === 'DELETE')).toBe(true);
});

// ── 2. Skill and talent/perk deletion (sheet editor mode) ───────────

async function openAbilitaEditor(page: Page) {
  const character = makeCharacter({
    id: 'char-1', campaignId: 'camp-1', userId: 'user-player',
    skills: [{ id: 'lockpicking', level: 'expert' }],
    perks: [{ id: 'perk-1', name: 'Talento Test', description: 'una descrizione' }],
  });
  await stubEnvironment(page, { role: 'player', userId: 'user-player', character });
  await openSheet(page);
  await page.locator('.pb-tab', { hasText: 'STATS' }).click();
  await page.locator('.pb-subtab', { hasText: 'Abilità' }).click();
  await page.locator('#pb-editor-toggle').click();
}

test('removing a skill asks for confirmation; cancelling keeps the row, confirming issues the PATCH and removes it', async ({ page }) => {
  const reqs = recordRequests(page, '/skills');
  await openAbilitaEditor(page);

  const row = page.locator('[data-skill-row="lockpicking"]');
  await expect(row).toBeVisible();

  await row.locator('[data-remove-skill="lockpicking"]').click();
  const dialog = page.locator('.pb-confirm-dialog');
  await expect(dialog).toContainText('Rimuovere questa abilità?');
  expect(reqs.some((r) => r.method === 'PATCH')).toBe(false);

  await dialog.locator('[data-cancel]').click();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(row).toBeVisible();

  await row.locator('[data-remove-skill="lockpicking"]').click();
  await page.locator('.pb-confirm-dialog [data-confirm]').click();
  await expect(page.locator('[data-skill-row="lockpicking"]')).toHaveCount(0);
  expect(reqs.some((r) => r.method === 'PATCH' && JSON.parse(r.body!).deletedIds?.includes('lockpicking'))).toBe(true);
});

test('removing a talent asks for confirmation; cancelling keeps the row, confirming issues the PATCH and removes it', async ({ page }) => {
  const reqs = recordRequests(page, '/perks');
  await openAbilitaEditor(page);
  await page.locator('.pb-subtab', { hasText: 'TALENTI' }).click();

  const row = page.locator('[data-perk-row="perk-1"]');
  await expect(row).toBeVisible();

  await row.locator('[data-remove-perk="perk-1"]').click();
  const dialog = page.locator('.pb-confirm-dialog');
  await expect(dialog).toContainText('Rimuovere questo talento?');
  expect(reqs.some((r) => r.method === 'PATCH')).toBe(false);

  await dialog.locator('[data-cancel]').click();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(row).toBeVisible();

  await row.locator('[data-remove-perk="perk-1"]').click();
  await page.locator('.pb-confirm-dialog [data-confirm]').click();
  await expect(page.locator('[data-perk-row="perk-1"]')).toHaveCount(0);
  expect(reqs.some((r) => r.method === 'PATCH' && JSON.parse(r.body!).deletedIds?.includes('perk-1'))).toBe(true);
});

// ── 3. Item/equipment deletion (sheet editor mode) ───────────────────

async function openInvEditor(page: Page) {
  const character = makeCharacter({
    id: 'char-1', campaignId: 'camp-1', userId: 'user-player',
    inventory: {
      weapons: [{ id: 'w1', name: 'Pistola 10mm', tags: [{ name: 'PROIETTILI', type: 'core', damaged: false }] }],
      equip: [],
      consumables: [{ id: 'c1', name: 'Stimpak', description: '', quantity: 2 }],
      misc: [],
    },
  });
  await stubEnvironment(page, { role: 'player', userId: 'user-player', character });
  await openSheet(page);
  await page.locator('.pb-tab', { hasText: 'INV' }).click();
  await page.locator('#pb-editor-toggle').click();
}

test('removing an inventory item asks for confirmation; cancelling keeps the row, confirming PATCHes and removes it', async ({ page }) => {
  const reqs = recordRequests(page, '/inventory');
  await openInvEditor(page);
  await page.locator('.pb-subtab', { hasText: 'Consumabili' }).click();

  const row = page.locator('[data-item="c1"]');
  await expect(row).toBeVisible();

  await row.locator('[data-remove-item="c1"]').click();
  const dialog = page.locator('.pb-confirm-dialog');
  await expect(dialog).toContainText('Rimuovere questo oggetto?');
  expect(reqs.some((r) => r.method === 'PATCH')).toBe(false);

  await dialog.locator('[data-cancel]').click();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(row).toBeVisible();

  await row.locator('[data-remove-item="c1"]').click();
  await page.locator('.pb-confirm-dialog [data-confirm]').click();
  await expect(page.locator('[data-item="c1"]')).toHaveCount(0);
  expect(reqs.some((r) => r.method === 'PATCH' && JSON.parse(r.body!).consumables?.deletedIds?.includes('c1'))).toBe(true);
});

test('removing a tag from an item stays instant, with no confirmation dialog', async ({ page }) => {
  const reqs = recordRequests(page, '/inventory');
  await openInvEditor(page);
  await page.locator('.pb-subtab', { hasText: 'Armi' }).click();

  const row = page.locator('[data-item="w1"]');
  await expect(row).toBeVisible();
  await expect(row.locator('[data-remove-tag]')).toHaveCount(1);

  await row.locator('[data-remove-tag]').click();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(row.locator('.pb-chip')).toHaveCount(0);
  expect(reqs.some((r) => r.method === 'PATCH')).toBe(true);
});

// ── 4. Logout confirmation ────────────────────────────────────────────

test('ESCI asks for confirmation and does not clear the session yet; cancelling leaves the sheet and session intact', async ({ page }) => {
  const reqs = recordRequests(page, '/auth/logout');
  await stubEnvironment(page);
  await openSheet(page);

  await page.locator('#pb-nav-exit').click();
  const dialog = page.locator('.pb-confirm-dialog');
  await expect(dialog).toContainText('Uscire dalla sessione?');
  expect(reqs.length).toBe(0);

  await dialog.locator('[data-cancel]').click();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  expect(reqs.length).toBe(0);
});

test('confirming ESCI clears the session and returns to login', async ({ page }) => {
  const reqs = recordRequests(page, '/auth/logout');
  await stubEnvironment(page);
  await openSheet(page);

  await page.locator('#pb-nav-exit').click();
  await page.locator('.pb-confirm-dialog [data-confirm]').click();

  await expect(page.locator('#pb-login-submit')).toBeVisible();
  expect(reqs.length).toBe(1);
});
