import { test, expect } from '@playwright/test';

// Same-origin API contract (deploy-reverse-proxy): the emulator must address the
// API via the relative path /api/* on its own origin — never an absolute
// http://localhost:3000 origin — so that, served behind the edge proxy, app and
// API share one origin and no CORS is involved. This test drives the boot flow
// (which loads campaigns) and asserts the resulting request is a same-origin
// /api/* request that succeeds.

const CAMPAIGNS = [
  { id: 'camp-1', name: 'Vault 111', isPublic: true },
  { id: 'camp-2', name: 'Vault 76', isPublic: true },
];

test('campaign load issues a same-origin /api request and no absolute API origin', async ({
  page,
  baseURL,
}) => {
  const apiRequests: string[] = [];
  let sawAbsoluteApiOrigin = false;

  page.on('request', (req) => {
    const raw = req.url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1):3000\//.test(raw)) sawAbsoluteApiOrigin = true;
    if (new URL(raw).pathname.startsWith('/api/')) apiRequests.push(raw);
  });

  // Match on pathname so the app's own /src/api/*.js modules (which also contain
  // '/api/') are not intercepted.
  await page.route(
    (url) => url.pathname === '/api/campaigns',
    (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CAMPAIGNS) }),
  );
  // Offline-safe: drop external font/CDN requests and the service worker.
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/, (route) => route.abort());
  await page.route('**/sw.js*', (route) => route.abort());

  await page.goto('/index.html');

  // The API-backed flow succeeded: the campaign from the mocked /api response renders.
  await expect(page.getByRole('button', { name: 'Vault 111' })).toBeVisible();

  // The request targeted a relative /api/* path on the app's own origin...
  const campaignReq = apiRequests.find((u) => new URL(u).pathname === '/api/campaigns');
  expect(
    campaignReq,
    `expected a request to /api/campaigns, saw: ${apiRequests.join(', ') || '(none)'}`,
  ).toBeTruthy();
  expect(campaignReq!.startsWith(baseURL ?? '')).toBe(true);
  // ...and no request ever went to an absolute localhost:3000 API origin.
  expect(sawAbsoluteApiOrigin, 'app must not call an absolute localhost:3000 API origin').toBe(false);
});
