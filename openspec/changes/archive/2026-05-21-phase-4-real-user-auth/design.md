## Context

The Terminal is a static, no-build, vanilla-JS PWA that talks to the RobCo API. After Phase 1, campaign selection is the entry screen and fetches `GET /campaigns` anonymously, so only active public campaigns are visible. The architecture (`reference/robco-terminal-architecture.md` → *Boot & campaign selection*, *Login flow from campaign selection*; `ARCHITECTURE.md` §9.1) calls for an *optional* real-user login launched from that screen which reveals the player's assigned campaigns in addition to the public ones.

Two constraints frame the design:

- **Static, cross-origin client.** The app is served as plain files; the API lives at a separate origin (`API_BASE_URL` defaults to `http://localhost:3000`). The current `client.js` uses plain `fetch` with no credentials.
- **The referenced Swagger file is absent** from the repo, and the architecture doc explicitly lists "JWT vs session cookies" as an open point. The auth mechanism therefore had to be decided here rather than read off a contract.

There are two unrelated "logins" in this system: the in-narrative **fictional** login (`login-fictional.js`, gates holotape content, Phase 5) and the **real-user** login introduced here. They must not be conflated.

## Goals / Non-Goals

**Goals:**
- Optional real-user login surfaced from campaign selection; anonymous remains the default.
- Reveal assigned campaigns on login; return to public-only on logout — both without a manual reload.
- Survive a page reload while a session is active (rehydrate via `GET /auth/me`).
- Keep `client.js` a thin wrapper; auth state owned by one module (`session.js`).
- Generic, non-leaking error UI in the CRT aesthetic.

**Non-Goals:**
- Admin/backoffice flows (separate app).
- Per-player progress persistence (architecture non-goal).
- Service-worker cache policy for authenticated content (Phase 6).
- Server-side fictional login (Phase 5).
- Token refresh / sliding expiry. A session lives until logout, tab close, or a `401`.

## Decisions

### Decision 1: Bearer token in the login response body, attached as `Authorization: Bearer`
`POST /auth/login` is assumed to return `{ token, user }`. The client sends the token as `Authorization: Bearer <token>` on every request when a session exists.

**Why:** A static cross-origin client is the awkward case for cookies — `Set-Cookie` from `localhost:3000` requires CORS `Access-Control-Allow-Credentials`, a non-wildcard origin, and `SameSite=None; Secure`, plus `credentials: 'include'` on every fetch. A bearer token in the JSON body avoids all of that, is trivial to attach, and makes Phase 6's "never cache authenticated responses" split easy to reason about (presence of the header ⇒ authenticated request).

**Alternatives considered:**
- *httpOnly session cookie* — more XSS-resistant, but the CORS/SameSite friction above and the static-host requirement make it the worse fit. Rejected for this phase; can be revisited if the server standardizes on cookies.

**Contract confirmed against the real server:** the login response uses `accessToken` (not `token`). `session.js` reads `res.accessToken || res.token` for resilience. `401` is the failure status for bad credentials and for an expired token on `GET /auth/me`.

### Decision 2: `sessionStorage` for the credential
The token is persisted in `sessionStorage` under one key (e.g. `robco_session`).

**Why:** It survives reloads within the tab (so `GET /auth/me` rehydration is meaningful) but clears on tab close, bounding the XSS exposure window better than `localStorage`. Matches the architecture's "no client-side persistence of player progress beyond the active session" spirit.

**Alternatives:** in-memory only (a reload would silently log the user out — worse UX, and makes the `/auth/me` rehydration requirement vacuous); `localStorage` (persists across restarts — longest exposure, more than this UX needs).

### Decision 3: `session.js` is the single owner of auth state
A new `src/api/session.js` owns: the token (read/write `sessionStorage`), the in-memory current user, and `isAuthenticated()`. It exposes `login()`, `logout()`, `rehydrate()`, `getToken()`, `getUser()`. `client.js` imports only `getToken()` to attach the header — it does not know about login flows.

**Why:** Keeps `client.js` a transport wrapper and avoids a circular dependency (`session.js` uses `apiPost`/`apiGet`; `client.js` uses only `getToken`, a pure accessor). One module to change if the mechanism changes.

### Decision 4: `client.js` exposes `401` rather than swallowing it
`apiGet`/`apiPost` already throw `ApiError('http', ..., { status })`. Callers (rehydrate, login, campaign refresh) inspect `status === 401` to distinguish "expired/invalid credential" from other failures. No global interceptor/redirect is added.

**Why:** The app has a handful of call sites and an explicit screen flow; a global 401→logout interceptor would be heavier than needed and could fight the campaign-select state machine. Local handling keeps control flow visible.

### Decision 5: Campaign-select owns the auth UI; `main.js` wires the dependencies
`campaign-select.js` already mounts the screen and gets `{ onCampaignSelected, setKeyHandler }`. Phase 4 extends its mount options with auth callbacks (`onLogin`, `onLogout`, current auth state) and renders the `[ Accedi ]`/`[ Esci ]` button alongside the chooser. The real-user login UI lives in `login-real.js` and is shown/hidden by campaign-select (inline sub-screen). `main.js` performs boot rehydration and passes session-aware callbacks down.

**Why:** Login is conceptually part of the campaign-selection experience (the architecture frames it as "login flow *from* campaign selection"). Keeping the refresh-on-auth logic next to the list rendering avoids threading state through `main.js`.

### Decision 6: Reuse the existing CRT login styling
`login-real.js` reuses the `#login-screen` CRT styles already in `terminal.css` (username/password fields, error block, submit/back buttons) rather than introducing a parallel stylesheet, but with its own DOM container so it never collides with the fictional-login screen.

**Why:** Aesthetic preservation is a hard constraint; the fictional login already nails the look. Distinct container keeps the two logins independent.

### Decision 7: Public/private grouping is a client-side partition, shown only when authenticated
`GET /campaigns` returns public + assigned campaigns in one flat list (Decision is credential-driven, no query param). When authenticated, `campaign-select.js` partitions that list into a public group and a private group by the campaign's public-visibility field and renders two labelled sections; an empty section gets a "nessuna campagna pubblica/privata" string. When anonymous, every returned campaign is public, so no partition or labels are drawn — the existing single-list rendering and single empty-state message are kept.

**Why:** The server already encodes visibility per campaign; grouping is purely presentational and only meaningful once the list can contain both kinds (i.e. when logged in). Gating the grouping on `isAuthenticated()` keeps the anonymous path byte-for-byte as it is today.

**Field name caveat:** terminals expose `isPublic` (see `terminal-list.js`); campaigns are assumed to expose the same `isPublic` flag. The Swagger contract is absent (see Context), so the exact field must be confirmed in the browser before implementation — if it differs, this is the single place that reads it.

### Decision 8: Terminal selection carries the same auth action; logout from a private campaign exits
`terminal-list.js` renders the same `[ Accedi ]` / `[ Esci ]` button used by campaign-select, now placed in the status footer at the bottom of the screen (see Decision 10) rather than inline after the hidden-archive block. On logout, the screen branches on the current campaign's public-visibility: a **private** campaign forces an exit back to campaign-select (the now-anonymous player may no longer be authorized, and re-fetching its terminals could 403), while a **public** campaign re-renders in place anonymously.

**Why:** A player who logs in to reach a private campaign should be able to log out from inside it without being silently stranded on a list they can no longer load. Public campaigns are reachable anonymously, so there is no reason to bounce the player out of one.

### Decision 9: A current-user indicator on both selection screens, with the campaign on terminal selection
Both selection screens render a small status string sourced from `session.getUser()`: the user's name when authenticated, an "utente anonimo" indicator otherwise. The terminal-selection string additionally appends the current campaign name (already available as `currentCampaign` in `main.js` / the `campaignId` context). The string is re-derived on every (re)render, so it tracks login/logout/rehydration without extra wiring. The string lives in the status footer (Decision 10).

**Why:** Once login changes what content is visible, the player needs a persistent, glanceable cue for *who they are* and (in a campaign) *where they are*. Deriving it on render avoids a separate state-sync path.

**Display-name caveat:** the user object shape from `/auth/login` and `/auth/me` is not pinned down (Swagger absent). The indicator should read a sensible display field (e.g. `user.username || user.name`) and fall back gracefully; confirm the field in the browser.

### Decision 10: A status footer groups session identity with the auth action, separated from navigation
Both selection screens render their session identity (Decision 9) and their `[ Accedi ]` / `[ Esci ]` auth action (Decisions 5 and 8) together in a dedicated footer at the bottom of the CRT block — a `<footer class="boot-status-footer" role="contentinfo">` separated from the content above by a faint dashed phosphor divider. The footer is rendered in **both** auth states (adaptive content): anonymous shows the "utente anonimo" line and a normal green `[ Accedi ]`; authenticated shows the user line and a destructive, color-coded `[ Esci — disconnetti utente ]` (the `.choice-btn.is-logout` modifier — amber/red glow, an `aria-label` naming the user). Navigation actions stay above the footer: on terminal selection, `[ Indietro ]` remains in its place after `[ CARICA ]`, so the destructive logout is the last focusable element (hardest to hit by accident). Because both screens build their keyboard focus list from DOM order after the footer is appended, no extra nav wiring is needed.

**Why:** Previously the identity line sat between the prompt and the list while `[ Esci ]` was visually identical to `[ Indietro ]` (same green, same `> [ … ]` wrapper) — easy to confuse "leave the session" with "go back one step." Collecting identity + logout in a footer gives the player one glanceable status region, and color-coding the logout makes the destructive action unambiguous. Keeping the footer present (not hidden) when anonymous preserves the current-user-indicator requirement (Decision 9) and keeps login reachable from the terminal-selection screen.

**Naming note:** the footer class is `.boot-status-footer` (shared by both selection screens despite the `boot-` prefix), to keep one stylesheet rule for the shared layout.

## Risks / Trade-offs

- **[Bearer token in `sessionStorage` is XSS-readable]** → The app renders holotape text via `marked.js`; a content-injection bug could exfiltrate the token. Mitigation: `sessionStorage` (not `localStorage`) bounds the window to the tab session; logout and tab-close both clear it; no long-lived refresh token is stored. Revisit httpOnly cookies if/when the server supports the CORS setup.
- **[`accessToken` vs `token` field name]** → Confirmed the server returns `accessToken`. Fixed in `session.js` (reads `res.accessToken || res.token`). All other shape/status assumptions remain isolated there.
- **[A 401 mid-session (token expires while playing) is only handled at campaign-select call sites]** → In-terminal API calls that 401 will surface as ordinary `ApiError`s and not auto-logout in this phase. Acceptable: sessions are short-lived per tab, and Phase 6/later can add a global handler. Documented as an open question.
- **[Two logins in the UI could confuse]** → Distinct container, distinct labels (`[ Accedi ]` for real-user vs the in-narrative fictional prompt), distinct module. The risk is naming drift; mitigated by keeping `login-real.js` / `login-fictional.js` clearly separated.
- **[CORS misconfiguration]** → If the API origin doesn't allow the `Authorization` header (preflight), authenticated requests fail. Out of the client's control; surfaced as a clear network/HTTP error. Noted for server-side coordination.

## Migration Plan

No data migration. Purely additive on the client:
1. Add `session.js` (no behavior change until used).
2. Make `client.js` attach the header when a token exists (no-op while no one logs in).
3. Add `login-real.js` and the campaign-select auth action.
4. Wire boot rehydration in `main.js`.

**Rollback:** revert the campaign-select auth action and the `main.js` rehydration; `session.js` and the `client.js` header become inert (no token is ever set), restoring the anonymous-only behavior. No server or storage cleanup required beyond users clearing `sessionStorage` (cleared automatically on tab close).

## Open Questions

- **Exact `/auth/*` contract.** ~~Confirmed:~~ `POST /auth/login` returns `{ accessToken, ... }` (not `{ token }`); `session.js` updated accordingly. `GET /auth/me` user shape and `401` behavior still to be verified in browser.
- **Mid-session 401 policy.** Should an authenticated API call that 401s anywhere in the app force a logout and bounce to anonymous campaign selection? Deferred; current scope handles 401 only at the campaign-select/rehydrate boundaries.
- **Does `GET /campaigns` need an explicit "include assigned" flag, or is it purely credential-driven?** Architecture says credential-driven (same endpoint, more results when authenticated); confirm no query param is required.
- **Campaign public-visibility field name.** Assumed `isPublic` (mirroring terminals); confirm in the browser since the Swagger contract is absent. Used by the public/private grouping (Decision 7) and the logout-exit branch on terminal selection (Decision 8).
- **User display field name.** The shape of the user object from `/auth/login` and `/auth/me` is unconfirmed; the current-user indicator (Decision 9) needs a display field (e.g. `username`). Verify and fall back gracefully if absent.
