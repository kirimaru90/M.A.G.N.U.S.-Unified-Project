## 1. Confirm the auth contract

- [x] 1.1 Hit the live API and confirm `POST /auth/login` with `{ username, password }` returns `{ token, user }` on success and `401` on bad credentials. Note the actual field names if they differ.
- [x] 1.2 Confirm `GET /auth/me` returns the current user when `Authorization: Bearer <token>` is sent, and `401` when the token is missing/expired.
- [x] 1.3 Confirm `GET /campaigns` returns public + assigned campaigns when authenticated (same endpoint, no extra query param) and public-only when anonymous. Record any deviation to adjust the spec/design.

## 2. Session module (`src/api/session.js`)

- [x] 2.1 Create `src/api/session.js` owning the credential: read/write the token in `sessionStorage` under key `robco_session`, hold the current user in memory, expose `getToken()`, `getUser()`, `isAuthenticated()`.
- [x] 2.2 Implement `login(username, password)`: `POST /auth/login`; on success store token + user and return the user; on `401` throw a typed "invalid credentials" result the caller can distinguish from network/HTTP errors. After storing the token, call `GET /auth/me` to guarantee the full display name is in memory (login response may omit or truncate user fields); fall back to the login-response user object if `/auth/me` fails.
- [x] 2.3 Implement `logout()`: call `POST /auth/logout`, then clear the stored token and in-memory user **even if the request fails** (best-effort server invalidation, guaranteed local clear).
- [x] 2.4 Implement `rehydrate()`: if a token exists in `sessionStorage`, call `GET /auth/me`; on success hydrate the in-memory user and return it; on `401` remove the token and return null (silent fallback to anonymous).
- [x] 2.5 Verify in the browser console: `login` then reload then `rehydrate()` keeps the user; `logout()` clears `sessionStorage`.

## 3. Session-aware API client (`src/api/client.js`)

- [x] 3.1 In `apiGet`/`apiPost`, attach `Authorization: Bearer <token>` to the request headers when `getToken()` returns a token; omit the header entirely when there is none. Import only `getToken` from `session.js` (keep `client.js` free of login logic; avoid a circular import).
- [x] 3.2 Confirm `ApiError` already exposes `status` so callers can branch on `401`; no swallowing of 401 inside the client.
- [x] 3.3 Verify anonymous calls still work unchanged (no header) and authenticated calls carry the header (check the Network tab).

## 4. Real-user login screen (`src/screens/login-real.js`)

- [x] 4.1 Add a dedicated CRT login container to `index.html` (e.g. `#login-real-screen`), separate from the fictional `#login-screen`, with username (text input, not a `<select>`), password, a generic error element, `[ Accedi ]` submit, and a `[ Annulla ]` / back button. Reuse the existing `#login-screen` CSS classes for the CRT aesthetic.
- [x] 4.2 Create `src/screens/login-real.js` mounting that container: wire submit → `session.login(...)`, Enter-to-submit on the password field, and keyboard navigation across the focusable elements (`makeNavHandler`), matching `login-fictional.js` conventions.
- [x] 4.3 On success, hide the login screen and invoke the `onSuccess` callback. On invalid credentials, show the inline generic message **"Credenziali non valide"** and stay on the screen; do not indicate which field was wrong. On network/HTTP (non-401) failure, show a generic error too (no field-level detail).
- [x] 4.4 Wire the back/cancel action to `onCancel`, returning to the campaign list with no session change.

## 5. Campaign-selection auth action (`src/screens/campaign-select.js`)

- [x] 5.1 Extend `mountCampaignSelect` options to accept auth wiring: `onLogin`, `onLogout`, and a way to read current auth state (`isAuthenticated` / current user) from `session.js`.
- [x] 5.2 Render a single auth button in the established `choice-btn` aesthetic: `[ Accedi ]` when anonymous, `[ Esci ]` when authenticated. Include it in the `makeNavHandler` focus list and attach the `mouseenter` selection sound, consistent with campaign buttons. Render it in all states (chooser, empty, single — note single-campaign auto-enter still applies before the button would show).
- [x] 5.3 `[ Accedi ]` → invoke `onLogin` (which shows `login-real`); on successful login, re-issue `GET /campaigns` (now authenticated) and re-render the screen. Apply single-campaign auto-enter if exactly one campaign results.
- [x] 5.4 `[ Esci ]` → invoke `onLogout` (`session.logout()`), then re-issue `GET /campaigns` anonymously and re-render so assigned campaigns disappear and `[ Accedi ]` returns.

## 6. Boot wiring & rehydration (`src/main.js`)

- [x] 6.1 On `DOMContentLoaded`, before the first `showCampaignSelect()`, call `session.rehydrate()` and await it so the first campaign fetch runs in the correct (authenticated or anonymous) mode.
- [x] 6.2 Mount `login-real` (like `mountLoginFictional`) and pass `onLogin`/`onLogout` callbacks plus session state into `mountCampaignSelect`. Show/hide the `#login-real-screen` and `#campaign-select-screen` appropriately when toggling into the login sub-screen.
- [x] 6.3 Ensure logout from anywhere it can be triggered returns to the anonymous campaign-select view and clears any in-progress state via the existing `store.clear()` path if a campaign was open.

## 7. Verification against specs

- [x] 7.1 Anonymous load shows only public campaigns; no `Authorization` header on `GET /campaigns` (Network tab).
- [x] 7.2 `[ Accedi ]` → valid login → assigned campaigns appear alongside public ones without a manual reload; subsequent requests carry the bearer header.
- [x] 7.3 Reload while logged in: `GET /auth/me` rehydrates and the authenticated list is shown; tampering/expiring the token falls back to anonymous silently (no error shown).
- [x] 7.4 Bad credentials show "Credenziali non valide" inline, remain on the login screen, leak no field detail, and create no session.
- [x] 7.5 `[ Esci ]` clears the session, re-renders the anonymous (public-only) view, and `sessionStorage` no longer holds the token.
- [x] 7.6 Update `guida terminale.md` if it references the campaign-selection flow, to mention the optional `[ Accedi ]` / `[ Esci ]` actions.

## 8. Public/private campaign grouping (`src/screens/campaign-select.js`)

- [x] 8.1 Confirm the campaign object's public-visibility field in the browser (assumed `isPublic`, mirroring terminals); record the actual field if it differs.
- [x] 8.2 When `isAuthenticated()`, partition the fetched campaigns into a public group and a private (assigned) group by that field, and render two labelled sections in the chooser. When anonymous, keep the current single undifferentiated list with no group labels.
- [x] 8.3 Ensure the auth button and keyboard navigation (`makeNavHandler` focus list) still include every campaign button across both groups, in a sensible order.

## 9. Empty-group indicators when authenticated (`src/screens/campaign-select.js`)

- [x] 9.1 When authenticated and the public group is empty, render a "nessuna campagna pubblica" string where the public group would be.
- [x] 9.2 When authenticated and the private group is empty, render a "nessuna campagna privata" string where the private group would be.
- [x] 9.3 Leave the anonymous empty-state untouched (existing single "Nessuna campagna disponibile" message); the per-group strings are authenticated-only.

## 10. Auth action on terminal selection (`src/screens/terminal-list.js`, `src/main.js`)

- [x] 10.1 Pass `onLogin` / `onLogout` (and the current campaign's public-visibility) into `mountTerminalList` from `main.js`, alongside the existing options.
- [x] 10.2 Render the `[ Accedi ]` / `[ Esci ]` button (same `choice-btn` aesthetic, hover sound, nav focus) after the hidden-archive input, its submit, and its error element.
- [x] 10.3 `[ Accedi ]` opens the real-user login (reusing the `main.js` `onLogin` show/hide of `#login-real-screen`); on return, re-render the terminal list in the now-current auth mode.
- [x] 10.4 `[ Esci ]` logs out, then branches on the current campaign: if **private**, exit to `showCampaignSelect()`; if **public**, re-render the terminal list anonymously in place.

## 11. Current-user (and campaign) indicator (`src/screens/campaign-select.js`, `src/screens/terminal-list.js`)

- [x] 11.1 Add a status string to the campaign-selection screen sourced from `session.getUser()`: the user's display name when authenticated, an "utente anonimo" indicator otherwise. Re-derive it on every (re)render.
- [x] 11.2 Add the same status string to the terminal-selection screen, additionally including the current campaign (e.g. its name).
- [x] 11.3 Confirm the user object's display field (assumed `username`) and fall back gracefully if absent.

## 12. Verification of the additional behaviors

- [x] 12.1 Logged out: campaign selection shows one undifferentiated list and an "utente anonimo" indicator; terminal selection shows "utente anonimo" plus the campaign name.
- [x] 12.2 Logged in: campaign selection shows separate public and private groups, with the correct per-group empty string when a group has no campaigns, and the indicator shows the user name.
- [x] 12.3 Terminal selection shows the `[ Esci ]` action in the footer; logout from a private campaign returns to campaign selection; logout from a public campaign stays on the terminal list (anonymous).
- [x] 12.4 The indicator updates correctly across login, logout, and reload-rehydration on both screens.

## 13. Status footer relayout (`src/screens/terminal-list.js`, `src/screens/campaign-select.js`, `src/styles/terminal.css`)

- [x] 13.1 Add a `.boot-status-footer` rule (dashed-divider footer, dim phosphor, centred) and a `.choice-btn.is-logout` modifier (color-coded destructive logout) to `terminal.css`; remove the now-unused `.session-indicator` rule.
- [x] 13.2 Move the current-user (and current-campaign on terminal selection) identity line and the `[ Accedi ]` / `[ Esci ]` auth action into a `<footer class="boot-status-footer" role="contentinfo">` at the bottom of both selection screens, rendered in both auth states (adaptive content).
- [x] 13.3 When authenticated, render the logout as `[ Esci — disconnetti utente ]` with the `.is-logout` class and an `aria-label` naming the user; when anonymous, render a plain green `[ Accedi ]`.
- [x] 13.4 Keep `[ Indietro ]` in the navigation area (after `[ CARICA ]`) above the footer on terminal selection, so the focus order ends with the destructive logout.
- [x] 13.5 Verify in the browser: footer renders in both auth states on both screens; logout is visually distinct and reads cleanly to assistive tech; tab order ends on the logout.
