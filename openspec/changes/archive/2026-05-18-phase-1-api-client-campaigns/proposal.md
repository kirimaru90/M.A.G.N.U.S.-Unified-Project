## Why

The Terminal currently boots from a static `dati/manifest.json` and loads holotape JSON files from disk. That worked while the Terminal was the whole product, but the wider RobCo architecture is now a real API serving campaigns, terminals, and (later) state. We need the Terminal to be an actual client of that API. Phase 1 establishes the API client and the new campaign-selection entry point so every subsequent phase (state, inputs, real-user auth, server-side fictional login, cache split) has a real network surface to build on.

This is also the first opportunity to surface a concept the static flow could not represent: a player picks a **campaign** before seeing terminals. Hidden terminals stop being client-side metadata and become server-mediated lookups.

## What Changes

- **New** `src/api/client.js`: anonymous fetch wrapper. Base URL config, JSON in/out, normalized error shape, surfaces 401/403 distinctly from network/5xx. No auth header in this phase.
- **New** `src/screens/campaign-select.js`: new top-level screen, CRT aesthetic. Lists active public campaigns from `GET /campaigns`. Single-campaign result auto-enters; multi-campaign renders a chooser; zero-campaign renders `Nessuna campagna disponibile`.
- **Modified boot flow**: `src/main.js` opens campaign-select instead of going straight to the terminal/boot screen. The current boot screen (terminal list + hidden-tape input) is reused but driven by the API, scoped to the selected campaign.
- **API-backed terminal list**: inside a campaign, `GET /campaigns/:id/terminals` replaces `dati/manifest.json`. The existing terminal-selection UI is preserved; only its data source changes.
- **API-backed terminal load**: `GET /terminals/:id/load` replaces static file fetch in `loadServerFile`. The response is a structured envelope `{ content: { meta, state, nodes, login }, localState, globalState }`. The client extracts `content.nodes` (the node graph) and `content.login` (the global login gate) before handing them to the engine. The client MUST NOT depend on fictional-login credentials being present in the payload (server may strip them; in this phase the in-JS login flow keeps working with whatever credentials remain — full removal is Phase 5).
- **API-backed terminal list filtering**: `GET /campaigns/:id/terminals` returns all terminals. The client filters client-side to only render buttons for terminals where `isPublic === true`. Non-public terminals remain accessible only through the hidden-name input.
- **Server-mediated hidden-tape access**: the hidden-name input on the terminal-list screen submits the typed value as a meta-id slug to `GET /campaigns/:id/terminals/by-meta/:metaId`. The response is the full playback payload (same shape as `GET /terminals/:id/load`) and is fed straight into the loader — no second `/load` request. 404 yields the existing `ARCHIVIO NON TROVATO` behavior; any non-404 error (auth, 5xx, network, parse) also maps to `ARCHIVIO NON TROVATO` so authorization failures don't leak terminal existence. The client no longer holds metadata for hidden terminals.
- **BREAKING (internal)**: `dati/manifest.json` is no longer fetched at runtime. The `dati/` directory stays on disk as offline reference until Phase 6 cleanup, but a deployment without `dati/` works.
- **No** changes to the typewriter, sounds, keyboard nav, back history, choice rendering, or the in-JS fictional-login flow. Engine behavior is preserved exactly.
- **Out of scope**: real-user auth (Phase 4), state/variants/mutations (Phase 2), input components (Phase 3), server-side fictional login (Phase 5), service worker cache policy changes (Phase 6), deleting `dati/` (Phase 6 cleanup).

## Capabilities

### New Capabilities
- `api-client`: contract for the fetch wrapper — base URL handling, JSON request/response, normalized error shape (`network` / `http` with status / `parse`), 401/403 surfacing, anonymous-mode behavior (no Authorization header sent).
- `campaign-selection`: behavior of the new top-level screen — public-only visibility in anonymous mode, single-campaign auto-enter, multi-campaign chooser, empty-state message, navigation into a campaign's terminal-list screen.

### Modified Capabilities
- `hidden-terminal-access`: the requirements around "client searches non-public manifest entries" no longer reflect reality. The hidden lookup is now server-mediated through `GET /terminals/:id/load`; the client holds no hidden-terminal metadata. The boot-screen UI surface (visible button list, hidden-name input with `INSERISCI NOME ARCHIVIO` placeholder + `[ CARICA ]` submit, `ARCHIVIO NON TROVATO` error, error clearing on resubmit) is preserved unchanged.

## Impact

- **Code**: new `src/api/client.js`; new `src/screens/campaign-select.js`; modifications to `src/main.js` (boot wiring), the terminal-list screen module (data source switch), and the hidden-tape lookup path (server call instead of local search). Existing engine modules untouched.
- **Runtime data**: `dati/manifest.json` no longer fetched. Holotape JSON arrives from `GET /terminals/:id/load` instead of static URLs. The response is a structured envelope: `{ content: { meta: { title, id, isPublic }, state: { local, global }, nodes: { [nodeId]: node }, login: { users } }, localState, globalState }`. The engine receives only `content.nodes`; the global login gate comes from `content.login.users`. All `dati/*.json` files have been migrated to this format. No `state`, `variants`, or `components` fields yet — those land in later phases.
- **Deployment**: requires the API base URL to be reachable from the client. Anonymous mode means no token plumbing yet.
- **PWA / service worker**: `sw.js` will need to stop pre-caching `dati/manifest.json` and the legacy holotape files. Full cache-policy split (public vs. authenticated) is Phase 6; this phase only removes the now-dead pre-cache entries.
- **Content-creator workflow**: holotapes are no longer authored as files in `dati/` and registered in `manifest.json`. Authoring now happens via the server (out of scope for this change — covered by the wider RobCo backend tooling). The legacy `dati/` directory remains on disk as offline reference until Phase 6.
- **Existing specs preserved as-is**: `typing-animation-flow`, `fast-replay-typing`, `terminal-sound-effects`, `keyboard-navigation`, `scroll-and-shortcuts`, `terminal-exit`, `file-error-back-navigation`, `login-access-control` (Phase 5 will update this), `pwa-installability` (Phase 6 will update this).
