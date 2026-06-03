## Why

Authenticated API calls fail with `401` and carry no `Authorization` header. The login response from the real backend returns the JWT under `accessToken`, but the client reads `access_token` (snake_case), so the token signal is set to `undefined` and the interceptor — which only attaches the header when a token is truthy — sends nothing. Separately, the dev build couples "which API to call" with "start MSW": the Angular `development` configuration swaps in both `environment.development.ts` *and* `main.development.ts` (which boots MSW). To talk to a real local backend the developer had to mis-use `--configuration=production` and edit the production environment file. We are now wiring the app to real backends and want to drop the mock layer entirely.

## What Changes

- Fix the login token field: read and persist `accessToken` (not `access_token`) in `AuthService.login`, and update the `LoginResponse` type in the API client accordingly.
- **BREAKING (dev workflow):** Remove the MSW mock layer entirely — delete `src/mocks/**`, `src/main.development.ts`, `public/mockServiceWorker.js`, the `msw` devDependency, and the `msw.workerDirectory` block in `package.json`. Remove the `main.ts` → `main.development.ts` file replacement from the `development` build configuration.
- Clean dev/prod API configuration so each build target points at a distinct real API:
  - `environment.development.ts` → local backend (`http://localhost:3000`).
  - `environment.ts` (production) → real production API URL (replacing the `TODO` placeholder and reverting the working-copy edit to `localhost:3000`).
  - Restore `package.json` `start` script to `ng serve` (development configuration, no MSW).
- Resolve `proxy.conf.json`: with `apiBaseUrl` pointing directly at an absolute backend URL the dev proxy is bypassed, so CORS must be handled by the backend. Document the tradeoff and decide whether to keep or remove the proxy in design.

## Capabilities

### New Capabilities
<!-- none — configuration behavior lives under the existing app-bootstrap capability -->

### Modified Capabilities
- `auth-session`: pin the login response contract — the client reads/persists the bearer token from the `accessToken` field so the interceptor attaches it.
- `app-bootstrap`: environment configuration targets a real API per build (dev → local backend, prod → production API); the dev server no longer depends on a mock layer.
- `dev-mock-layer`: **removed** — the MSW mock layer and its `/auth/*` handlers are deleted.
- `campaigns-msw-handlers`: **removed** — MSW handlers for `/campaigns` are deleted.
- `terminals-msw-handlers`: **removed** — MSW handlers for `/terminals` are deleted.
- `users-msw-handlers`: **removed** — MSW handlers for `/users` are deleted.
- `state-msw-handlers`: **removed** — MSW handlers for state/reset routes are deleted.

## Impact

- **Source:** `src/app/core/auth/auth.service.ts`, `src/api/auth.api.ts`, `src/environments/environment.ts`, `src/environments/environment.development.ts`.
- **Removed:** `src/mocks/**` (browser + all handlers), `src/main.development.ts`, `public/mockServiceWorker.js`.
- **Build/config:** `angular.json` (development `fileReplacements`), `package.json` (`start` script, `msw` devDependency, `msw.workerDirectory`), `proxy.conf.json`.
- **Dependencies:** `msw` removed from `devDependencies`.
- **Developer workflow:** local dev now requires the real backend running at `http://localhost:3000` (and reachable via CORS); there is no offline mock mode after this change.
