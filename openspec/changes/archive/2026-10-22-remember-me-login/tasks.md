## 1. API — token lifetime

- [x] 1.1 Add `@IsOptional() @IsBoolean() rememberMe?: boolean` (with `@ApiPropertyOptional`) to `auth/dto/login.dto.ts`
- [x] 1.2 In `AuthService.login`, sign with `expiresIn` `'365d'` / `'24h'` by `rememberMe`; return `expiresIn` `31536000` / `86400`
- [x] 1.3 Unit specs in `auth.service.spec.ts`: 24h vs 365d `exp`, `expiresIn` value
- [x] 1.4 E2E in `test/auth.e2e-spec.ts`: rememberMe on/off → decoded `exp` and `expiresIn`; non-boolean `rememberMe` → 400

## 2. CMS

- [x] 2.1 Add `rememberMe?: boolean` to `LoginDto` in `src/api/auth.api.ts`
- [x] 2.2 `AuthService`: read token `localStorage` → `sessionStorage`; `login(creds)` persists into the store selected by `creds.rememberMe` and removes the key from the other; `clear()` removes from both
- [x] 2.3 Login component: "Ricordami" checkbox (`remember` control, default `false`) in the `.bo-*` form, sent as `rememberMe`
- [x] 2.4 Specs: `auth.service.spec.ts` (store choice, restore from either store, clear both); login component spec (checkbox default and `rememberMe` in the request)

## 3. Terminal

- [x] 3.1 `src/api/session.js`: `login(username, password, rememberMe = false)` sends `rememberMe`, stores in the chosen store and removes from the other; `getToken()` reads `localStorage` → `sessionStorage`; clearing (logout, 401 on rehydrate) removes from both
- [x] 3.2 `index.html`: add `#login-real-remember` choice button (`[ ] RICORDAMI`, `aria-pressed="false"`) between the password input and `[ Accedi ]`
- [x] 3.3 `src/screens/login-real.js`: toggle state on activation, reset to off on `showLogin`, include it in `focusables`, pass state to `sessionLogin`
- [x] 3.4 Playwright: toggle via keyboard; remembered login → token in `localStorage` only and survives a reopened page; non-remembered → `sessionStorage` only; logout clears both; request body carries `rememberMe`

## 4. Pip-Boy

- [x] 4.1 `src/api/session.js`: same storage rule and `login(username, password, rememberMe = false)` signature as the Terminal; `rehydrate`/`reverify`/`logout` clear both stores
- [x] 4.2 `src/screens/login.js`: `RICORDAMI` checkbox row in `#pb-login-form` (unchecked by default), passed to `login`
- [x] 4.3 Playwright: remembered login → `localStorage`, survives reopen and lands past login; non-remembered → `sessionStorage` only; logout clears both; request body carries `rememberMe`

## 5. Wrap-up

- [x] 5.1 Update `reference/API-docs.json` (or regenerate) for the new `rememberMe` field, if the CMS client is generated from it
- [x] 5.2 Run API unit + e2e, CMS Vitest, Terminal and Pip-Boy Playwright suites; all green
