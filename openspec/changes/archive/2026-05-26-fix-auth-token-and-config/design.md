## Context

The backoffice talks to a JWT-secured API via `AuthService` (signal-based) and an `HttpInterceptor` that attaches `Authorization: Bearer <token>` for requests to `environment.apiBaseUrl`. Two problems block real-backend usage:

1. **Token field mismatch.** `AuthService.login` reads `response.access_token`, but the backend returns `accessToken`. The value is `undefined`, `token.set(undefined)` leaves the signal falsy, and the interceptor's `if (isApiRequest && token)` guard sends no header → `401`. TypeScript does not catch this because `LoginResponse` declares the wrong field name, so the response is asserted to a shape it doesn't have.

2. **MSW coupled to the environment switch.** The Angular `development` build configuration performs two file replacements: `environment.ts → environment.development.ts` (`apiBaseUrl: '/api'`) and `main.ts → main.development.ts` (which calls `worker.start()`). MSW is therefore the implicit default for `ng serve`, and pointing the app at a real backend currently requires abusing `--configuration=production`. MSW is also dead weight now that real backends exist — `main.ts` (the production entry) never imported the worker, so production already runs without it.

Constraint: the production API URL is not yet known (the current `environment.ts` still holds a `TODO` placeholder, and the working copy temporarily set it to `localhost:3000`).

## Goals / Non-Goals

**Goals:**
- The interceptor attaches a valid bearer token on authenticated requests after login/restore.
- `ng serve` (default development config) talks to the real local backend with no MSW involved.
- `environment.development.ts` and `environment.ts` point at distinct, real APIs; switching is a one-line edit per file.
- MSW and all its handlers, assets, and dependencies are fully removed from the repo.

**Non-Goals:**
- Re-introducing an offline/mock mode (explicitly dropped; can be a future change if needed).
- Changing the auth flow itself (guards, restore, 401 handling, login screen) beyond the token field name.
- Regenerating the OpenAPI client types (the `accessToken` shape is hand-typed in `auth.api.ts` per the existing `openapi-gap` TODO; codegen is untouched).

## Decisions

### Decision 1: Use `accessToken` as the login response field
Rename `access_token` → `accessToken` in the `LoginResponse` interface (`src/api/auth.api.ts`) and in `AuthService.login` (`response.accessToken`). This is the smallest fix that makes the runtime shape match the type and restores token persistence.

- **Alternative considered:** normalize at the boundary (map whatever the backend returns into an internal shape). Rejected as over-engineering for a single field; the existing code already hand-types this response and a direct rename keeps it honest.

### Decision 2: Dev points directly at the absolute backend URL; remove the proxy
Set `environment.development.ts` `apiBaseUrl: 'http://localhost:3000'` (absolute) and remove the now-unused `proxy.conf.json` together with the `proxyConfig` option in `angular.json`. This keeps dev and prod symmetric (both use absolute base URLs) and removes the contradictory working-copy state (absolute URL + `pathRewrite` that never runs). The backend must allow CORS from the dev origin (`http://localhost:4200`), including the `Authorization` header.

- **Alternative considered (B): relative `/api` + dev proxy.** Set `apiBaseUrl: '/api'` and keep `proxy.conf.json` (`/api` → `http://localhost:3000`, `pathRewrite` stripping `/api`). Avoids CORS entirely because the browser only ever sees same-origin `localhost:4200`. Rejected as the default because it diverges from the production wiring (relative vs absolute) and adds a moving part; documented here as the fallback if enabling CORS on the backend is not possible. **This is an open question for the user (see below).**

### Decision 3: Decouple MSW from the build config by deleting it
Remove the `main.ts → main.development.ts` replacement from `angular.json`'s `development` configuration so both build targets use `src/main.ts`. Delete `src/main.development.ts`, `src/mocks/**`, `public/mockServiceWorker.js`, the `mockServiceWorker.js` ignore entry in the production assets block, the `msw` devDependency, and the `msw.workerDirectory` block in `package.json`.

- **Alternative considered:** keep MSW behind an explicit `mock` configuration. Rejected per the user's explicit request to remove it entirely.

### Decision 4: Restore `package.json` start script and production environment
Revert `start` to `ng serve` (uses the `development` configuration → `environment.development.ts`). Replace the production `apiBaseUrl` with the real production URL (pending the open question below) rather than the working-copy `localhost:3000`.

## Risks / Trade-offs

- **CORS now required for local dev** → If the backend can't send `Access-Control-Allow-Origin: http://localhost:4200` + `Access-Control-Allow-Headers: Authorization`, fall back to Decision 2 Alternative B (relative `/api` + proxy). This is the open question below.
- **No offline mock mode** → Local dev requires the backend up at `localhost:3000`. Acceptable per goals; a future `mock` config can restore it if needed.
- **Stale MSW service worker in browsers** → A previously registered `mockServiceWorker.js` can keep intercepting requests after the file is deleted. Mitigation: note in tasks that developers must unregister the service worker / hard-reload once after pulling this change.
- **Removing specs for 5 MSW capabilities** → The spec set shrinks substantially; this is intended and captured as REMOVED deltas so the archived spec base stays accurate.

## Open Questions

1. ~~**Production API base URL**~~ — **Resolved**: keep the `TODO` placeholder for now; `environment.ts` will not point at a real production URL until it is known.
2. ~~**CORS vs proxy for dev**~~ — **Resolved**: the backend already enables CORS for `http://localhost:4200`. Proceed with Decision 2 (absolute URL, remove the proxy).
