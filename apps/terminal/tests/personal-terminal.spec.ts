import { test, expect, type Page } from '@playwright/test';

// Verifies the emulator's personal-terminal flow end-to-end over the bundled
// static server with a fully mocked API: the authenticated-only list entry, the
// character picker, and playing the server-generated terminal through the normal
// engine. Hermetic — API, fonts, service worker, and the `marked` CDN are stubbed
// so the suite runs offline and deterministically.

const CAMPAIGNS = [{ id: 'camp-1', name: 'Vault 111', isPublic: true }];
const TERMINALS = [{ id: 'term-1', title: 'Guida', isPublic: true }];
const USER = { id: 'user-1', username: 'ada', role: 'player' };

// Server-generated personal-terminal payload (same shape as /terminals/:id/load).
const TERMINAL_PAYLOAD = {
  content: {
    meta: { id: 'char-1', title: 'SCHEDA PERSONALE — Ada', public: false },
    nodes: {
      start: {
        text: '## SCHEDA PERSONALE — ADA\n\nSeleziona una sezione.',
        choices: [
          { label: 'Riepilogo scheda', target: 'summary' },
          { label: 'Background', target: 'background' },
          { label: 'Note', target: 'notes' },
        ],
      },
      summary: { text: '## ADA / RIEPILOGO' },
      background: { text: '## ADA / BACKGROUND\n\nNessun background registrato.' },
      notes: { text: '## ADA / NOTE\n\nNessuna nota.' },
    },
  },
  localState: {},
  globalState: {},
};

async function stubBase(page: Page) {
  // Broad catch-all first (least specific), then the specific routes — Playwright
  // prefers the most recently registered matching route.
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.route(
    (url) => url.pathname === '/api/campaigns',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAMPAIGNS) }),
  );
  await page.route(
    (url) => url.pathname === '/api/campaigns/camp-1/terminals',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TERMINALS) }),
  );
  // Offline-safe: fonts off, service worker off, `marked` shim (renders text as-is).
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  await page.route('**/sw.js*', (route) => route.abort());
  await page.route(/cdn\.jsdelivr\.net\/.*marked/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.marked = { parse: function (t) { return t || ""; } };',
    }),
  );
}

// Simulate an authenticated session: seed the session token before any app
// script runs, and answer /auth/me with a user (no lastCampaignId, so boot lands
// on campaign selection → single-campaign auto-enter → terminal list).
async function authenticate(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('robco_session', 'test-token');
    } catch (_) {
      /* ignore */
    }
  });
  await page.route(
    (url) => url.pathname === '/api/auth/me',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) }),
  );
}

async function mockCharacters(page: Page, characters: unknown[]) {
  await page.route(
    (url) => url.pathname === '/api/campaigns/camp-1/characters',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(characters) }),
  );
}

async function mockCharacterTerminal(page: Page) {
  await page.route(
    (url) => url.pathname === '/api/campaigns/camp-1/characters/char-1/terminal',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TERMINAL_PAYLOAD) }),
  );
}

test('authenticated session shows [ SCHEDA PERSONALE ]; anonymous does not', async ({
  browser,
}) => {
  // Anonymous: no token, no entry.
  const anon = await browser.newPage();
  await stubBase(anon);
  await anon.goto('/index.html');
  await expect(anon.locator('#boot-screen')).toBeVisible();
  await expect(anon.getByRole('button', { name: '[ Guida ]' })).toBeVisible();
  await expect(anon.getByRole('button', { name: '[ SCHEDA PERSONALE ]' })).toHaveCount(0);
  await anon.close();

  // Authenticated: the entry appears.
  const authed = await browser.newPage();
  await stubBase(authed);
  await authenticate(authed);
  await authed.goto('/index.html');
  await expect(authed.locator('#boot-screen')).toBeVisible();
  await expect(authed.getByRole('button', { name: '[ SCHEDA PERSONALE ]' })).toBeVisible();
  await authed.close();
});

test('selecting the entry renders the picker and plays the chosen character terminal', async ({
  page,
}) => {
  await stubBase(page);
  await authenticate(page);
  await mockCharacters(page, [{ id: 'char-1', name: 'Ada' }]);
  await mockCharacterTerminal(page);

  // Track that no stored-terminal load is issued when opening the personal entry.
  const storedLoads: string[] = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.match(/\/api\/terminals\/.*\/load/)) {
      storedLoads.push(req.url());
    }
  });

  await page.goto('/index.html');
  await expect(page.getByRole('button', { name: '[ SCHEDA PERSONALE ]' })).toBeVisible();

  await page.getByRole('button', { name: '[ SCHEDA PERSONALE ]' }).click();

  // Picker lists the player's character.
  await expect(page.locator('#boot-screen')).toContainText('SELEZIONARE PERSONAGGIO');
  await expect(page.getByRole('button', { name: '[ Ada ]' })).toBeVisible();
  expect(storedLoads, 'no stored-terminal load on opening the personal entry').toEqual([]);

  // Choosing the character generates + plays the terminal through the normal engine.
  await page.getByRole('button', { name: '[ Ada ]' }).click();
  await expect(page.locator('#screen-content')).toContainText('SCHEDA PERSONALE — ADA');
  await expect(page.getByRole('button', { name: 'Riepilogo scheda' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Background' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Note' })).toBeVisible();
});

test('empty character list renders NESSUN PERSONAGGIO with a working back control', async ({
  page,
}) => {
  await stubBase(page);
  await authenticate(page);
  await mockCharacters(page, []);

  await page.goto('/index.html');
  await page.getByRole('button', { name: '[ SCHEDA PERSONALE ]' }).click();

  await expect(page.locator('#boot-screen')).toContainText('NESSUN PERSONAGGIO');

  // Back returns to the terminal list.
  await page.getByRole('button', { name: '[ Indietro ]' }).click();
  await expect(page.getByRole('button', { name: '[ SCHEDA PERSONALE ]' })).toBeVisible();
});
