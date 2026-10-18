import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, openSheet, makeCharacter, gotoTab, type StubOptions } from './fixtures';

// End-to-end coverage of the NOTES tab: the two-section (background + notes)
// screen and its shared WYSIWYG editor, against the mocked notes/background
// endpoints (see fixtures.ts).

const NOTES = [
  { id: 'note-1', title: 'Prima nota', note: 'Contenuto **uno**', createdAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-02T10:00:00.000Z' },
];

async function openNotes(page: Page, opts: StubOptions = {}) {
  await stubEnvironment(page, { role: 'player', userId: 'user-player', ...opts });
  await openSheet(page);
  await gotoTab(page, 'INFO', 'Note');
}

/** Record every API request so tests can assert what was (not) sent. */
function recordRequests(page: Page) {
  const reqs: Array<{ method: string; url: string; body: string | null }> = [];
  page.on('request', (r) => {
    if (r.url().includes('/notes') || r.url().includes('/background')) {
      reqs.push({ method: r.method(), url: r.url(), body: r.postData() });
    }
  });
  return reqs;
}

test('renders a background section (one row, no +) and a note list (head +, title + date)', async ({ page }) => {
  await openNotes(page, { notes: NOTES, background: 'Nato nel Vault 111.' });

  // BACKGROUND head has no add control; exactly one add button exists (the note +).
  await expect(page.locator('.pb-section-head', { hasText: 'BACKGROUND' })).toBeVisible();
  await expect(page.locator('[data-note-add]')).toHaveCount(1);
  await expect(page.locator('[data-bg-row]')).toHaveCount(1);
  await expect(page.locator('[data-bg-row]')).toContainText('Nato nel Vault 111');

  // NOTE head carries the +, and the row shows title + last-update date.
  const row = page.locator('.pb-note-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Prima nota');
  await expect(row.locator('.pb-note-row-date')).not.toHaveText('');
});

test('adding a note: + opens an empty editor, SALVA with a title POSTs and the row appears', async ({ page }) => {
  const reqs = recordRequests(page);
  await openNotes(page, { notes: [] });

  await page.locator('[data-note-add]').click();
  const editor = page.locator('.pb-note-editor');
  await expect(editor).toBeVisible();
  await expect(editor.locator('[data-title]')).toHaveValue('');

  await editor.locator('[data-title]').fill('Nuova nota');
  await editor.locator('[data-body]').click();
  await page.keyboard.type('corpo della nota');
  await editor.locator('[data-save]').click();

  await expect(page.locator('.pb-note-editor')).toHaveCount(0);
  await expect(page.locator('.pb-note-row', { hasText: 'Nuova nota' })).toBeVisible();

  const post = reqs.find((r) => r.method === 'POST' && /\/notes$/.test(r.url));
  expect(post).toBeTruthy();
  expect(JSON.parse(post!.body!)).toMatchObject({ title: 'Nuova nota', note: 'corpo della nota' });
});

test('SALVA with an empty title is blocked: no request, editor stays open', async ({ page }) => {
  const reqs = recordRequests(page);
  await openNotes(page, { notes: [] });

  await page.locator('[data-note-add]').click();
  await page.locator('.pb-note-editor [data-body]').click();
  await page.keyboard.type('solo corpo');
  await page.locator('.pb-note-editor [data-save]').click();

  await expect(page.locator('.pb-note-editor')).toBeVisible();
  expect(reqs.some((r) => r.method === 'POST')).toBe(false);
});

test('editing an existing note PATCHes and the row updates', async ({ page }) => {
  const reqs = recordRequests(page);
  await openNotes(page, { notes: NOTES });

  await page.locator('.pb-note-row').click();
  const editor = page.locator('.pb-note-editor');
  await expect(editor.locator('[data-title]')).toHaveValue('Prima nota');
  // Stored markdown is shown as formatted text, not raw markers.
  await expect(editor.locator('[data-body]')).toContainText('Contenuto uno');
  await expect(editor.locator('[data-body]')).not.toContainText('**');

  await editor.locator('[data-title]').fill('Nota rinominata');
  await editor.locator('[data-save]').click();

  await expect(page.locator('.pb-note-editor')).toHaveCount(0);
  await expect(page.locator('.pb-note-row', { hasText: 'Nota rinominata' })).toBeVisible();
  expect(reqs.some((r) => r.method === 'PATCH' && /\/notes\/note-1$/.test(r.url))).toBe(true);
});

test('deleting a note asks for confirmation with two separated buttons, then DELETEs', async ({ page }) => {
  const reqs = recordRequests(page);
  await openNotes(page, { notes: NOTES });

  await page.locator('.pb-note-row').click();
  await page.locator('.pb-note-editor [data-delete]').click();

  const dialog = page.locator('.pb-confirm-dialog');
  await expect(dialog).toContainText('Eliminare questa nota?');
  // The two buttons do not share an edge: a real horizontal gap between them.
  const cancelBox = await dialog.locator('[data-cancel]').boundingBox();
  const confirmBox = await dialog.locator('[data-confirm]').boundingBox();
  expect(confirmBox!.x).toBeGreaterThan(cancelBox!.x + cancelBox!.width);

  await dialog.locator('[data-confirm]').click();
  await expect(page.locator('.pb-note-editor')).toHaveCount(0);
  await expect(page.locator('.pb-note-row')).toHaveCount(0);
  expect(reqs.some((r) => r.method === 'DELETE' && /\/notes\/note-1$/.test(r.url))).toBe(true);
});

test('background mode: fixed label, no title, no delete; SALVA PATCHes and clearing empties it', async ({ page }) => {
  const reqs = recordRequests(page);
  await openNotes(page, { background: null });

  // Add-prompt when unset.
  await expect(page.locator('[data-bg-row]')).toContainText('tocca per aggiungere');

  await page.locator('[data-bg-row]').click();
  const editor = page.locator('.pb-note-editor');
  await expect(editor.locator('.pb-popup-title')).toHaveText('BACKGROUND');
  await expect(editor.locator('[data-title]')).toHaveCount(0);
  await expect(editor.locator('[data-delete]')).toHaveCount(0);

  await editor.locator('[data-body]').click();
  await page.keyboard.type('Cresciuto nel deserto.');
  await editor.locator('[data-save]').click();

  await expect(page.locator('.pb-note-editor')).toHaveCount(0);
  await expect(page.locator('[data-bg-row]')).toContainText('Cresciuto nel deserto');
  const set = reqs.find((r) => r.method === 'PATCH' && /\/background$/.test(r.url));
  expect(JSON.parse(set!.body!)).toMatchObject({ background: 'Cresciuto nel deserto.' });

  // Clear by saving an empty body.
  await page.locator('[data-bg-row]').click();
  await page.locator('.pb-note-editor [data-body]').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.locator('.pb-note-editor [data-save]').click();

  await expect(page.locator('[data-bg-row]')).toContainText('tocca per aggiungere');
  const cleared = reqs.filter((r) => r.method === 'PATCH' && /\/background$/.test(r.url)).pop();
  expect(JSON.parse(cleared!.body!)).toMatchObject({ background: '' });
});

test('closing with unsaved changes prompts to discard; a clean close does not', async ({ page }) => {
  await openNotes(page, { notes: NOTES });

  // Dirty close → prompt. CHIUDI discards and closes.
  await page.locator('.pb-note-row').click();
  await page.locator('.pb-note-editor [data-body]').click();
  await page.keyboard.type(' extra');
  await page.locator('.pb-note-editor [data-cancel]').click();

  const dialog = page.locator('.pb-confirm-dialog');
  await expect(dialog).toContainText('Chiudere senza salvare?');
  await dialog.locator('[data-confirm]').click();
  await expect(page.locator('.pb-note-editor')).toHaveCount(0);

  // Clean close → no prompt, closes immediately.
  await page.locator('.pb-note-row').click();
  await expect(page.locator('.pb-note-editor')).toBeVisible();
  await page.locator('.pb-note-editor [data-cancel]').click();
  await expect(page.locator('.pb-confirm-dialog')).toHaveCount(0);
  await expect(page.locator('.pb-note-editor')).toHaveCount(0);
});

test('toolbar bold formats as rich text (no markers) and stores markdown', async ({ page }) => {
  const reqs = recordRequests(page);
  await openNotes(page, { notes: [] });

  await page.locator('[data-note-add]').click();
  const editor = page.locator('.pb-note-editor');
  await editor.locator('[data-title]').fill('Con grassetto');
  await editor.locator('[data-body]').click();
  await page.keyboard.type('ciao');
  await page.keyboard.press('Control+A');
  await editor.locator('[data-cmd="bold"]').click();

  // Rendered bold, no visible ** markers.
  await expect(editor.locator('[data-body] strong, [data-body] b')).toHaveCount(1);
  await expect(editor.locator('[data-body]')).not.toContainText('**');

  await editor.locator('[data-save]').click();
  const post = reqs.find((r) => r.method === 'POST' && /\/notes$/.test(r.url));
  expect(JSON.parse(post!.body!).note).toContain('**ciao**');
});

test('a non-owner sees empty states with no error banner', async ({ page }) => {
  // The viewer is not the owner, so the sheet is read-only and the
  // notes/background reads 404 — the tab shows its empty states.
  const character = makeCharacter({ userId: 'someone-else' });
  await stubEnvironment(page, { role: 'player', userId: 'user-player', character, notesForbidden: true });
  await openSheet(page);
  await gotoTab(page, 'INFO', 'Note');

  await expect(page.locator('[data-bg-row]')).toContainText('tocca per aggiungere');
  await expect(page.locator('.pb-note-row')).toHaveCount(0);
  await expect(page.locator('[data-note-list]')).toContainText('Nessuna nota');
  await expect(page.locator('.pb-error')).toHaveCount(0);
  // No add control for a non-owner.
  await expect(page.locator('[data-note-add]')).toHaveCount(0);
});

test('the ✕ close control never overlaps the title input', async ({ page }) => {
  await openNotes(page, { notes: [] });
  await page.locator('[data-note-add]').click();
  const editor = page.locator('.pb-note-editor');
  for (const viewport of [{ width: 320, height: 640 }, { width: 360, height: 640 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    const close = (await editor.locator('.pb-popup-close').boundingBox())!;
    const title = (await editor.locator('.pb-note-title').boundingBox())!;
    const intersects =
      close.x < title.x + title.width && title.x < close.x + close.width &&
      close.y < title.y + title.height && title.y < close.y + close.height;
    expect(intersects, `overlap at ${viewport.width}px`).toBe(false);
  }
});

test('toolbar buttons reflect the active format at the caret', async ({ page }) => {
  await openNotes(page, { notes: [] });
  await page.locator('[data-note-add]').click();
  const editor = page.locator('.pb-note-editor');
  const bold = editor.locator('[data-cmd="bold"]');
  const bullet = editor.locator('[data-cmd="bullet"]');

  await editor.locator('[data-body]').click();
  await page.keyboard.type('ciao fine');
  // Select "ciao" and bold it.
  await page.keyboard.press('Home');
  for (let k = 0; k < 4; k += 1) await page.keyboard.press('Shift+ArrowRight');
  await bold.click();
  await expect(bold).toHaveClass(/is-active/);

  // Caret outside the bold run → inactive.
  await page.keyboard.press('End');
  await expect(bold).not.toHaveClass(/is-active/);

  // Caret back inside the bold run → active again.
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(bold).toHaveClass(/is-active/);

  // Bullet toggles on and off.
  await bullet.click();
  await expect(bullet).toHaveClass(/is-active/);
  await bullet.click();
  await expect(bullet).not.toHaveClass(/is-active/);
});

/** Serialize the open editor's body with the app's own domToMd. */
async function bodyMd(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const { domToMd } = await import('/src/sheet/markdown.js');
    return domToMd(document.querySelector('.pb-note-editor [data-body]')!);
  });
}

test('toggling the bullet list on and off restores separate paragraphs', async ({ page }) => {
  await openNotes(page, { notes: [] });
  await page.locator('[data-note-add]').click();
  const editor = page.locator('.pb-note-editor');
  const body = editor.locator('[data-body]');

  await body.click();
  await page.keyboard.type('uno');
  await page.keyboard.press('Enter');
  await page.keyboard.type('due');
  await page.keyboard.press('Enter');
  await page.keyboard.type('tre');
  await page.keyboard.press('Control+A');

  await editor.locator('[data-cmd="bullet"]').click();
  await expect(body.locator(':scope > ul > li')).toHaveCount(3);
  await editor.locator('[data-cmd="bullet"]').click();

  await expect(body.locator('ul')).toHaveCount(0);
  await expect(body.locator('br')).toHaveCount(0);
  await expect(body.locator(':scope > p')).toHaveText(['uno', 'due', 'tre']);
  const md = await bodyMd(page);
  expect(md).toBe('uno\n\ndue\n\ntre');
  expect(md).not.toMatch(/(^|\n)- /);
  await expect(editor.locator('[data-cmd="bullet"]')).not.toHaveClass(/is-active/);
});

test('a bullet list added to a previously saved note is flat and saves as a list', async ({ page }) => {
  const reqs = recordRequests(page);
  const saved = [{ ...NOTES[0], note: 'uno\n\ndue\n\ntre' }];
  await openNotes(page, { notes: saved });

  await page.locator('.pb-note-row').click();
  const editor = page.locator('.pb-note-editor');
  const body = editor.locator('[data-body]');
  await expect(body.locator(':scope > p')).toHaveCount(3);

  await body.click();
  await page.keyboard.press('Control+A');
  await editor.locator('[data-cmd="bullet"]').click();

  await expect(body.locator(':scope > ul > li')).toHaveText(['uno', 'due', 'tre']);
  await expect(body.locator('p ul, li ul, li p')).toHaveCount(0);
  expect(await bodyMd(page)).toBe('- uno\n- due\n- tre');

  // The caret stays usable: typing continues at the end of the last item.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(' quattro');
  await expect(body.locator('li').last()).toHaveText('tre quattro');

  await editor.locator('[data-save]').click();
  const patch = reqs.find((r) => r.method === 'PATCH' && /\/notes\/note-1$/.test(r.url));
  expect(JSON.parse(patch!.body!).note).toBe('- uno\n- due\n- tre quattro');
});
