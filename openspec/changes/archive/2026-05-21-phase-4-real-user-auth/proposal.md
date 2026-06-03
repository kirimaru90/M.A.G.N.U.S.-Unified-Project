## Why

Today the Terminal is fully anonymous: it lists only public campaigns from `GET /campaigns` and has no way to identify a player. The architecture grants players access to *assigned* campaigns in addition to public ones, but that content is invisible without a real-user session. Phase 4 adds an optional login from the campaign selection screen so a player can reveal their assigned campaigns, while keeping the anonymous, public-only experience as the default — no upfront login wall.

## What Changes

- **Add a real-user session lifecycle.** A new `src/api/session.js` holds a bearer token returned by `POST /auth/login`, persisted in `sessionStorage` so a reload can rehydrate it via `GET /auth/me`. Logout calls `POST /auth/logout` and clears the token.
- **The API client becomes session-aware.** `src/api/client.js` attaches `Authorization: Bearer <token>` to every request when a session is present, and surfaces `401` so callers can treat an expired credential as "logged out."
- **Add a CRT-styled real-user login screen** (`src/screens/login-real.js`), presented inline on / as a sub-screen of campaign selection. Distinct from the existing in-narrative *fictional* login.
- **Campaign selection gains an auth action.** `[ Accedi ]` when anonymous; `[ Esci ]` when authenticated. Successful login refreshes the campaign list (public + assigned) in place. Failed login shows an inline CRT error and stays on the selection screen. `[ Esci ]` returns to the anonymous (public-only) view.
- **App boot rehydrates a session.** On load, if a stored credential exists, `GET /auth/me` confirms it before showing the authenticated campaign list; an invalid/expired credential is cleared silently and the anonymous view is shown.
- Error UI never reveals which field was wrong — a single "credenziali non valide" message.
- **Campaign selection groups public vs private when authenticated.** While anonymous the list stays a single undifferentiated (public-only) group; once logged in the screen splits campaigns into a public group and a private (assigned) group, partitioned client-side by the campaign's public-visibility field, with a per-group "nessuna campagna pubblica/privata" string when a group is empty.
- **Terminal selection gains the same auth action.** `[ Accedi ]` / `[ Esci ]` is rendered in the status footer (see below). Logging out from a *private* campaign exits to campaign selection (the now-anonymous player may lose access); logging out from a *public* campaign stays on the terminal list in its anonymous state. `[ Indietro ]` stays with the navigation actions, above the footer.
- **Both selection screens carry a status footer.** A dashed-divider footer at the bottom of the CRT block groups the session identity with the auth action, separating it from the navigation. The footer is rendered in both auth states (adaptive): anonymous shows an "utente anonimo" line and a green `[ Accedi ]`; authenticated shows the user's name and a destructive, color-coded `[ Esci — disconnetti utente ]`. On terminal selection the identity line also includes the current campaign; on campaign selection it names only the user.

## Capabilities

### New Capabilities
- `real-user-auth`: the real-user login/logout flow initiated from the campaign selection screen — session lifecycle (login, rehydrate, logout), bearer-credential attachment on API requests, the inline CRT login/error UI, the campaign-list refresh that reveals assigned campaigns on login and hides them on logout, the authenticated public/private campaign grouping with per-group empty strings, the status footer on both selection screens that groups the current-user (and, on terminal selection, current-campaign) identity with the auth action, and the duplicate auth action on terminal selection (with private-campaign exit on logout) styled as a destructive logout when authenticated.

### Modified Capabilities
- `campaign-selection`: **REMOVE** the phase-gating requirement "No real-user login affordance in this phase," which explicitly forbade the `[ Accedi ]` button until "a later phase." Phase 4 is that phase. The actual login/logout behavior lives entirely in the new `real-user-auth` spec; this delta only retires the placeholder so the spec set stays internally consistent.

> Note: `login-access-control` is **not** touched here — it is updated in Phase 5 for the server-side *fictional*-login change, which is unrelated to real-user auth.

## Impact

- **New files**: `src/api/session.js`, `src/screens/login-real.js`. New login DOM/markup and CRT styles (reuse the fictional-login `#login-screen` aesthetic in `src/styles/terminal.css`).
- **Modified files**: `src/api/client.js` (attach credential, expose 401), `src/screens/campaign-select.js` (Accedi/Esci action, refresh-on-auth, inline error, public/private grouping + per-group empty strings, status footer), `src/screens/terminal-list.js` (status footer with the Accedi/Esci action, private-campaign exit on logout, current-user + current-campaign identity), `src/styles/terminal.css` (`.boot-status-footer` divider/footer styles and the `.choice-btn.is-logout` destructive styling; replaces the now-unused `.session-indicator`), `src/main.js` (rehydrate on boot, wire login/logout into both the campaign-select and terminal-list mounts).
- **API contract used**: `POST /auth/login` (`{ username, password }` → `{ token, user }`), `POST /auth/logout`, `GET /auth/me` (→ current user). `GET /campaigns` already returns public + assigned based on the presented credential — no change to that endpoint, only to what the client sends.
- **Out of scope** (unchanged here): admin/backoffice flows, per-player progress persistence, and the service-worker cache policy for authenticated content (Phase 6).
- **Content-creator workflow**: no impact. Holotape JSON authoring is untouched; campaign visibility is governed server-side by assignment, not by content.
