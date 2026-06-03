## 1. API client foundation

- [x] 1.1 Create `src/api/config.js` exporting `API_BASE_URL` (default `''` → same-origin). Document the override-at-deploy convention in a one-line comment.
- [x] 1.2 Create `src/api/client.js` with `apiGet(path)`: resolves path against `API_BASE_URL`, sends `Accept: application/json`, no `Authorization` header, no `Content-Type`.
- [x] 1.3 In `src/api/client.js`, define and export `ApiError` (or equivalent) carrying `{ kind, path, status?, body? }`. Map underlying failures: rejected fetch → `kind:'network'`; non-2xx → `kind:'http'` with `status` and parsed `body` (fallback to text on parse failure); 2xx with unparseable body → `kind:'parse'`.
- [x] 1.4 Verify in DevTools: a request to a known endpoint succeeds and returns parsed JSON; a request to a non-existent endpoint throws an `ApiError` with `kind:'http'` and `status:404`; an offline page (DevTools throttling: Offline) throws `kind:'network'`.

## 2. Campaign-selection screen

- [x] 2.1 Create `src/screens/campaign-select.js` exporting `mountCampaignSelect(rootEl, { onCampaignSelected, setKeyHandler })`. CRT aesthetic; reuse existing `.choice-btn` styling.
- [x] 2.2 Add a dedicated container element for campaign-select in `index.html` (e.g. `<div id="campaign-select-screen">`), parallel to `#boot-screen`, hidden by default.
- [x] 2.3 In `mountCampaignSelect`, call `apiGet('/campaigns')` on mount.
- [x] 2.4 Render single-campaign case: when the list has length 1, immediately invoke `onCampaignSelected(campaign)`; do not render the chooser DOM.
- [x] 2.5 Render multi-campaign case: one `[ ACCEDI: <nome> ]` button per campaign, wired to `onCampaignSelected`. Apply `makeNavHandler` over the buttons; focus the first.
- [x] 2.6 Render empty-state: text `Nessuna campagna disponibile` + `[ Riprova ]` button that re-mounts the screen.
- [x] 2.7 Render error-state: CRT-styled `ERRORE DI RETE` message + `[ Riprova ]` button for any `ApiError` kind.
- [x] 2.8 Verify in browser: with a mocked-or-real API returning 0/1/multiple campaigns, each branch renders as specified and keyboard nav works.

## 3. Rename `boot` screen → `terminal-list` and drive it from the API

- [x] 3.1 Move `src/screens/boot.js` → `src/screens/terminal-list.js`. Rename the exported function (`mountBoot` → `mountTerminalList`). Update imports across the codebase.
- [x] 3.2 Change the signature to `mountTerminalList(rootEl, { campaignId, onTerminalSelected, onBack, setKeyHandler })`. Remove the `fetch('dati/manifest.json')` call.
- [x] 3.3 Replace the manifest fetch with `apiGet('/campaigns/' + encodeURIComponent(campaignId) + '/terminals')`. Render one CRT button per terminal returned, in order, with the same `[ ACCEDI: <nome> ]` label format the current code uses.
- [x] 3.4 On button activation, call `onTerminalSelected(terminal.id)` (not a file path).
- [x] 3.5 Add a `[ Indietro ]` (or equivalent) button that calls `onBack()`. Include it in the focusable set for keyboard navigation.
- [x] 3.6 Preserve the hidden-tape UI (input with `INSERISCI NOME ARCHIVIO` placeholder, `[ CARICA ]` button, `ARCHIVIO NON TROVATO` error). Delete the dependence on `lookupHiddenTape` and the `hiddenTapes` array.
- [x] 3.7 Wire the hidden-tape submit to call `apiGet('/campaigns/' + encodeURIComponent(campaignId) + '/terminals/by-meta/' + encodeURIComponent(trimmedValue))`. The response is the full playback payload (same shape as `/terminals/:id/load`); hand it straight to `onTerminalDataLoaded(rawData)` (no second `/load` request). Empty input → show error, no request.
- [x] 3.8 Verify in browser: with the API returning a campaign's terminal list, the visible terminals render as buttons and load on click; back button returns to campaign selection.

## 4. Terminal loader via API

- [x] 4.1 In `src/main.js`, replace `fetch('dati/' + filename)` with `apiGet('/terminals/' + encodeURIComponent(terminalId) + '/load')`. Rename `handleTapeSelected(filename)` → `handleTerminalSelected(terminalId)` (or equivalent). Update all call sites.
- [x] 4.2 Pass `handleTerminalSelected` to `mountTerminalList` as `onTerminalSelected` (for visible buttons → triggers a `/terminals/:id/load` fetch) and `playTerminalData` as `onTerminalDataLoaded` (for the hidden-tape path → already has the payload from the by-meta call, plays it directly).
- [x] 4.3 In `handleTerminalSelected`, preserve the existing `ESTRAZIONE DATI IN CORSO`, sound, 1500 ms artificial delay. The API now returns `{ content: { nodes, login, meta, state }, localState, globalState }` — extract `content.nodes` for node lookup and `content.login` for the global login gate (check `login.users.length > 0` instead of truthiness, since login is always present). All `dati/*.json` files converted to this format.
- [x] 4.4 Update the success path so it no longer assumes `data.login.users[].password` is present. If `data.login` exists but no `password` field is found for the typed user, the existing login screen rejects the attempt (no special-case code needed; document this behavior in a one-line comment if non-obvious).
- [x] 4.5 Hidden-tape error mapping: when the `by-meta` lookup called from the hidden-tape input fails, the terminal-list screen displays `ARCHIVIO NON TROVATO` for any error (404, other HTTP, network, parse) so authorization-related failures do not leak existence. (The visible-button path keeps its existing `ERRORE LETTURA` message.)
- [x] 4.6 Verify in browser: clicking a visible terminal loads it; typing a hidden id loads it; typing a bogus id shows `ARCHIVIO NON TROVATO`; the visible-button error path still shows `ERRORE LETTURA` on a forced failure.

## 5. Boot wiring in `main.js`

- [x] 5.1 In `main.js`, remove the `showBoot()` function and replace it with `showCampaignSelect()` that hides terminal/login/terminal-list and shows the new `#campaign-select-screen`.
- [x] 5.2 Implement `onCampaignSelected(campaign)` → hides `#campaign-select-screen`, shows `#boot-screen` (now hosting terminal-list), mounts `mountTerminalList` with the campaign id and an `onBack` that calls `showCampaignSelect()`.
- [x] 5.3 Replace the on-load `showBoot()` call and the `onDisconnect` callback so both route to `showCampaignSelect()`.
- [x] 5.4 Verify the full flow in browser: load → campaign-select (single auto-enters; multi shows chooser; zero shows empty state). Choosing a campaign reaches the terminal-list. Disconnecting from a terminal returns to campaign-select.

## 6. Service worker and offline reference cleanup (this phase only)

- [x] 6.1 In `sw.js`, remove `dati/manifest.json` and any `dati/*.json` entries from the pre-cache list. Bump the cache version constant so existing clients drop the stale cache.
- [x] 6.2 Do not add cache-on-fetch behavior for the new `/campaigns` or `/terminals` endpoints (Phase 6 owns the cache split).
- [x] 6.3 Verify in browser: hard-reload registers the new SW; Network panel confirms no requests to `dati/manifest.json` or `dati/*.json` are issued at runtime.

## 7. Regression check against existing engine specs

- [x] 7.1 Walk through the visible-button → terminal flow and confirm typewriter cadence, sounds, keyboard navigation, choice rendering, back history, and terminal-exit behave identically to before (per the existing specs `typing-animation-flow`, `fast-replay-typing`, `terminal-sound-effects`, `keyboard-navigation`, `scroll-and-shortcuts`, `terminal-exit`, `file-error-back-navigation`).
- [ ] 7.2 Walk through the in-JS fictional login for a terminal whose payload still contains credentials; confirm `login-access-control` scenarios still pass.
- [x] 7.3 Run with `dati/` renamed away on disk (or with the dev server returning 404 for `dati/*`); confirm every currently-existing holotape is reachable and playable via the API.
- [x] 7.4 Run the scenarios in this change's `specs/api-client/spec.md`, `specs/campaign-selection/spec.md`, and `specs/hidden-terminal-access/spec.md` manually in the browser; record any deviations and fix before archiving.

## 8. Bug fixes (discovered during QA)

- [x] 8.1 **Hover sound missing in campaign-select and terminal-list.** `terminal.js` wires `btn.addEventListener('mouseenter', selectionSound)` on each choice button. The same listener is absent from `_renderChooser` in `campaign-select.js` and from the terminal buttons in `terminal-list.js`. Add `btn.addEventListener('mouseenter', selectionSound)` to every `choice-btn` created in both screens, importing `selectionSound` from `../engine/sounds.js`. Verify: hovering a campaign or terminal button plays the selection sound; arrow-key navigation still plays it too.

- [x] 8.2 **Campaign name not displayed correctly in campaign chooser.** Campaign objects returned by `GET /campaigns` carry the display name in the `name` field. Verify that `_renderChooser` in `campaign-select.js` reads `campaign.name` and that the actual API response structure matches (top-level `name`, not nested). If the live or mock API wraps the field differently (e.g. `campaign.data.name` or `campaign.title`), update the accessor to match. Apply the same check to `terminal.name` in `terminal-list.js` for consistency. Verify: campaign and terminal buttons show the correct human-readable name instead of `undefined` or a raw id.

- [x] 8.3 **Terminal list shows non-public terminals.** `GET /campaigns/:id/terminals` returns all terminals; the public-visibility field is `isPublic` (not `public`). Added a client-side filter `terminals.filter(t => t.isPublic)` in `terminal-list.js` before rendering buttons, so only public terminals appear in the visible list. Non-public terminals remain accessible via the hidden-name input. Updated design, proposal, and envelope schema references from `public` → `isPublic`.
