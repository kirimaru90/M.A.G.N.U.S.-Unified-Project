## Why

The new testing rules in `openspec/config.yaml` require every `emulator-*` change to run
`npx playwright test` green before it can be archived, superseding the old manual
"open index.html in a browser" verification wherever practical. Today `apps/terminal` has
**no package.json, no test runner, and no automation** — it is vanilla HTML/CSS/JS served
statically. This change adds a Playwright harness so the `emulator-*` testing rules become
enforceable and the previously-manual browser checks become repeatable.

## What Changes

- Add `apps/terminal/package.json` (dev-only; the app itself still ships as static files
  with no build step)
- Add `@playwright/test` as a dev-dependency and a `playwright.config.ts`
- Serve the static app for tests via Playwright's `webServer` (a lightweight static file
  server), so tests exercise the **real** `index.html` as shipped
- Add a first smoke test: load `index.html`, assert the terminal boots and one navigation
  step works
- Document `npx playwright test` usage in the terminal README

Non-goals: no build step, no bundler, no framework — the emulator stays pure static files.
The harness is strictly a dev/test-time addition.

## Capabilities

### New Capabilities

- `emulator-testing`: An automated end-to-end harness for the emulator — Playwright loads
  the shipped `index.html` in headless Chromium and asserts on the live DOM, runnable via
  `npx playwright test`

### Modified Capabilities

## Impact

- New `apps/terminal/package.json` and `playwright.config.ts`; the shipped runtime
  (`index.html`, `src/`, `sw.js`, Docker/nginx) is unchanged
- Agents and CI can run `npx playwright test` from `apps/terminal` as a gate
- Environmental: Playwright installs its own headless Chromium (one-time download); no
  system browser or global install required
- Unblocks every future `emulator-*` change from satisfying the mandatory-test rules and
  lets the existing manual "open in browser" rule be automated

## Testing

This change's own verification (meta-testing — the deliverable *is* the test harness):

- **E2E**: `npx playwright test` from `apps/terminal` starts the static server, loads
  `index.html` in headless Chromium, and the smoke test passes (boot + one navigation)
- **Negative**: a deliberately wrong assertion in the smoke test makes the run exit
  non-zero (proves the gate fails a red suite)
- **Environment**: the run works with only Playwright's bundled Chromium — no external
  browser, no running nginx/Docker
