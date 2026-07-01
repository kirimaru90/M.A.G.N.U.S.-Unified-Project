import { defineConfig, devices } from '@playwright/test';

// The emulator is a build-free static app. Tests run it over a tiny local static
// server (tests/static-server.mjs) in headless Chromium — no nginx/Docker needed.
const PORT = Number(process.env.PORT) || 5173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
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
