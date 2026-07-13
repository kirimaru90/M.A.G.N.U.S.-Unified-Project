import { test, expect, type Page } from '@playwright/test';

// These tests exercise the root login boot-gate decision in main.js:
//   show login before `start`  ⇔  login.users.length > 0  AND  gateOnBoot !== false
// They are hermetic — the API, external fonts, the service worker, and the
// `marked` CDN are all stubbed so the suite runs offline and deterministically.

const CAMPAIGNS = [{ id: 'camp-1', name: 'Vault 111', isPublic: true }];
const TERMINALS = [{ id: 'term-1', title: 'Guida', isPublic: true }];

type LoginBlock = { users: { username: string }[]; gateOnBoot?: boolean };

// A playback payload (same shape as GET /terminals/:id/load) whose root login
// carries the given gate flag. `start` links to a node with its own login gate.
function loadPayload(login: LoginBlock) {
  return {
    content: {
      meta: { id: 'term-1', title: 'Guida' },
      login,
      nodes: {
        start: {
          text: 'CONTENUTO PRINCIPALE',
          choices: [{ label: '[ Area riservata ]', target: 'segreto' }],
        },
        segreto: {
          text: 'ZONA SEGRETA',
          login: { users: [{ username: 'tec' }] },
          choices: [],
        },
      },
    },
    localState: {},
    globalState: {},
  };
}

async function stubEnvironment(page: Page, login: LoginBlock) {
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
  await page.route(
    (url) => url.pathname === '/api/terminals/term-1/load',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(loadPayload(login)) }),
  );
  // Offline-safe: fonts off, service worker off, and a `marked` shim in place of
  // the CDN bundle so node text renders without a network fetch.
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

// Drive: boot → terminal list → open the terminal, triggering load. With a single
// stubbed campaign the chooser auto-enters (campaign-select.js single-campaign path),
// landing straight on the terminal list.
async function openTerminal(page: Page) {
  await page.goto('/index.html');
  await expect(page.locator('#boot-screen')).toBeVisible();
  await page.getByRole('button', { name: '[ Guida ]' }).click();
}

test('gateOnBoot:false → no boot login gate; start renders; node-level gate still fires', async ({ page }) => {
  await stubEnvironment(page, { users: [{ username: 'tec' }], gateOnBoot: false });
  await openTerminal(page);

  // No login overlay at boot; `start` content renders directly.
  await expect(page.locator('#screen-content')).toContainText('CONTENUTO PRINCIPALE');
  await expect(page.locator('#login-screen')).toBeHidden();

  // Navigating to a node that carries its own login.users still gates.
  await page.getByRole('button', { name: 'Area riservata' }).click();
  await expect(page.locator('#login-screen')).toBeVisible();
});

test('gateOnBoot:true → login overlay appears before start', async ({ page }) => {
  await stubEnvironment(page, { users: [{ username: 'tec' }], gateOnBoot: true });
  await openTerminal(page);

  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#screen-content')).not.toContainText('CONTENUTO PRINCIPALE');
});

test('gateOnBoot omitted → login overlay appears before start (backward-compat)', async ({ page }) => {
  await stubEnvironment(page, { users: [{ username: 'tec' }] });
  await openTerminal(page);

  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#screen-content')).not.toContainText('CONTENUTO PRINCIPALE');
});
