## Context

`apps/terminal` is intentionally build-free: vanilla HTML5/CSS3/JS, marked.js via CDN,
manifest-driven JSON content, served by Docker + nginx. Any test harness must respect that
constraint — it can add dev-time tooling but must not introduce a build step or alter how
the app ships. The right level for automated tests is **end-to-end against the real
`index.html`**, which is exactly what the manual rule does today, just repeatable.

## Decisions

### Runner: Playwright (`@playwright/test`)
- **Playwright** — chosen. Bundles its own headless Chromium (no system browser, no global
  install), loads the shipped `index.html` unchanged, asserts on the live DOM, and has a
  built-in `webServer` for serving static files during the run.
- **Vitest + jsdom** — rejected as the primary harness. jsdom does not run the full page
  (CDN scripts, service worker, real navigation), so it can't validate the app as shipped.
  It remains a future option for isolated pure-logic modules if unit-level coverage is
  wanted later.
- **Playwright MCP** — rejected. That is an interactive browser-driving aid, not a
  repeatable gated runner; the testing rules need committed spec files with pass/fail.

### Serving the app during tests
Playwright's `webServer` launches a lightweight static file server rooted at `apps/terminal`
so tests hit the real files over HTTP (matching nginx behavior for relative paths, the
service worker, and manifest fetches). Docker/nginx is **not** required to run the tests.

### Dev-only package.json
The added `package.json` exists purely to declare the Playwright dev-dependency and test
scripts. The production artifact remains the static file set; nothing in `index.html`,
`src/`, `sw.js`, or the Docker image changes.

### No coverage gate
The `emulator-*` rule gates on **pass**, not a coverage percentage — browser-E2E coverage
numbers are noisy and low-signal for a static app. Correctness is asserted via explicit
scenarios, not a %.

## Open Questions

- Which static server to use for `webServer` (a tiny node static server vs. `python -m
  http.server`) — pick the one already available in the CI/agent environment during
  implementation.
- Whether the service worker (`sw.js`) should be disabled in the test context to avoid
  cache flakiness — decide when writing the smoke test.
