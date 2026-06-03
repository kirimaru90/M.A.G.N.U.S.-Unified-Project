## Context

After Phase 0, the Terminal is an ES-module client built around three screens (`boot`, `login-fictional`, `terminal`) and a small set of engine modules. Data still comes from the filesystem: `boot.js` fetches `dati/manifest.json` to render the visible terminal list and hold hidden-tape metadata; `main.js#handleTapeSelected` fetches `dati/<file>` to load a holotape.

The wider RobCo architecture (ARCHITECTURE.md §4, §6; reference/robco-terminal-architecture.md "Boot & campaign selection") makes the campaign a top-level concept and exposes the data via HTTP:

- `GET /campaigns` — public-only when unauthenticated.
- `GET /campaigns/:id/terminals` — terminals within a campaign.
- `GET /terminals/:id/load` — content payload (with server-side credential stripping).

Phase 1 is the first slice that talks to the live API. It is anonymous-only: no Authorization header, no real-user login (Phase 4), no state/variants/mutations (Phase 2), no input components (Phase 3), no server-side fictional login (Phase 5), no SW cache split (Phase 6).

The API is live and evolving, contract pinned to `reference/Swagger API.html`. The legacy `dati/` directory stays in the repo as offline reference until Phase 6 cleanup, but the running client must not depend on it.

Existing engine behavior (typewriter, sounds, keyboard nav, back history, in-JS fictional login, choice rendering) must remain pixel-identical. The CRT aesthetic extends to the new campaign-selection screen.

## Goals / Non-Goals

**Goals:**
- A single thin fetch wrapper (`src/api/client.js`) that every API caller in this phase (and future phases) uses, so error handling and base-URL handling live in one place.
- A new top-level `campaign-select` screen that becomes the first thing the user sees, replacing the direct boot-into-terminal-list flow.
- The existing terminal-list UI (`boot.js`) repurposed to render terminals **within a chosen campaign**, driven by `GET /campaigns/:id/terminals`.
- Hidden-tape access surface preserved (input, button, error) but backed by `GET /campaigns/:id/terminals/by-meta/:metaId` instead of a local search.
- Zero observable behavior change in: typewriter cadence, sounds, keyboard navigation, fictional login flow, back history, choice rendering, terminal-exit, file-error back navigation.
- A deployment without `dati/` works end-to-end for every currently-existing holotape.

**Non-Goals:**
- No real-user authentication, no session token, no Authorization header. (Phase 4.)
- No state engine, no variants, no on_enter / choice.set mutations. (Phase 2.)
- No input components. (Phase 3.)
- No server-side fictional login. (Phase 5.) The in-JS `login-fictional` path keeps working with whatever credentials the server's payload contains.
- No service-worker cache policy split. (Phase 6.) This change only removes pre-cache entries that point at files no longer fetched at runtime (`dati/manifest.json`, the legacy holotape JSON files); it does not introduce a new caching strategy.
- No deletion of `dati/`. Cleanup happens in Phase 6.
- No new dependency. No bundler, no framework, no TypeScript. Vanilla ES modules only.

## Decisions

### D1. Fetch wrapper shape: minimal `apiGet(path)` returning parsed JSON, plus a normalized error class

The wrapper exposes (at minimum) `apiGet(path)` that:
- Resolves `path` against a configured base URL (see D2).
- Sends `Accept: application/json`. No body, no `Content-Type` in this phase (no POSTs yet).
- On network failure, throws an `ApiError` with `kind: 'network'`.
- On non-2xx, throws `ApiError` with `kind: 'http'`, the numeric `status`, and the response body parsed as JSON when possible (otherwise text).
- On 2xx but unparseable JSON, throws `ApiError` with `kind: 'parse'`.
- 401 and 403 are reachable through `kind: 'http'` with status 401/403. Callers check status; the wrapper does not redirect or retry. In anonymous mode they would only appear if the server tightens access mid-session — we still surface them cleanly so Phase 4 can wire up auth without changing the wrapper.

**Alternatives considered:**
- *Return a `{ data, error }` tuple* — rejected. Throwing matches the existing `try/catch` shape in `main.js#handleTapeSelected` and the new screens, and avoids forcing every caller through a discriminator.
- *Wrap the native `Response` and let callers call `.json()` themselves* — rejected. Centralizing the parse + error normalization is the whole point; leaking `Response` re-distributes the error logic.
- *Add `apiPost`, retry, interceptors, abort signals up-front* — rejected. YAGNI for Phase 1. The wrapper is shaped to make adding `apiPost` (Phase 2) and an Authorization header (Phase 4) one-line changes, no more.

### D2. Base URL: read from a single config constant, default to same-origin

`src/api/config.js` exports `API_BASE_URL`. Initial value is `''` (empty string → same-origin: paths like `/campaigns` go to the page's origin). Deployments that need a different host override the constant at deploy time (the static-site model means no env-var injection — we accept that the override is a code edit for now). The wrapper always resolves paths with `new URL(path, baseOrigin)` semantics, so callers pass `/campaigns` literally; the wrapper handles the join.

**Alternatives considered:**
- *Read from a `<meta>` tag in `index.html`* — rejected for now. Adds a runtime indirection for no current benefit (no deployment yet needs a non-same-origin API). Easy to add later if needed.
- *Hardcode the URL in `client.js`* — rejected. A separate config module keeps the wrapper testable and makes the override point obvious.

### D3. Screen wiring: `main.js` boots into `campaign-select`, which then hands off to the existing boot/terminal-list screen scoped to a campaign

New flow:
1. `main.js` calls `showCampaignSelect()` on load (replaces `showBoot()`).
2. `campaign-select.js` calls `apiGet('/campaigns')`.
3. Zero results → render `Nessuna campagna disponibile` + (in this phase) a retry button. No `[ Accedi ]` button (Phase 4 adds it).
4. Exactly one result → call `onCampaignSelected(campaign)` immediately, skipping the chooser UI entirely (no flash of chooser).
5. Multiple results → render a chooser (one CRT button per campaign with `[ ACCEDI: <nome> ]`).
6. `onCampaignSelected(campaign)` mounts the existing terminal-list screen, passing the campaign id so it fetches `GET /campaigns/:id/terminals` instead of `dati/manifest.json`. The client filters the returned list to `isPublic === true` before rendering buttons; non-public terminals are accessible only via the hidden-input path.
7. The terminal-list screen's existing "back to menu" affordance navigates back to `campaign-select`.

The existing `mountBoot(bootEl, …)` function is the right home for the terminal-list screen, but it must now accept a `campaignId` and drop the `fetch('dati/manifest.json')` call. We rename the screen folder/file to `terminal-list.js` for clarity — `boot` no longer means "boot of the app", `campaign-select` does.

**Alternatives considered:**
- *Keep `boot.js` named "boot" and add a separate "campaign-select" screen on top* — rejected. The word "boot" was already overloaded ("ROBCO boot sequence" vs. "app entry point"). Renaming once now beats every future reader having to disambiguate.
- *Always render the chooser, even for a single campaign* — rejected. The architecture doc explicitly says single-campaign should enter directly; matching it now means the "single public campaign" deployment never sees an extra click.

### D4. Hidden-tape lookup: submit the typed meta id to `GET /campaigns/:id/terminals/by-meta/:metaId`

The existing UI surface from `boot.js` (text input with placeholder `INSERISCI NOME ARCHIVIO`, `[ CARICA ]` button, `ARCHIVIO NON TROVATO` error, error clears on resubmit) is preserved on the terminal-list screen verbatim. What changes is the submit handler:
- Trim input. Empty → show error, do not call the API.
- Non-empty → call `apiGet('/campaigns/' + encodeURIComponent(campaignId) + '/terminals/by-meta/' + encodeURIComponent(value))`, where `campaignId` is the id of the currently-selected campaign (already held by the terminal-list screen).
- 2xx → the response is the full playback payload (same shape `GET /terminals/:id/load` returns: `{ content: { nodes, login, meta, state }, localState, globalState }`). The terminal-list screen hands this payload directly to the loader (via the `onTerminalDataLoaded(rawData)` callback passed in by `main.js`) — no second `/load` round-trip.
- 404 → show `ARCHIVIO NON TROVATO`. Any other error (4xx, 5xx, network, parse) also shows `ARCHIVIO NON TROVATO`, so authorization-related failures do not leak the existence of a terminal.
- The client holds **no** hidden-terminal metadata. It does not pre-fetch a list of hidden ids. The slug-to-terminal resolution is server-side only.

**Alternatives considered:**
- *Use `GET /terminals/:id/load` directly with the typed value as the terminal id* — rejected. The API exposes `by-meta/:metaId` as the explicit endpoint for slug-based lookup of hidden terminals. Using the load endpoint with an arbitrary slug would conflate meta ids with internal terminal ids and rely on the server to handle them interchangeably, which is not guaranteed by the contract.
- *Case-insensitive client-side normalization before submit* — rejected. The legacy code did `toLowerCase()` for the local search, but case sensitivity is now a server concern. Submit the trimmed value as typed; if the server wants case-insensitivity it normalizes.

### D5. Terminal-list ↔ terminal-loader contract: ids, not file paths

After this change, `onTapeSelected` (or its successor) receives a terminal id, not a `dati/<filename>` string. The loader fetches `GET /terminals/:id/load` and unpacks the envelope before touching the engine.

**API response envelope:**
```
{
  content: {
    meta:  { title, id, isPublic },
    state: { local, global },
    nodes: { [nodeId]: { text?, choices?, login? } },
    login: { users: [] }
  },
  localState: {},
  globalState: {}
}
```

`main.js` extracts:
- `rawData.content.nodes` → passed to `terminal.loadTapeData(nodes)`. The engine receives a flat map of nodes keyed by id, exactly as before.
- `rawData.content.login` → used for the global login gate. The gate fires only when `login.users.length > 0`; `login` is always present in the envelope so a truthiness check is insufficient.

Per-node login (e.g. a single node that requires credentials) lives as a `login` field inside the node object inside `nodes`. `terminal.js#getLoginForNode` reads it unchanged.

Phase 2 will extend the engine to handle `state`, `variants`, `components`; Phase 1 ignores those fields (they are absent from the envelope in this phase).

The fictional-login flow continues to run the existing in-JS comparison against `content.login.users`. If the server has already stripped credentials, the in-JS comparison will simply find no matching user and reject the login; we accept that as the intended behavior — actual server-side fictional login lands in Phase 5.

**Alternatives considered:**
- *Keep the flat top-level format (nodes at root, `login` at root)* — rejected. The API returns the envelope format; adapting the dati files now ensures the local file corpus stays consistent with what the backend sends, so offline reference files remain useful.
- *Strip the envelope in a middleware layer between `apiGet` and `handleTerminalSelected`* — rejected. The envelope carries `meta` and future `state`/`globalState` fields that Phase 2+ will need. Unpacking only what Phase 1 needs (nodes + login) at the call site is simpler and leaves the full envelope accessible.

### D6. Service worker: drop dead pre-cache entries; do not introduce a new cache strategy

After this change, the SW must not pre-cache `dati/manifest.json` nor any `dati/*.json` holotape, because they are no longer fetched at runtime. We remove those entries from the pre-cache list. We do **not** add cache-on-fetch behavior for the new API endpoints — that lands in Phase 6, which introduces the public/authenticated split. In Phase 1, API responses go to the network every time.

## Risks / Trade-offs

- **[API contract drift while server is evolving]** → Pin to the swagger version checked into `reference/Swagger API.html`. The normalized `ApiError` (D1) plus the explicit 404 mapping in the hidden lookup (D4) means a contract drift surfaces as a clean error message rather than a silently-broken UI. Re-pin when the server contract bumps.
- **[Two screens now share the terminal-list module, increasing coupling]** → The terminal-list module takes a `campaignId` parameter and a single "go back" callback; it does not reach into `campaign-select` internals. The coupling is parameter-passing only, which is acceptable.
- **[Legacy holotapes assume credentials are present in payload for fictional login]** → Server may strip them now or later. If stripped early, the in-JS login screen will reject every login until Phase 5 ships. Mitigation: confirm with the server team whether stripping is active in the deployment we test against; if it is, scope this change's "done when" to terminals without `login` blocks until Phase 5 lands. Credentials sit in `content.login.users` (global gate) or inside a node's `login.users` (per-node gate) — both are subject to server-side stripping.
- **[Single-campaign auto-enter could mask a server bug where the campaign list shows only one item by mistake]** → Acceptable. The user can still hit "back" from inside the campaign to see the (re-fetched) campaign list. If the bug persists, the chooser would not have helped either.
- **[Renaming `boot.js` → `terminal-list.js` invalidates muscle memory and any external links]** → No external links exist (internal-only module). One-time grep + rename is cheap; doing it now beats doing it later when more code references it.
- **[Anonymous-only means we ship a `[ ]` placeholder for `[ Accedi ]`]** → No. We ship **no** `[ Accedi ]` button in Phase 1. Phase 4 adds it. The campaign-selection screen is a real, working screen for anonymous users from day one.
