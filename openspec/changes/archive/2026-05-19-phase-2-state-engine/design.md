## Context

After Phase 1 the Terminal client is an ES-module app that:

- Boots into `campaign-select`, then `terminal-list`, then `terminal`.
- Loads holotape content via `apiGet('/terminals/:id/load')` which returns an envelope `{ content: { meta, state, nodes, login }, localState, globalState }`.
- Runs a node/choice engine in `src/screens/terminal.js` (`mountTerminal`) that calls `renderNode(nodeId, node)` for the node's current text/choices, with `loadNode(nodeId, isBack)` as the only entry point.

The engine currently ignores three fields the envelope already carries: `content.state` (the declared variables and their defaults — informational only), and the per-node `variants`, `on_enter`, and per-choice `set` fields (absent in current content, but reserved by ARCHITECTURE.md §8). It also ignores the envelope's top-level `localState` / `globalState`.

Phase 2 is the first slice that:

1. Reads `localState` / `globalState` into a runtime store.
2. Honors `variants` (conditional content) when rendering a node.
3. Honors `on_enter` mutations on node entry.
4. Honors `choice.set` mutations on choice selection.
5. Sends mutations to `POST /terminals/:id/state/mutate` and `POST /campaigns/:id/state/mutate`, atomic per request, server-authoritative.

The architecture doc nails down the mutation model (server-authoritative, refresh on rejection) and the condition grammar (structured JSON, leaf operators `eq` / `neq` / `gt` / `gte` / `lt` / `lte` / `in`, combinators `and` / `or` / `not`). Phase 2 is small because the doc already made every interesting decision; the design work is mostly about how the new pieces slot into the existing engine without disturbing anything that already works.

The API is live and evolving against `reference/Swagger API.html`. Mutation and refresh endpoints are pinned to that contract.

## Goals / Non-Goals

**Goals:**
- A single in-memory state store (`src/state/store.js`) that every read goes through. No parallel caches in screens or engine modules.
- A pure condition evaluator (`src/state/conditions.js`) with no I/O and no coupling to the store — it takes a snapshot as an argument so it's trivially testable and reusable in Phase 3 (input branches).
- A new node resolver (`src/engine/node-resolver.js`) that produces a "resolved view" of a node (text + choices after variant selection) without mutating the original node object. The resolver also owns the on_enter / choice.set dispatch hooks.
- The render-order question ("variants vs. on_enter") locked in as a normative spec requirement: evaluate variants from the current snapshot, render, **then** send `on_enter` mutations. No relitigation later.
- Rejection handling locked in as a normative spec requirement: 4xx on a mutation POST → `store.refresh(...)` → re-resolve and re-render the current node against the refreshed snapshot.
- Zero observable behavior change for holotapes that don't declare any `state` block. Every existing holotape MUST continue to play identically.
- A clean seam for Phase 3 (input components) to plug into: an `input` component renderer in Phase 3 will use the same store + evaluator + mutation dispatch this phase introduces.

**Non-Goals:**
- No input components. (Phase 3.) Components consume the same store, evaluator, and mutation dispatch this phase introduces, but the renderer for an `input` node is Phase 3 work.
- No optimistic mutations, no last-write-wins reconciliation. (Future change.) The spec explicitly defers this so it doesn't sneak into Phase 2 by accident.
- No real-user auth / per-player state scoping. (Phase 4.) Mutations in Phase 2 are issued anonymously, scoped to terminal and campaign only.
- No service-worker cache changes. (Phase 6.) The current `sw.js` already passes through non-GET requests; mutations won't be cached by virtue of being POSTs, which is enough for this phase.
- No client-side validation of mutations against the declared `state` schema. The server validates. The client only checks the scope prefix (`local.*` / `global.*`) before issuing a request, because the routing target depends on it.
- No build step, no framework, no TypeScript. Vanilla ES modules only.
- No new dependency.

## Decisions

### D1. State store is a module-level singleton, not a class

`src/state/store.js` exports module-level functions (`seed`, `getLocal`, `getGlobal`, `getSnapshot`, `refresh`) that operate on a single private `{ local, global }` object held in the module scope. The Terminal only ever has one active session at a time (one campaign, one terminal), so a singleton matches the lifecycle and keeps the call sites tiny.

A class would force every consumer to thread a store instance through the engine. Phase 0 deliberately split things into modules with explicit exports; doing the same here for state matches that style and matches `src/engine/back-history.js` which is also a module-level singleton.

**Alternatives considered:**
- *Class with `new Store()` instances* — rejected. The Terminal only ever has one active session, and threading the instance through the call graph buys nothing.
- *Reactive store (subscribe / publish)* — rejected. No view layer subscribes to state changes; the engine re-renders explicitly when needed (variant resolution, refresh-after-rejection). Reactivity is overhead for no benefit.

### D2. `getSnapshot()` returns an immutable view (shallow clone)

The condition evaluator and the node resolver are pure — they take a snapshot and produce a result. If the snapshot were a live reference to the store's private object, an in-flight mutation between `getSnapshot()` and `evaluate(condition, snapshot)` could change the evaluator's input mid-call. Shallow-cloning at the boundary makes the evaluator's "I take a snapshot" semantics literally true.

The shallow clone is `{ local: { ...store.local }, global: { ...store.global } }`. Variable values are always primitives (the architecture doc's state types are bool / number / string / enum; no nested objects), so a shallow clone is enough.

**Alternatives considered:**
- *Return a live reference and trust the call sites* — rejected. One day someone caches a snapshot across an `await` and we get a heisenbug.
- *Use `Object.freeze` on the live object* — rejected. Freezes the store's private state, which we still need to mutate on `seed()` / `refresh()`.

### D3. Condition evaluator is fully pure; takes the snapshot as an argument

`evaluate(condition, snapshot)` is the only export from `src/state/conditions.js`. It does not import the store. This makes the evaluator:

- Testable in isolation (drive it from constant snapshot fixtures).
- Reusable by Phase 3 (an `input` component branch evaluates the same way, but against a snapshot augmented with the just-submitted value).
- Free of timing concerns (the evaluator is synchronous; all I/O lives in the resolver and store).

The leaf-comparison shape is `{ var: 'scope.name', op: 'eq|neq|gt|gte|lt|lte|in', value: <value> }`. Scope is parsed by splitting on the first `.`; what follows is the variable name (which may itself contain dots — we treat everything after the first `.` as the name).

Reading an undeclared variable returns `undefined`. `eq` against any non-`undefined` value is `false`; `neq` against any non-`undefined` value is `true`. Numeric operators (`gt` / `gte` / `lt` / `lte`) against `undefined` return `false`. `in` against `undefined` returns `false`. The evaluator never throws on a missing variable — the server is the schema authority, so a misspelled variable in a condition is the author's bug, not a crash.

**Alternatives considered:**
- *Expression-string DSL* — rejected. The architecture doc explicitly mandates structured JSON because the backoffice's visual condition builder generates it. An expression DSL would force a parser into both ends.
- *Pre-compile conditions into closures at load time* — rejected for now. Premature optimization; the evaluator is O(condition-size) and conditions are small.

### D4. Node resolver produces a "resolved view" without mutating the node

`resolveNode(node, snapshot)` returns `{ text, choices }` (and any other variant-overridable fields) without modifying the original node. The shape is:

```
{
  text: variant.text ?? node.text,
  choices: variant.choices ?? node.choices,
}
```

where `variant` is the first entry in `node.variants` whose `condition` evaluates true, or the entry marked `default: true`, or `null` (in which case the resolver falls back to the node's top-level fields).

Returning a fresh view (not a mutation) means re-renders against a refreshed snapshot are trivially safe — the same node object can be re-resolved any number of times.

**Alternatives considered:**
- *Mutate the node in place* — rejected. We'd have to deep-clone the node on load to avoid corrupting `terminalData`, which is more work than returning a small view.
- *Inline variant resolution in `renderNode`* — rejected. The Phase 3 `input` component will need to re-resolve a node against a new snapshot too; centralizing the logic now avoids two divergent paths.

### D5. Render-order: variants → render → on_enter dispatch

When `loadNode(nodeId)` runs:

1. Read the current snapshot via `store.getSnapshot()`.
2. Call `resolveNode(node, snapshot)` to pick the variant and produce the view.
3. Hand the view to `renderNode(nodeId, view)` (the existing renderer, fed the variant's text/choices).
4. **After** kicking off render, dispatch the node's `on_enter` mutations (if any) via the mutation dispatcher.

Step 4 does not block the render. Step 4's POST may reject; if it does, the rejection handler refreshes the store and re-renders the current node. The re-render aborts the in-flight typewriter (existing `abortCurrentTyping()` machinery), reads the refreshed snapshot, re-resolves the node, and renders the new view.

This ordering is the locked-in answer to the question REWORK.md flags as the Phase 2 risk. It matches ARCHITECTURE.md §9.4 (mutation step happens after the action that triggers it) and avoids the alternative ordering (apply on_enter first, then evaluate variants against the post-mutation snapshot) which would force two consecutive variant evaluations on every node entry and create a race between the mutation round-trip and the render.

**Alternatives considered:**
- *Apply on_enter first, then evaluate variants* — rejected. Would mean either (a) blocking the render on the mutation round-trip (degrades perceived latency on every node), or (b) speculatively rendering twice (first against the pre-mutation snapshot, then against the post-mutation snapshot once the response lands — flickers and surprises the user).
- *Evaluate variants on the post-mutation snapshot via optimistic apply* — rejected. Optimistic apply is explicitly out of scope for this phase.

### D6. Mutation dispatch splits a list by scope, issues at most one POST per scope

A trigger (`on_enter` or `choice.set`) carries an ordered list of mutations. The dispatcher walks the list once, partitioning into `localMutations` and `globalMutations` while preserving order within each scope. Then:

- If `localMutations.length > 0`, issue `POST /terminals/:terminalId/state/mutate` with `{ mutations: localMutations }`.
- If `globalMutations.length > 0`, issue `POST /campaigns/:campaignId/state/mutate` with `{ mutations: globalMutations }`.

The two POSTs are issued concurrently (no ordering dependency between them). Both promises are awaited via `Promise.allSettled` so a rejection on one doesn't drop the other on the floor. The dispatcher waits for both to settle before allowing the next user-driven mutation trigger (debouncing choice selections during in-flight mutations is left to the existing engine guards — choice buttons are removed during render, so the user can't double-click into a second dispatch).

Per-request atomicity is a server guarantee. The client never partially re-sends.

**Alternatives considered:**
- *One POST per mutation* — rejected. Defeats the architecture doc's atomicity guarantee and amplifies network chatter.
- *One combined POST to a unified endpoint* — rejected. The endpoint layout in the architecture doc explicitly separates terminal-scoped from campaign-scoped state.
- *Serialize the two POSTs (local then global)* — rejected. They're independent; serializing doubles the latency of a mixed trigger for no benefit.

### D7. Rejection only triggers refresh on 4xx HTTP errors

`kind: 'network'` and `kind: 'http'` with `status >= 500` mean the server didn't reject the mutation, it didn't process it. Refreshing on these would mask connectivity issues as state desync. We surface them as inline non-blocking error messages (consistent with the existing `ERRORE DI RETE` style) and leave the snapshot alone.

`kind: 'http'` with `status` in `[400, 500)` is the "server validated and rejected" case from ARCHITECTURE.md §8.5. We call `store.refresh(terminalId, campaignId)` and re-render the current node. The refresh implementation re-issues `GET /terminals/:terminalId/load` (or a dedicated state-only endpoint when the API exposes one) and replaces the store's contents from the response's `localState` / `globalState` fields.

We don't retry. Retrying a validation failure changes nothing; retrying a 5xx is a job for the user.

**Alternatives considered:**
- *Refresh on every error* — rejected. Network errors masquerading as state desync is confusing and wastes a round-trip.
- *Refresh + retry the mutation* — rejected. The architecture doc is explicit that rejection means "refetch and re-render", not "retry".

### D8. apiPost helper lives in `src/api/client.js`, not a new module

The Phase 1 spec for `api-client` is intentionally scoped to GET behavior because Phase 1 had no POSTs. Adding `apiPost` is an extension, not a delta. It shares the base URL handling, the `ApiError` shape, the anonymous-mode rule (no Authorization header in this phase), and the same `kind: 'network' | 'http' | 'parse'` discriminator.

Implementation note: `apiPost(path, body)` calls `fetch(url, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })` and re-uses the same response-handling pipeline as `apiGet`. The error path is identical.

**Alternatives considered:**
- *New `src/api/mutations.js` module that wraps `fetch` directly* — rejected. Duplicates the error normalization for no reason.
- *Generalize the wrapper to `apiRequest(method, path, body?)`* — rejected. `apiGet` is the dominant call site; making every caller pass `'GET'` everywhere is friction.

### D9. Seed the store from the load envelope in `main.js#playTerminalData`

The seed is a single line at the top of `playTerminalData`:

```
store.seed({ localState: rawData.localState, globalState: rawData.globalState });
```

That seeds before `terminal.loadTapeData(nodes)` is called, so by the time the engine calls `loadNode('start')` the store is populated. The store also takes the `terminalId` and `campaignId` so subsequent `refresh()` calls have the right route — these come from `currentCampaign.id` (already in `main.js`) and the terminal id that the dispatcher receives at trigger time.

The store also exposes `clear()` (called from `showCampaignSelect` and `showTerminalList`) to make the "no cross-terminal contamination" invariant explicit. `seed()` already replaces contents, so `clear()` is mostly belt-and-braces, but it makes the lifecycle obvious to a reader of `main.js`.

**Alternatives considered:**
- *Have `mountTerminal` seed the store* — rejected. `mountTerminal` mounts once at app startup; per-terminal seeding belongs at the per-terminal load site (`playTerminalData`).
- *Make `terminal.loadTapeData` take the full envelope and seed internally* — rejected. Conflates content with state. The current `loadTapeData(nodes)` signature is tight; keeping it that way means the state plane stays orthogonal to the content plane.

### D10. The resolver is the only place engines call into the store

`mountTerminal`'s renderer (in `src/screens/terminal.js`) is *not* refactored to read state directly. Instead, `loadNode` is rewired to call the resolver, which reads the snapshot and returns a view. The dispatch of `on_enter` / `choice.set` mutations is also routed through the resolver (or a thin sibling module that lives next to it). This keeps `src/screens/terminal.js` ignorant of the state plane — it just renders whatever view it's handed.

Concretely: `loadNode(nodeId, isBack)` becomes "look up the node, resolve it, render the resolved view, dispatch on_enter." Choice selection in `showChoices` becomes "dispatch choice.set, then call `loadNode(targetId)`." The resolver module wraps both flows behind small, well-named helpers (`resolveNode`, `dispatchOnEnter`, `dispatchChoiceSet`) so the screen module's diff stays small.

**Alternatives considered:**
- *Push variant/mutation logic into `mountTerminal`* — rejected. Couples the screen renderer to the state plane and makes it harder to swap renderers later (e.g. a Phase 3 input component renderer reuses the same resolver).
- *Make every screen module aware of the store* — rejected. The terminal-list and campaign-select screens are stateless w.r.t. holotape state; only the in-terminal renderer needs to know.

## Risks / Trade-offs

[Variant render-order ambiguity sneaks back in via Phase 3 input components.] → Mitigated by the `conditional-variants` spec locking in the ordering as a normative scenario ("variants evaluated against pre-mutation snapshot"). Phase 3 will reuse the same resolver, so it inherits the same ordering by construction.

[Mutation rejection re-renders cause flicker.] → Mitigated by the existing `abortCurrentTyping()` machinery and the fact that 4xx rejections should be rare (server-validated content should not produce mutations the server then rejects). For 5xx and network errors we explicitly do *not* re-render — the inline error is enough.

[Mixed-scope trigger where one scope succeeds and the other fails leaves the user in a half-applied state.] → Acknowledged. The local mutation already committed server-side; only the global was rejected. The refresh-and-re-render flow will pull both scopes' authoritative state, so the user sees a consistent snapshot after the refresh. The architecture doc allows this — per-request atomicity is the guarantee, not cross-request atomicity.

[`apiPost` adds the first POST in the client; CORS preflight / `Content-Type: application/json` may be the first time a deployment hits CORS headers.] → Surfaced as a deployment note; the existing `apiGet` already exercises CORS for simple requests, but `Content-Type: application/json` makes the request non-simple and triggers a preflight. The server side must accept the preflight.

[Snapshot shallow-clone allocates on every variant evaluation.] → Accepted. A node entry runs at human speed (one per user action); the allocation cost is negligible compared to the typewriter render time.

[The Phase 3 input component will want to evaluate `input.branches` against a snapshot that includes the just-submitted value before any mutation lands.] → Phase 3 concern, not Phase 2. The `evaluate(condition, snapshot)` signature takes the snapshot as an argument precisely so the input component can pass `{ local: { ...store.local, [varName]: submittedValue }, global: store.global }` without disturbing the store.

[Mutation request fails silently if the engine forgets to await the dispatch promise.] → Mitigated by the dispatcher returning a single promise that resolves when both scope POSTs have settled. The calling code in `loadNode` and `showChoices` `await`s it (or chains `.then`/`.catch`) so unhandled rejections are surfaced.

## Migration Plan

The migration is invisible to existing content.

1. Land `src/state/store.js`, `src/state/conditions.js`, `src/engine/node-resolver.js`, and the `apiPost` addition to `src/api/client.js` — no call sites use them yet.
2. Land the wiring edits in `src/main.js#playTerminalData` (seed) and `src/screens/terminal.js` (`loadNode` calls the resolver, `showChoices` dispatches `choice.set`).
3. Verify existing `dati/*.json` holotapes (currently lacking `state`/`variants`/`on_enter`/`choice.set`) play identically — `resolveNode` falls through to the base node body, the dispatcher sees empty lists and issues no POST, the store is seeded to empty scopes.
4. Add a fixture holotape exercising local + global state, variants, `on_enter`, and `choice.set` (committed alongside the change or kept in a developer-only fixture path). Use it to validate end-to-end behavior against the live API. This holotape is the "done when" criterion from REWORK.md Phase 2.

**Rollback:** the additions are additive. If the resolver is buggy, the wiring edit in `loadNode` can revert to "load the node verbatim, render its top-level text/choices" in a one-line change, leaving the new modules dormant.

**Service-worker note:** no `sw.js` update is required in Phase 2. Mutation POSTs bypass the cache by virtue of being POSTs in the current SW.

## Open Questions

- **Refresh endpoint shape:** does the API expose a state-only `GET /terminals/:id/state` (or similar) that returns just `{ localState, globalState }`, or is `GET /terminals/:id/load` the only way? The spec is written to accept either — `store.refresh(...)` reads `localState` / `globalState` off whatever envelope the GET returns. If the API only offers `/load`, refresh pulls more data than it needs but that's a server-side optimization, not a client design problem. Resolve against the Swagger doc before implementation.
- **Error UI for non-refresh failures:** what does an inline `ERRORE STATO` look like on the terminal screen? Probably a one-line CRT-styled status message above the choices, dismissed on the next user action. Decide visual treatment at implementation time; not load-bearing on the contract.
- **Re-entry deduplication for on_enter:** the spec says re-entries dispatch every time. If a future change introduces "one-shot" on_enter mutations, that's an authoring concern (express it as a condition guarded on a state variable the mutation itself sets), not a client concern. Worth documenting in `guida terminale.md` when authoring docs are updated.
