import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, openSheet, TWO_CAMPAIGNS } from './fixtures';

// "Ricordami" on the login form: the token goes to localStorage when checked,
// sessionStorage otherwise, and logout clears both.

const KEY = 'pipboy_session';

function recordLoginBodies(page: Page) {
  const bodies: unknown[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname.endsWith('/auth/login')) {
      bodies.push(req.postDataJSON());
    }
  });
  return bodies;
}

async function storedTokens(page: Page) {
  return page.evaluate((key) => ({
    local: localStorage.getItem(key),
    session: sessionStorage.getItem(key),
  }), KEY);
}

async function submitLogin(page: Page, remember: boolean) {
  await page.goto('/index.html');
  await expect(page.locator('#pb-login-remember')).not.toBeChecked();
  await page.locator('#pb-login-username').fill('player1');
  await page.locator('#pb-login-password').fill('pass');
  if (remember) await page.getByText('RICORDAMI').click();
  await page.locator('#pb-login-submit').click();
  await expect(page.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toBeVisible();
}

test('remembered login → localStorage only, survives reopen and lands past login', async ({ page, context }) => {
  const bodies = recordLoginBodies(page);
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await submitLogin(page, true);

  expect(bodies).toEqual([{ username: 'player1', password: 'pass', rememberMe: true }]);
  expect(await storedTokens(page)).toEqual({ local: 'test-token', session: null });

  // A fresh page in the same context starts with an empty sessionStorage, like a reopened app.
  await page.close();
  const reopened = await context.newPage();
  await stubEnvironment(reopened, { campaigns: TWO_CAMPAIGNS });
  await reopened.goto('/index.html');
  await expect(reopened.getByRole('heading', { name: 'SELEZIONA CAMPAGNA' })).toBeVisible();
  await expect(reopened.locator('#pb-login-submit')).toHaveCount(0);
});

test('non-remembered login → sessionStorage only', async ({ page }) => {
  const bodies = recordLoginBodies(page);
  await stubEnvironment(page, { campaigns: TWO_CAMPAIGNS });
  await submitLogin(page, false);

  expect(bodies).toEqual([{ username: 'player1', password: 'pass', rememberMe: false }]);
  expect(await storedTokens(page)).toEqual({ local: null, session: 'test-token' });
});

test('logout clears both stores', async ({ page }) => {
  await stubEnvironment(page);
  await page.addInitScript((key) => {
    // Remembered session plus a leftover in the other store.
    localStorage.setItem(key, 'test-token');
    sessionStorage.setItem(key, 'stale');
  }, KEY);
  await page.goto('/index.html');
  await page.locator('.pb-dossier-card', { hasText: 'Marta Voss' }).click();
  await page.locator('#pb-sheet-header').waitFor();

  await page.locator('#pb-nav-exit').click();
  await page.locator('.pb-confirm-dialog [data-confirm]').click();
  await expect(page.locator('#pb-login-submit')).toBeVisible();

  expect(await storedTokens(page)).toEqual({ local: null, session: null });
});

test('the default login helper still works without touching the checkbox', async ({ page }) => {
  await stubEnvironment(page);
  await openSheet(page);
  expect(await storedTokens(page)).toEqual({ local: null, session: 'test-token' });
});
