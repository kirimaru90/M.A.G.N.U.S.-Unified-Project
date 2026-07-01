# MAGNUS-CMS Backoffice

Angular admin app for the RobCo Terminal Simulator (MAGNUS-CMS).

> **Specs:** this app's OpenSpec capabilities live in the root `openspec/` folder, prefixed `cms-`.

## Prerequisites

- Node.js (LTS) and npm
- A modern browser

## Quick start

```bash
npm install
npm start
```

The dev server runs at <http://localhost:4200/>. MSW (mock backend) is registered automatically in development, so the app boots end-to-end with no API server running — log in with any non-empty username/password.

If `mockServiceWorker.js` is missing from `public/`, regenerate it with:

```bash
npx msw init public/ --save
```

The file is git-ignored; the production build excludes it explicitly.

## Scripts

| Command               | What it does                                         |
| --------------------- | ---------------------------------------------------- |
| `npm start`           | Run the Angular dev server with MSW mocks            |
| `npm run build`       | Production build (`dist/magnus-backoffice/`)         |
| `npm run lint`        | ESLint                                                |
| `npm run typecheck`   | `tsc --noEmit`                                        |
| `npm run format`      | Format sources with Prettier                          |
| `npm run format:check`| Prettier `--check`                                    |
| `npm test`            | Run unit tests once (Vitest, headless jsdom) with coverage |
| `npm run test:watch`  | Run unit tests in watch mode                          |
| `npm run api:gen`     | Regenerate `src/api/generated/openapi-types.ts` from `reference/API-docs.json` |

## Testing

Unit tests run on Angular 21's built-in `@angular/build:unit-test` builder (Vitest), under
jsdom — no browser binary required. Specs live next to their subject as `*.spec.ts`.

```bash
npm test          # single run, coverage on, exits non-zero if any spec fails
npm run test:watch
```

Coverage is emitted to `coverage/magnus-backoffice/` (`coverage-summary.json` + `lcov.info`
for tooling, plus a text summary in the console). A **global 70% line-coverage threshold**
(`coverageThresholds` in `angular.json`) fails `npm test` if not met. Coverage is scored over
the files imported by the run (v8 default), so importing source you don't assert on will pull
the number down — cover what you touch.

Per the OpenSpec rules in the root `openspec/config.yaml`, every `cms-*` change MUST add
paired specs and keep `npm test` green (≥ 70% lines) before it can be archived.

## Project layout

```
src/
  app/
    app.ts / app.config.ts / app.routes.ts
    core/
      auth/           AuthService, interceptor, guard (signal-based)
      campaign/       CurrentCampaignService stub
      theme/          ThemeService (light/dark, localStorage 'rc.bo.theme')
    features/
      login/          bo-* login screen (Italian copy)
      campaigns/      placeholder route
      users/          placeholder route
    layout/
      shell, topbar, sidebar  (.bo-frame chrome)
    icons/            inline SVG icon components
  api/
    auth.api.ts            thin HttpClient wrapper
    generated/             openapi-typescript output (committed, regenerable)
  mocks/                   MSW handlers, dev-only
  environments/
  styles/tokens.css        copied verbatim from reference/design/tokens.css
  styles.css               global @layer order (reset, tokens, tailwind-utilities)
  main.ts                  production entry point
  main.development.ts      dev entry point (registers MSW, swapped in via fileReplacements)
```

## Design system

The Backoffice ships a small custom CSS component system, `.bo-*`, driven by a CSS-variable token sheet. See [`reference/design/Implementation Reference.md`](reference/design/Implementation%20Reference.md) for the canonical token + component spec.

- `src/styles/tokens.css` is a **verbatim copy** of `reference/design/tokens.css` (do not edit in place; update the design source and re-copy).
- Theme switching: `<div class="bo-frame" data-theme="light|dark">` is set by `AppComponent` from `ThemeService`; the user toggle lives in the topbar.
- Tailwind utility classes are available for layout (`flex`, `gap-*`, `grid-cols-*`, …). Component look-and-feel is owned by `.bo-*`; the CSS layer order (`reset, tokens, tailwind-utilities`) ensures `.bo-*` wins for component property conflicts. Tailwind's `preflight` is intentionally disabled.

PrimeNG, PrimeIcons, `@primeng/themes`, and PrimeFlex are NOT installed.

## API

- OpenAPI source: [`reference/API-docs.json`](reference/API-docs.json) (Bearer JWT, 24h, logout is stateless 204, no refresh token).
- Types only are generated via `openapi-typescript`; per-resource API services live next to the generated types and wrap Angular's `HttpClient`. See `src/api/auth.api.ts` for the pattern, including the `// TODO(openapi-gap)` markers where the upstream spec lacks response schemas.

## Notes

- Italian copy throughout the UI (per `reference/design/Implementation Reference.md` §0).
- Production bundle contains no MSW code and no `mockServiceWorker.js` (verified by the production build pipeline).
