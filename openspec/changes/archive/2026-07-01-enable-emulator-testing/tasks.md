## 1. Dev tooling

- [x] 1.1 Add `apps/terminal/package.json` (dev-only) with `@playwright/test` as a
  devDependency and a `test` script running `playwright test` (+ `test:headed`, `test:ui`)
- [x] 1.2 Install and run `npx playwright install chromium` to fetch the bundled browser
  (@playwright/test 1.61.1, Chromium installed)
- [x] 1.3 Confirm no production file (`index.html`, `src/`, `sw.js`, Docker/nginx) is
  modified — only dev files added; `.gitignore` extended for Playwright artifacts

## 2. Harness configuration

- [x] 2.1 Add `apps/terminal/playwright.config.ts` with a `webServer` that serves the static
  app root over HTTP (`tests/static-server.mjs`, a dependency-free Node static server with
  correct JS MIME for ES modules) and a `baseURL`; project targets headless Chromium
- [x] 2.2 Service worker neutralized in the test context: the smoke test aborts `**/sw.js*`
  (and external font/CDN requests) so runs are offline-safe and free of cache flakiness

## 3. Smoke test

- [x] 3.1 Add `apps/terminal/tests/boot.spec.ts` — navigate to `index.html`, assert the
  campaign-select screen renders the ROBCO header + a campaign button, and that there are no
  uncaught page errors
- [x] 3.2 Extend with a navigation step: click a campaign → assert the chooser hides and the
  terminal-list (`#boot-screen`) becomes visible, proving the engine runs end-to-end. The
  backend is mocked (`/campaigns` stubbed; all other API calls fail fast and are handled by
  the app's own try/catch)

## 4. Verification (green-gate)

- [x] 4.1 Run `npx playwright test` (via `npm test`) from `apps/terminal` — starts the static
  server, loads the real `index.html`, both tests pass, exit 0
- [x] 4.2 Confirm the run uses only Playwright's bundled Chromium (no system browser, no
  running nginx/Docker); a JSON report is written to `test-results/results.json`
- [x] 4.3 Negative check: broke an assertion → run exited non-zero (1 failed), then reverted
- [x] 4.4 Update `apps/terminal/README.md` with `npx playwright test` usage
