# MAGNUS Terminal Emulator

Player-facing Fallout/RobCo terminal emulator (vanilla HTML/CSS/JS, no build step).

> **Specs:** this app's OpenSpec capabilities live in the root `openspec/` folder, prefixed `emulator-`.
> App reference docs (vision, technical specs, prompts) are in [`docs/`](docs/).

## Running the app

The app is static — serve the directory with any web server and open `index.html`:

```bash
docker compose up          # nginx on http://localhost:8080
```

## Testing

End-to-end tests run in headless Chromium via **Playwright**. They load the real
`index.html` over a tiny bundled static server (`tests/static-server.mjs`) — no nginx or
Docker required — and mock the backend API so the suite is hermetic and offline-safe.

```bash
npm install                    # dev-only: installs @playwright/test
npx playwright install chromium
npm test                       # runs tests/*.spec.ts, exits non-zero on failure
```

`npm run test:headed` / `npm run test:ui` are available for local debugging. A JSON report
is written to `test-results/results.json`.

> The `package.json`, `playwright.config.ts`, and `tests/` are **dev/test-only**; the shipped
> runtime (`index.html`, `src/`, `sw.js`, Docker/nginx) is unchanged. Per the OpenSpec rules
> in the root `openspec/config.yaml`, every `emulator-*` change MUST keep `npx playwright test`
> green before it can be archived.
