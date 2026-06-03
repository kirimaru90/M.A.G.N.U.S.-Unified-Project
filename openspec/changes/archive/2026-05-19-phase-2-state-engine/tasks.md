## 1. State store

- [x] 1.1 Create `src/state/store.js` with a module-private `{ local, global }` object plus `seed(envelope)`, `clear()`, `getLocal(name)`, `getGlobal(name)`, `getSnapshot()`, `applyScope(scope, flatState)`, and `async refreshScope(scope, id)` exports.
- [x] 1.2 Implement `seed(envelope)` to replace the contents from `envelope.localState` / `envelope.globalState`, defaulting to empty objects when either field is missing or `null`.
- [x] 1.3 Implement `getSnapshot()` to return a fresh shallow-cloned `{ local: { ...store.local }, global: { ...store.global } }` so callers can't accidentally mutate the live store.
- [x] 1.4 Implement `getLocal(name)` / `getGlobal(name)` as synchronous accessors that return the current value or `undefined` (no throw on unknown variables).
- [x] 1.5 Implement `clear()` to reset both scopes to empty objects, for use on terminal exit and campaign-select navigation.
- [x] 1.6 Implement `async refreshScope(scope, id)` to issue `GET /terminals/:id/state` (scope `'local'`) or `GET /campaigns/:id/state` (scope `'global'`) and replace ONLY that scope's contents from the flat-map response; on rejection, leave the store untouched and rethrow.
- [x] 1.6.1 Implement `applyScope(scope, flatState)` to replace one scope wholesale from the `{ state: { … } }` map returned by a successful `POST .../state/mutate`. Nullish `flatState` → empty scope. Unknown scope → throw.
- [x] 1.7 Verify the store has zero references to `localStorage`, `sessionStorage`, `indexedDB`, or `document.cookie`.

## 2. Condition evaluator

- [x] 2.1 Create `src/state/conditions.js` exporting `evaluate(condition, snapshot)`. Module-level only; no I/O, no imports from `src/state/store.js`.
- [x] 2.2 Implement leaf operator dispatch (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`), reading `condition.var` as `scope.name` (split on first `.`).
- [x] 2.3 Implement combinators (`and: []` → all-true with empty-list = true; `or: []` → any-true with empty-list = false; `not: c` → invert).
- [x] 2.4 Handle undeclared variables: read as `undefined`; `eq` against non-`undefined` returns false; `neq` returns true; numeric ops and `in` return false; never throw.
- [x] 2.5 Support arbitrary nesting (combinators may contain combinators and leaves in any depth).

## 3. Node resolver and dispatchers

- [x] 3.1 Create `src/engine/node-resolver.js` exporting `resolveNode(node, snapshot)`, `dispatchOnEnter(node, terminalId, campaignId)`, and `dispatchChoiceSet(choice, terminalId, campaignId)`.
- [x] 3.2 Implement `resolveNode`: iterate `node.variants` in order, pick the first whose `condition` evaluates true; if none match, pick the entry with `default: true`; if no default, return the node's top-level `text` / `choices` verbatim. Never mutate the input node.
- [x] 3.3 Implement the variant view merge: variant fields override node fields one-level deep (`text`, `choices`); fields absent on the variant fall back to the node.
- [x] 3.4 Implement `dispatchOnEnter`: split `node.on_enter ?? []` by scope (`local.*` vs `global.*` — keyed on `key`, not `var`), issue at most one `apiPost` per scope, await both with `Promise.allSettled`, surface rejections to the caller.
- [x] 3.5 Implement `dispatchChoiceSet`: same scope-splitting and request shape, sourced from `choice.set ?? []`.
- [x] 3.6 Reject client-side any mutation whose `key` is neither `local.*` nor `global.*`: throw an engine error before issuing any request.
- [x] 3.7 Provide a small `handleScopeError(error, scope, id)` helper used by both dispatchers: on `kind: 'http'` with status in `[400, 500)` → call `refreshScope(scope, id)` and return a sentinel indicating "re-render required"; on `network` or 5xx → return a sentinel indicating "inline non-blocking error" (no refresh).
- [x] 3.8 On every successful POST, read the response's `state` field and call `applyScope(scope, response.state)` to replace the corresponding scope of the store. This is what makes a later node's variants observe the mutations the previous node's `on_enter` just applied, without re-fetching.
- [x] 3.9 Author holotape `on_enter` / `choice.set` mutations in the API wire shape (`{ op, key, value | by }`) and forward them as-is — no client-side translation. Supported ops: `set`, `increment`, `toggle`. There is no `decrement`: authors express a decrement as `{ op: 'increment', key: '<scope>.<x>', by: -N }`.

## 4. apiPost extension to the client wrapper

- [x] 4.1 Add `apiPost(path, body)` to `src/api/client.js`, sharing the base-URL resolution and `ApiError` shape with `apiGet`.
- [x] 4.2 Send `Accept: application/json` and `Content-Type: application/json`; serialize `body` with `JSON.stringify`.
- [x] 4.3 Verify the existing `apiGet` behavior is unchanged (no regression in `api-client` spec scenarios).
- [x] 4.4 Verify no `Authorization` header is attached (anonymous mode invariant from Phase 1 preserved).

## 5. Engine wiring (terminal screen)

- [x] 5.1 In `src/main.js#playTerminalData`, call `store.seed({ localState: rawData.localState, globalState: rawData.globalState })` immediately after success-path validation, before `terminal.loadTapeData(nodes)`.
- [x] 5.2 In `src/main.js`, call `store.clear()` from `showCampaignSelect` and `showTerminalList` so navigating out of a terminal leaves no state behind.
- [x] 5.3 Pass `terminalId` and `campaignId` into `mountTerminal` (or into the mutation dispatchers) so the resolver knows where to POST mutations.
- [x] 5.4 Rewire `src/screens/terminal.js#loadNode`: read the node, call `resolveNode(node, store.getSnapshot())` to get the view, render the view via the existing `renderNode` path, then (without awaiting render) call `dispatchOnEnter(node, terminalId, campaignId)`.
- [x] 5.5 Rewire `showChoices` so that selecting a choice with a `set` block first calls `dispatchChoiceSet(choice, terminalId, campaignId)` and then navigates to the target node. The target node's `on_enter` is dispatched by `loadNode` as part of the normal entry flow.
- [x] 5.6 On any dispatch returning the "re-render required" sentinel from `handleMutationError`, abort current typing and re-call `loadNode(currentNodeId)` so the node re-resolves against the refreshed snapshot.
- [x] 5.7 On any dispatch returning the "inline non-blocking error" sentinel, render a small CRT-styled status message above the choices (placement consistent with existing inline errors); dismiss it on the next user action.

## 6. Backward-compat verification

- [x] 6.1 Confirm every current holotape served by the API plays identically: nodes without `variants` resolve to base text/choices; nodes without `on_enter` and choices without `set` produce zero state POSTs; an empty `state` block seeds empty scopes.
- [x] 6.2 Confirm `apiGet`-only flows (campaign-select, terminal-list, terminal load) issue identical traffic to Phase 1 for stateless holotapes.
- [x] 6.3 Verify a reload mid-session leaves the store empty until the next terminal load.

## 7. Fixture holotape exercising state

- [x] 7.1 Author a fixture holotape (in `dati/` or a developer-only path) that declares at least one `local` variable and one `global` variable.
- [x] 7.2 Include a node with `variants` keyed off the local variable (matching, non-matching, and a `default: true` variant).
- [x] 7.3 Include a node with `on_enter` mutations (one `local.*`, one `global.*`).
- [x] 7.4 Include a choice with a `set` block mixing `local.*` and `global.*` mutations.
- [x] 7.5 Walk through the fixture in the browser; verify variant resolution, mutation traffic in DevTools (two POSTs to the correct endpoints, preserving order within each scope, body uses `key` / `by` per server contract), the response `{ state }` updates the store (a second node entry's variants observe the previous node's `on_enter` results without any `GET .../state` in between), and a deliberately-rejected mutation (force a 400 from the dev API by sending an undeclared key) triggers `GET /terminals/<id>/state` (local-scope refresh) or `GET /campaigns/<id>/state` (global-scope refresh) followed by a re-render of the current node.

## 8. Hidden-terminal endpoint rename and MetaDto reshape

- [x] 8.0.1 In `src/screens/terminal-list.js`, change the hidden-tape lookup from `GET /campaigns/:id/terminals/by-meta/:value` to `GET /campaigns/:id/terminals/by-hidden-id/:value`. The success/error handling (`onTerminalDataLoaded` on 2xx, `ARCHIVIO NON TROVATO` on any failure) is unchanged.
- [x] 8.0.2 Confirm `src/main.js#playTerminalData` reads `terminalId` from `rawData.content.meta.id` (the server-injected mirror of the top-level terminal id) — this is the value subsequently passed to `mountTerminal#loadTapeData` and threaded into every `POST /terminals/:terminalId/state/mutate` request and every `store.refresh(terminalId, …)` call. No code change is required if this is already the case; verify explicitly.
- [x] 8.0.3 Confirm there is no code path that submits `meta.hiddenId` to `/terminals/:id/load`, `/terminals/:id/state/mutate`, or any other endpoint other than `/campaigns/:id/terminals/by-hidden-id/:hiddenId`.
- [x] 8.0.4 Confirm the client never sends `meta.id` on any input/POST body. (Phase 2 introduces only state-mutation POSTs, whose body shape is `{ mutations: [...] }` and contains no `meta` at all — verify by inspection.)
- [x] 8.0.5 Manual smoke-test the hidden-tape path against the dev API: a valid `hiddenId` loads the terminal exactly as the visible button would; the on-screen flow afterwards (variant resolution, mutation POSTs to `/terminals/<meta.id>/state/mutate`) is keyed on the load envelope's `content.meta.id`, not on the submitted `hiddenId`.

## 9. Spec compliance and documentation

- [x] 9.1 Verify the three new spec files (`state-store`, `conditional-variants`, `state-mutations`) AND the `hidden-terminal-access` delta are valid by running `openspec validate phase-2-state-engine --strict`.
- [x] 9.2 Update `openspec/REWORK.md` Phase 2 checklist boxes as each step lands.
- [x] 9.3 Update `guida terminale.md` (or equivalent authoring docs) to describe `state.local` / `state.global` declarations, `variants`, `on_enter`, and `choice.set` — content-creator workflow note required by project rules.
- [x] 9.4 Update `guida terminale.md` to describe `meta.hiddenId` (human-authored slug for hidden-terminal lookup) and clarify that `meta.id` is server-injected and never authored by hand.
