## Why

Every time a player reopens the Terminal or Pip-Boy (especially as an installed PWA) they are asked to log in again: both apps keep the JWT in `sessionStorage`, which is wiped when the window closes, and the API issues 24h tokens with no way to extend them. The CMS keeps its token in `localStorage` but still drops users after 24h. Users want to opt into a long-lived session on devices they trust.

## What Changes

- All three login screens (CMS, Terminal, Pip-Boy) gain a **"Ricordami"** option, unchecked by default.
- `POST /auth/login` accepts an optional `rememberMe: boolean`.
  - `rememberMe: true` → JWT with `exp` **365 days** after issuance; response `expiresIn: 31536000`.
  - `rememberMe` absent/false → JWT with `exp` 24 hours after issuance (unchanged); response `expiresIn: 86400`.
- Logout is unchanged: `POST /auth/logout` stays a stateless 204 and the client discards its token; the token is not invalidated server-side.
- Client storage rule, identical in all three apps:
  - "Ricordami" checked → token in `localStorage`.
  - unchecked → token in `sessionStorage` (the CMS moves from always-`localStorage` to this rule).
  - On boot the app looks in `localStorage` first, then `sessionStorage`; logout and 401-clearing remove the token from both.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `api-auth`: login accepts `rememberMe` and issues 24h or 365-day tokens.
- `cms-auth-session`: token persisted in `localStorage` only when "Ricordami" is checked, otherwise `sessionStorage`; restore and clear consider both stores; login screen gains the checkbox.
- `emulator-real-user-auth`: Terminal session lifecycle and rehydration use `localStorage` or `sessionStorage` according to "Ricordami"; login screen gains a CRT-styled toggle.
- `pipboy-app-shell`: Pip-Boy login gains the "Ricordami" option and stores the session according to it.

## Impact

- **API** (`apps/api`): `auth/dto/login.dto.ts`, `auth/auth.service.ts`. No schema, guard or dependency changes. Existing tokens keep working.
- **CMS** (`apps/cms`): `core/auth/auth.service.ts`, `api/auth.api.ts` (`LoginDto.rememberMe`), `features/login/login.ts`.
- **Terminal** (`apps/terminal`): `src/api/session.js`, `src/screens/login-real.js`, and `index.html` — the real-user login markup lives there and the toggle cannot be added through content alone. No impact on the content-creator / JSON terminal authoring workflow (fictional terminal logins are untouched).
- **Pip-Boy** (`apps/pip-boy`): `src/api/session.js`, `src/screens/login.js`.
- **Security**: a remembered token lives in `localStorage` for up to a year, is XSS-readable, and stays valid after logout until it expires; this is accepted as an explicit user opt-in. The only way to kill outstanding tokens is rotating `JWT_SECRET` (logs everyone out).

## Testing

- **API unit** (`src/auth/auth.service.spec.ts`): token `exp` is 24h vs 365d depending on `rememberMe`; `expiresIn` matches.
- **API e2e** (`test/auth.e2e-spec.ts`, mongodb-memory-server): login with/without `rememberMe` → decoded `exp` and `expiresIn`; non-boolean `rememberMe` → 400; existing logout scenarios unchanged.
- **CMS unit** (Vitest, already wired): `AuthService` stores in `localStorage` with remember and `sessionStorage` without, restores from either, `clear()` empties both; login component sends `rememberMe` from the checkbox.
- **Terminal e2e** (Playwright, harness present): login with the toggle on → token in `localStorage`, survives a reopened page; toggle off → `sessionStorage` only; logout clears both. Toggle is reachable via keyboard navigation.
- **Pip-Boy e2e** (Playwright, harness present): same storage assertions as the Terminal; `rememberMe` is sent in the login request body.
