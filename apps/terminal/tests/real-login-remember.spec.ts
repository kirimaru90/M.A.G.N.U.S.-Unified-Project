import { test, expect, type Page } from '@playwright/test';

// "Ricordami" on the real-user login: the token goes to localStorage when the
// toggle is on, sessionStorage otherwise, and logout clears both. Hermetic —
// the API, fonts, service worker and `marked` CDN are stubbed.

// A registered service worker would serve fetches past page.route stubs.
test.use({ serviceWorkers: 'block' });

const KEY = 'robco_session';
// Two campaigns so the chooser does not auto-enter the terminal list.
const CAMPAIGNS = [
  { id: 'camp-1', name: 'Vault 111', isPublic: true },
  { id: 'camp-2', name: 'Vault 101', isPublic: true },
];
const USER = { id: 'u1', username: 'alice', role: 'player', lastCampaignId: null };

async function stubEnvironment(page: Page, loginBodies: unknown[]) {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.route(
    (url) => url.pathname === '/api/campaigns',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAMPAIGNS) }),
  );
  await page.route(
    (url) => url.pathname === '/api/auth/login',
    (route) => {
      loginBodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'jwt-abc', role: 'player', expiresIn: 86400 }),
      });
    },
  );
  await page.route(
    (url) => url.pathname === '/api/auth/me',
    (route) =>
      route.request().headers()['authorization'] === 'Bearer jwt-abc'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) })
        : route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  );
  await page.route(
    (url) => url.pathname === '/api/auth/logout',
    (route) => route.fulfill({ status: 204, body: '' }),
  );
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

async function storedTokens(page: Page) {
  return page.evaluate((key) => ({
    local: localStorage.getItem(key),
    session: sessionStorage.getItem(key),
  }), KEY);
}

async function openLogin(page: Page) {
  await page.goto('/index.html');
  await page.getByRole('button', { name: '[ Accedi ]' }).click();
  await expect(page.locator('#login-real-screen')).toBeVisible();
}

async function submit(page: Page) {
  await page.locator('#login-real-username').fill('alice');
  await page.locator('#login-real-password').fill('pw');
  await page.locator('#login-real-submit').click();
  await expect(page.getByText('UTENTE alice AUTENTICATO')).toBeVisible();
}

test('Ricordami is off on open and toggles via keyboard', async ({ page }) => {
  await stubEnvironment(page, []);
  await openLogin(page);

  const toggle = page.locator('#login-real-remember');
  await expect(toggle).toHaveText('[ ] RICORDAMI');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  // username → password → Ricordami
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveText('[X] RICORDAMI');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveText('[ ] RICORDAMI');

  // Turned on, cancelled, reopened → off again.
  await page.keyboard.press('Enter');
  await page.locator('#login-real-back').click();
  await page.getByRole('button', { name: '[ Accedi ]' }).click();
  await expect(toggle).toHaveText('[ ] RICORDAMI');
});

test('remembered login → localStorage only, survives a reopened page', async ({ page, context }) => {
  const bodies: unknown[] = [];
  await stubEnvironment(page, bodies);
  await openLogin(page);
  await page.locator('#login-real-remember').click();
  await submit(page);

  expect(bodies).toEqual([{ username: 'alice', password: 'pw', rememberMe: true }]);
  expect(await storedTokens(page)).toEqual({ local: 'jwt-abc', session: null });

  // A fresh page in the same context has an empty sessionStorage, like a reopened app.
  await page.close();
  const reopened = await context.newPage();
  await stubEnvironment(reopened, []);
  await reopened.goto('/index.html');
  await expect(reopened.getByText('UTENTE alice AUTENTICATO')).toBeVisible();
});

test('non-remembered login → sessionStorage only', async ({ page }) => {
  const bodies: unknown[] = [];
  await stubEnvironment(page, bodies);
  await openLogin(page);
  await submit(page);

  expect(bodies).toEqual([{ username: 'alice', password: 'pw', rememberMe: false }]);
  expect(await storedTokens(page)).toEqual({ local: null, session: 'jwt-abc' });
});

test('logout clears both stores', async ({ page }) => {
  await stubEnvironment(page, []);
  await openLogin(page);
  await page.locator('#login-real-remember').click();
  await submit(page);
  // A leftover in the other store must be cleared too.
  await page.evaluate((key) => sessionStorage.setItem(key, 'stale'), KEY);

  await page.getByRole('button', { name: /Disconnetti utente/ }).click();
  await expect(page.getByText('UTENTE ANONIMO')).toBeVisible();
  expect(await storedTokens(page)).toEqual({ local: null, session: null });
});
