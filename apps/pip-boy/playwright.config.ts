import { defineConfig, devices } from '@playwright/test';

// Pip-boy is a build-free static app. Tests run it over a tiny local static
// server (tests/static-server.mjs) in headless Chromium — no nginx/Docker needed.
const PORT = Number(process.env.PORT) || 5174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Serial by necessity: tests/static-server.mjs stalls under concurrent
  // connections, which makes `page.goto` time out waiting for `load` on a
  // random subset of specs. The whole suite runs in ~35s on one worker.
  // Raise this once the static server handles concurrency.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Service workers persist per-origin across test runs (installed by one
    // spec, they'd otherwise silently intercept fetches in every later run —
    // see tests/pwa-installability.spec.ts, which opts back in with
    // `test.use({ serviceWorkers: 'allow' })` to exercise registration itself).
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ./tests/static-server.mjs',
    url: `${BASE_URL}/index.html`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
