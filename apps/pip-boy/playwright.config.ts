import { defineConfig, devices } from '@playwright/test';

// Pip-boy is a build-free static app. Tests run it over a tiny local static
// server (tests/static-server.mjs) in headless Chromium — no nginx/Docker needed.
const PORT = Number(process.env.PORT) || 5174;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Two workers is the measured sweet spot: dice-roller.spec.ts runs in ~48s vs
  // ~1.5m on one worker. At four, `page.goto` intermittently times out with the
  // ES-module graph stalled before DOMContentLoaded — not the static server,
  // which serves 50 concurrent curls in ~20ms each. static-server.mjs scopes its
  // test overrides per browser context, so specs can share it in parallel.
  // PW_WORKERS overrides.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 2,
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
