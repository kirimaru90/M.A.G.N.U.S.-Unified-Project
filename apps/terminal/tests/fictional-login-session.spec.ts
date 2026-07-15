import { test, expect, type Page } from '@playwright/test';

// Block the app's service worker: once it activates (a moment after load) it
// controls the page and page.route no longer intercepts its fetches — the
// post-login POST would otherwise escape to the network. Blocking keeps every
// request on the stub layer for the whole test.
test.use({ serviceWorkers: 'block' });

// These tests exercise the per-terminal fictional-login session model in
// engine/login-fictional.js and its wiring through main.js / screens/terminal.js:
//   - the authenticated set is keyed by (terminalId, username) so a login on one
//     terminal never satisfies another terminal's gate;
//   - disconnecting a terminal clears its authentication (logout);
//   - a session-scoped remembered-credentials cache survives disconnect and
//     pre-fills the login overlay on reconnect (without auto-bypassing the gate).
// The suite is hermetic: API, fonts, service worker, and the `marked` CDN are stubbed.

const CAMPAIGNS = [{ id: 'camp-1', name: 'Vault 111', isPublic: true }];

type LoginBlock = { users: { username: string }[]; gateOnBoot?: boolean };

// A playback payload (same shape as GET /terminals/:id/load) with a root boot
// login gate. `start` carries a disconnect button (history length 1).
function loadPayload(terminalId: string, login: LoginBlock, text = 'CONTENUTO PRINCIPALE') {
  return {
    content: {
      meta: { id: terminalId, title: terminalId },
      login,
      nodes: {
        start: { text, choices: [] },
      },
    },
    localState: {},
    globalState: {},
  };
}

interface StubOptions {
  terminals: { id: string; title: string; isPublic: boolean }[];
  payloads: Record<string, ReturnType<typeof loadPayload>>;
  // username -> valid password; a fictional-login POST succeeds only when it matches.
  credentials: Record<string, string>;
}

async function stubEnvironment(page: Page, opts: StubOptions) {
  // Default: any /api/ call fails, so an un-stubbed path surfaces loudly. The
  // fictional-login endpoint is excluded so its dedicated route always handles it.
  await page.route(
    (url) => url.pathname.startsWith('/api/') && !/\/fictional-login$/.test(url.pathname),
    (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.route(
    (url) => url.pathname === '/api/campaigns',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAMPAIGNS) }),
  );
  await page.route(
    (url) => url.pathname === '/api/campaigns/camp-1/terminals',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.terminals) }),
  );
  for (const [id, payload] of Object.entries(opts.payloads)) {
    await page.route(
      (url) => url.pathname === `/api/terminals/${id}/load`,
      (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }),
    );
  }
  // Server-side fictional-login validation: 200 on a matching password, 401 otherwise.
  await page.route(
    (url) => /\/fictional-login$/.test(url.pathname),
    (route) => {
      let ok = false;
      try {
        const body = route.request().postDataJSON() as { username: string; password: string };
        ok = opts.credentials[body.username] === body.password;
      } catch {
        ok = false;
      }
      route.fulfill({
        status: ok ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(ok ? { username: 'ok' } : { message: 'invalid' }),
      });
    },
  );
  // Offline-safe: fonts off, service worker off, `marked` shimmed.
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

// Boot → (single campaign auto-enters) terminal list. Opens the named terminal.
async function openTerminal(page: Page, title: string) {
  await expect(page.locator('#boot-screen')).toBeVisible();
  await page.getByRole('button', { name: `[ ${title} ]` }).click();
}

async function submitLogin(page: Page, password: string) {
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: '[ ACCEDI ]' }).click();
}

async function disconnect(page: Page) {
  await page.getByRole('button', { name: 'disconnetti terminale' }).click();
}

test('3.5 login on one terminal does not unlock another terminal sharing the username', async ({ page }) => {
  await stubEnvironment(page, {
    terminals: [
      { id: 'term-a', title: 'Alpha', isPublic: true },
      { id: 'term-b', title: 'Bravo', isPublic: true },
    ],
    payloads: {
      'term-a': loadPayload('term-a', { users: [{ username: 'tec' }] }, 'CONTENUTO ALPHA'),
      'term-b': loadPayload('term-b', { users: [{ username: 'tec' }] }, 'CONTENUTO BRAVO'),
    },
    credentials: { tec: '1234' },
  });

  await page.goto('/index.html');
  await openTerminal(page, 'Alpha');

  // Terminal A gates at boot; authenticate.
  await expect(page.locator('#login-screen')).toBeVisible();
  await submitLogin(page, '1234');
  await expect(page.locator('#screen-content')).toContainText('CONTENUTO ALPHA');

  // Leave A and open B, which gates the same username on a different terminal.
  await disconnect(page);
  await openTerminal(page, 'Bravo');

  // A's authentication must NOT satisfy B's gate: B re-presents the login overlay
  // and its own content stays hidden until B is authenticated.
  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#screen-content')).not.toContainText('CONTENUTO BRAVO');
});

test('3.6 disconnect clears authentication — reconnecting re-presents the login overlay', async ({ page }) => {
  await stubEnvironment(page, {
    terminals: [{ id: 'term-a', title: 'Alpha', isPublic: true }],
    payloads: { 'term-a': loadPayload('term-a', { users: [{ username: 'tec' }] }) },
    credentials: { tec: '1234' },
  });

  await page.goto('/index.html');
  await openTerminal(page, 'Alpha');

  await expect(page.locator('#login-screen')).toBeVisible();
  await submitLogin(page, '1234');
  await expect(page.locator('#screen-content')).toContainText('CONTENUTO PRINCIPALE');

  await disconnect(page);
  await openTerminal(page, 'Alpha');

  // Logout on disconnect: the gate must re-present rather than auto-satisfy.
  await expect(page.locator('#login-screen')).toBeVisible();
});

test('3.7 reconnect pre-fills the remembered username and password; [ ACCEDI ] re-validates', async ({ page }) => {
  await stubEnvironment(page, {
    terminals: [{ id: 'term-a', title: 'Alpha', isPublic: true }],
    payloads: { 'term-a': loadPayload('term-a', { users: [{ username: 'tec' }] }) },
    credentials: { tec: '1234' },
  });

  await page.goto('/index.html');
  await openTerminal(page, 'Alpha');

  await expect(page.locator('#login-screen')).toBeVisible();
  await submitLogin(page, '1234');
  await expect(page.locator('#screen-content')).toContainText('CONTENUTO PRINCIPALE');

  await disconnect(page);
  await openTerminal(page, 'Alpha');

  // Overlay reappears pre-filled from the remembered-credentials cache.
  await expect(page.locator('#login-screen')).toBeVisible();
  await expect(page.locator('#login-username')).toHaveValue('tec');
  await expect(page.locator('#login-password')).toHaveValue('1234');

  // Confirming re-validates against the server and renders the node.
  await page.getByRole('button', { name: '[ ACCEDI ]' }).click();
  await expect(page.locator('#screen-content')).toContainText('CONTENUTO PRINCIPALE');
});

test('3.8 regression: gateOnBoot:false with a non-empty registry navigates straight to start', async ({ page }) => {
  await stubEnvironment(page, {
    terminals: [{ id: 'term-a', title: 'Alpha', isPublic: true }],
    payloads: { 'term-a': loadPayload('term-a', { users: [{ username: 'tec' }], gateOnBoot: false }) },
    credentials: { tec: '1234' },
  });

  await page.goto('/index.html');
  await openTerminal(page, 'Alpha');

  await expect(page.locator('#screen-content')).toContainText('CONTENUTO PRINCIPALE');
  await expect(page.locator('#login-screen')).toBeHidden();
});
