import { test, expect, type Page } from '@playwright/test';
import { stubEnvironment, login, makeCharacter, nextFrames } from './fixtures';

// Session re-verification on resume (Task 8). A returning-to-foreground event
// (visibilitychange → visible) re-checks the session via GET /auth/me: a valid
// token silently refreshes the character in place, a 401 routes to login, a
// transport blip is a no-op, and an anonymous resume issues no request.

async function openOwnerSheet(page: Page) {
  const character = makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player' });
  await stubEnvironment(page, {
    role: 'player',
    userId: 'user-player',
    lastCampaignId: 'camp-1',
    lastCharacterId: 'char-1',
    character,
  });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
}

const resume = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

test('resume with a valid token silently reloads the character in place (no login)', async ({ page }) => {
  await openOwnerSheet(page);

  // The server now returns a renamed character; a valid re-verify must reload it
  // in place without prompting for login.
  await page.route(/\/campaigns\/[^/]+\/characters\/[^/]+$/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeCharacter({ id: 'char-1', campaignId: 'camp-1', userId: 'user-player', name: 'Marta Nuova' })),
    });
  });

  await resume(page);

  await expect(page.getByRole('heading', { name: 'Marta Nuova' })).toBeVisible();
  await expect(page.locator('#pb-login-username')).toHaveCount(0);
});

test('resume with an expired token clears the session and routes to login', async ({ page }) => {
  await openOwnerSheet(page);

  await page.route('**/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"expired"}' }));

  await resume(page);

  await expect(page.locator('#pb-login-username')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toHaveCount(0);
});

test('resume while offline keeps the current screen and does not log out', async ({ page }) => {
  await openOwnerSheet(page);

  // A transport failure (no HTTP status) must not be treated as expired.
  await page.route('**/auth/me', (route) => route.abort());

  const failed = page.waitForEvent('requestfailed', (r) => r.url().includes('/auth/me'));
  await resume(page);

  // Once the aborted request has failed and the app has had a frame to react,
  // confirm we stayed put.
  await failed;
  await nextFrames(page);
  await expect(page.getByRole('heading', { name: 'Marta Voss' })).toBeVisible();
  await expect(page.locator('#pb-login-username')).toHaveCount(0);
});

test('resume while anonymous issues no /auth/me request', async ({ page }) => {
  // No stored session: land on the login screen.
  await stubEnvironment(page, { role: 'player' });
  await page.goto('/index.html');
  await expect(page.locator('#pb-login-username')).toBeVisible();

  let meCalls = 0;
  page.on('request', (req) => { if (req.url().includes('/auth/me')) meCalls += 1; });

  await resume(page);
  // The resume handler runs inside dispatchEvent, so any /auth/me it issued
  // would reach Playwright before this later sentinel request does.
  await Promise.all([
    page.waitForRequest('**/manifest.webmanifest'),
    page.evaluate(() => fetch('manifest.webmanifest')),
  ]);

  expect(meCalls).toBe(0);
  await expect(page.locator('#pb-login-username')).toBeVisible();
});
