import { test, expect, type Page } from '@playwright/test';

// The emulator talks to a backend at http://localhost:3000. These tests are
// hermetic: we mock /campaigns, fail every other API call fast (the app handles
// those in try/catch), and neutralize external CDNs + the service worker so the
// suite runs offline and deterministically.
const API = 'http://localhost:3000';

const CAMPAIGNS = [
  { id: 'camp-1', name: 'Vault 111', isPublic: true },
  { id: 'camp-2', name: 'Vault 76', isPublic: true },
];

async function stubEnvironment(page: Page) {
  // Order matters: Playwright prefers the most recently registered matching
  // route, so the broad API catch-all is registered before the specific one.
  await page.route(`${API}/**`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/campaigns', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAMPAIGNS) }),
  );
  // Offline-safe: drop external font/CDN requests and the service worker.
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/, (route) => route.abort());
  await page.route('**/sw.js*', (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await stubEnvironment(page);
});

test('boots to the campaign selection screen without page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/index.html');

  const chooser = page.locator('#campaign-select-screen');
  await expect(chooser).toBeVisible();
  await expect(chooser).toContainText('ROBCO INDUSTRIES');
  await expect(page.getByRole('button', { name: 'Vault 111' })).toBeVisible();

  expect(pageErrors, `unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
});

test('selecting a campaign navigates away from the chooser', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#campaign-select-screen')).toBeVisible();

  await page.getByRole('button', { name: 'Vault 111' }).click();

  // A real navigation: the chooser hides and the terminal-list (boot) screen shows.
  await expect(page.locator('#campaign-select-screen')).toBeHidden();
  await expect(page.locator('#boot-screen')).toBeVisible();
});
