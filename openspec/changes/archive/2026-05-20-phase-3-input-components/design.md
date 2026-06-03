## Context

Phase 2 left the Terminal client with:

- A node/choice engine in `src/screens/terminal.js` whose `loadNode(nodeId)` flow is: look up the node, resolve variants via `resolveNode(node, snapshot)`, render the resolved `{ text, choices }` view through `renderNode` (which calls `showChoices(choices)` once the typewriter settles), then fire-and-await `dispatchOnEnter`.
- A mutation surface in `src/engine/node-resolver.js` that splits a mutation list by scope, POSTs to `/terminals/:id/state/mutate` or `/campaigns/:id/state/mutate`, replaces the corresponding scope of the in-memory store from each successful response's `state` map, and signals `RERENDER_REQUIRED` (after a 4xx-driven scope refresh) or `INLINE_ERROR` (on network / 5xx).
- A pure condition evaluator (`src/state/conditions.js`) keyed `evaluate(condition, snapshot)`, reusable from anywhere.
- A CRT-styled input pattern established by `#login-screen input[type="password"]` and `#hidden-input` in `src/styles/terminal.css`: transparent background, green-phosphor border, inherited monospace font, green text-shadow.

Phase 3 adds a third interaction primitive at the node level: a typed-input component whose submitted value is **set into a declared state variable**, then routes to a target node via an ordered list of conditional `branches`. Architecturally the component is a thin renderer that reuses every piece of the Phase 2 plumbing — store, evaluator, mutation dispatch, response-driven scope replacement — and the only new shape on the wire is the `node.components[]` array in the holotape JSON.

The architecture doc (§8.4) names this primitive but does not pin down the rendering site, the rendering style, the keyboard behavior, the value typing, or the failure-mode UX. Those are the Phase 3 design questions. The current `super_duper_admin.json` puzzle (player must type `58874645`) is the canonical worked example: today it's expressed via fictional-login abuse; after Phase 3 it can be expressed as a node with one input component and two branches.

## Goals / Non-Goals

**Goals:**
- One renderer module (`src/engine/components/input.js`) that owns input-component rendering and submission, with the smallest possible surface area on the existing terminal screen (one branch in `renderNode`).
- Reuse the Phase 2 mutation dispatcher verbatim. The input component's submit handler builds a single-element mutation list `[{ op: 'set', key: target, value: rawString }]` and feeds it through the same code path `dispatchOnEnter` / `dispatchChoiceSet` use. No new POST endpoint, no new request shape.
- Reuse the Phase 2 condition evaluator verbatim. Branch conditions use the same `{ var, op, value }` / `and` / `or` / `not` grammar as `variants`. The branch evaluator is the same `evaluate(condition, snapshot)` function.
- Locking-in normative behaviors so Phase 4+ don't relitigate them:
  - **Render-then-mutate**: when a node has an input component, the input field renders immediately after the node's text finishes typing. The Phase 2 `on_enter` dispatch still fires; the field becomes interactive without waiting on the `on_enter` round-trip. (Symmetric with the Phase 2 "variants → render → on_enter" ordering.)
  - **Submit-then-branch**: on submission, the engine awaits the mutation POST's 2xx response (so the store reflects the new value via `applyScope`), THEN evaluates `branches` against the refreshed snapshot, THEN navigates. Branch evaluation never runs on a pre-submission snapshot.
  - **Per-node singleton**: at most one input component per node. Phase 3 doesn't open the door to multi-component nodes; that's a future expansion.
  - **String values only**: Phase 3 submits the raw `<input>` value as a string. Numeric / boolean / enum targets are out of scope for Phase 3 client-side; the server is still the authority on type validation.
- Make the failure surface predictable: 4xx → scope refresh + re-render the current node (input field reappears, empty, against fresh state); 5xx / network → inline non-blocking error, field stays mounted with the value preserved so the user can retry; malformed branches (no match, no default) → inline error, field stays mounted (the holotape is buggy, not the network).
- Keyboard behavior consistent with the rest of the engine: focus lands on the field, Enter submits, ArrowUp/ArrowDown wraps focus across [field, submit, back, disconnect], Escape behaves as in the choice list (back if history > 1, else disconnect).
- Zero behavior change for nodes that don't declare `components`. Existing holotapes are unaffected by construction.

**Non-Goals:**
- No new component types. `type: "input"` is the only one Phase 3 handles. The renderer module is named `components/input.js` (not `components/index.js`) precisely because there's no dispatch layer to build yet.
- No multi-component nodes. A node has at most one `input` entry in `components`. If a node declares both `components` and `choices`, the choices are ignored when the input component is rendered; this isn't because it's broken to mix them, but because Phase 3 has no UX for "input + choice list side by side" and the spec is explicit so authors don't accidentally lean on undefined behavior.
- No numeric / typed input. `inputType: "number"` is a deliberate later expansion; Phase 3 ships a single string field. The server rejects type mismatches with a 400 and the existing 4xx flow handles it.
- No password-masked input. The component is `<input type="text">` only. Phase 5's server-side fictional login is the right home for masked credential entry, not a generic input component.
- No client-side validation (length, regex, allow-list) beyond non-empty. The server validates against the declared schema (`enum` value set, `string` length if the schema grows one) and 4xx-rejects on mismatch.
- No new mutation operator. The submit always emits `{ op: 'set', ... }`. `increment` / `toggle` are not authorable from an input field in Phase 3.
- No changes to the typewriter, sounds, fictional-login, campaign-select, terminal-list, or back-history.
- No new dependency, no build step, no framework, no TypeScript. Vanilla ES modules only.

## Decisions

### D1. The input component lives in its own module under `src/engine/components/`

`src/engine/components/input.js` exports `mountInputComponent({ node, view, component, terminalId, campaignId, choicesEl, requestNavigate, requestRerender, requestInlineError, addBtnSounds, setKeyHandler })`. The mount function renders the field + submit button into `choicesEl`, wires Enter/click submission, and returns a small teardown function for the caller to invoke before navigating away.

Putting it under `src/engine/components/` (not under `src/screens/`) reflects the architecture: components are engine-level primitives shared by any future screen that renders a node graph, not screen-specific UI. The Phase 2 `node-resolver.js` already lives in `src/engine/`; the input component is conceptually adjacent — both are engine modules that the terminal screen calls into.

The `mountInputComponent` signature takes callbacks (`requestNavigate`, `requestRerender`, `requestInlineError`) rather than importing from `src/screens/terminal.js`. This keeps the dependency direction one-way (screens depend on engine, never the reverse) and matches how the Phase 2 resolver was integrated.

**Alternatives considered:**
- *Inline the input renderer in `src/screens/terminal.js`* — rejected. Adds ~100 lines to a file that's already the largest screen module, and couples the component logic to one specific screen. A future "preview a node" tool in the backoffice (mentioned as a nice-to-have in ARCHITECTURE.md §11) would want to reuse the same renderer.
- *Put a component-dispatch layer at `src/engine/components/index.js` from day one* — deferred. Phase 3 has exactly one component type; a dispatch layer for one entry is overhead. When a second component lands (a year from now? never?), the dispatch layer is one file's worth of work.

### D2. Submit semantics: render → submit → POST → on 2xx, evaluate branches → navigate

The submit handler runs:

1. Read the raw input value (`<input>.value`, no trim).
2. If empty, ignore the submission (don't POST, don't navigate). The field keeps focus.
3. Build a mutation `{ op: 'set', key: component.target, value: rawValue }`.
4. Dispatch via the same scope-routing path the Phase 2 dispatcher uses. Concretely, the input module calls a small helper that wraps the existing `apiPost` + `applyScope` flow — or, equivalently, exposes a `dispatchMutations(mutations, terminalId, campaignId)` from `node-resolver.js` and reuses it. (D6 below picks one.)
5. On 2xx response: the store's corresponding scope has already been replaced by `applyScope` (so `getSnapshot()` returns the post-mutation snapshot). Walk `component.branches` in declaration order:
   - For each entry with a `condition`: call `evaluate(condition, snapshot)`. If true, this is the target.
   - Otherwise, look for the entry with `default: true`. That's the fallback target.
   - If no condition matched and no default: this is a malformed branch list (authoring bug). Surface an inline error, keep the field mounted, **do not navigate**.
6. Call `requestNavigate(targetNodeId)` → `terminal.loadNode(targetId)` runs the normal entry flow (push history, dispatch `on_enter` for the target node, render).
7. On 4xx: `dispatchMutations` already triggered the scope refresh (Phase 2 contract). It returns `RERENDER_REQUIRED`. The input module calls `requestRerender()` which aborts current typing and re-calls `loadNode(currentNodeId)` — the input component is re-mounted empty against the refreshed snapshot.
8. On 5xx / network: `dispatchMutations` returns `INLINE_ERROR`. The input module calls `requestInlineError()` which renders the same `state-error` paragraph the choice flow uses, above the field. The field keeps its value so the user can retry by pressing Enter again.

The render-then-mutate-then-branch ordering parallels Phase 2's "variants → render → on_enter dispatch": render is never blocked on a mutation round-trip *except* for the input submission itself, where the user has explicitly asked "do the next thing based on what I typed." Awaiting the POST is essential there — branch evaluation against a stale snapshot would be a correctness bug, not a UX trade-off.

**Alternatives considered:**
- *Optimistically apply the value to the local store before the POST returns* — rejected. Phase 2 explicitly defers optimistic mutations to a future change. Phase 3 inherits that decision.
- *Evaluate branches against the pre-submission snapshot, with the just-submitted value spliced in by the evaluator* — rejected. Workable, but it forks the evaluator's "I take a snapshot" contract (Phase 2 D3) by introducing a special-case caller. Cleaner to await the POST and read `getSnapshot()` normally.
- *Don't await the POST — branch immediately on the typed value, mutate in the background* — rejected. The branch evaluator reads the store, not the typed value. Splicing the value back into the snapshot for one call leaks the input component's concerns into the resolver.

### D3. Branch evaluator reuses `evaluate(condition, snapshot)` verbatim

A branch is one of:

- `{ condition: <Condition>, target: "nodeId" }` — render-time evaluated; matches when `evaluate(condition, getSnapshot())` returns `true`.
- `{ default: true, target: "nodeId" }` — matches if no preceding branch matched.

The grammar of `<Condition>` is identical to Phase 2's `variants[].condition` and the API's import-time validator. The input component does not introduce a new evaluator, a new operator, or a new shape — branches *are* conditions, just consumed in a different place.

Authoring example for the `58874645` puzzle:

```
{
  "id": "code-entry",
  "text": "DIGITARE IL CODICE DI ACCESSO:",
  "components": [
    {
      "type": "input",
      "placeholder": "CODICE",
      "target": "local.entered_code",
      "branches": [
        { "condition": { "var": "local.entered_code", "op": "eq", "value": "58874645" }, "target": "code-accepted" },
        { "default": true, "target": "code-rejected" }
      ]
    }
  ]
}
```

The first branch's condition tests the variable the input just wrote to — the most common pattern. But the grammar doesn't constrain branches to test only the target variable. An author could legitimately route on `{ and: [{ var: 'local.entered_code', op: 'eq', value: 'admin' }, { var: 'global.karma', op: 'gt', value: 5 }] }`. That works because branch evaluation reads `getSnapshot()`, which includes both scopes after the response-driven `applyScope`.

**Alternatives considered:**
- *Introduce a `value` predicate that implicitly references the submitted value* (e.g. `{ condition: { eq: "58874645" }, target: ... }`) — rejected. Two condition grammars in the codebase is a maintenance burden, and it hides what's actually being tested. The "explicitly test the variable you just wrote to" form is verbose but auditable.
- *Allow per-branch mutations (`branch.set: [...]`)* — rejected for Phase 3. Out of scope. If an author wants extra mutations on a branch, they belong on the target node's `on_enter`.

### D4. Render site: the input component replaces the choices in `choicesEl`

The current `renderNode(nodeId, view)` calls `showChoices(view.choices)` after the typewriter finishes. Phase 3 introduces a branch:

```
typeWriterHTML(htmlContent, contentEl, () => {
  typingSound.stop();
  const inputComponent = pickInputComponent(view);
  if (inputComponent) {
    mountInputComponent({ ..., component: inputComponent, ... });
  } else {
    showChoices(view.choices);
  }
}, speed);
```

`pickInputComponent(view)` returns the first `components[]` entry with `type === 'input'`, or `null`. (Phase 3 only knows one component type; the function is a single `.find`.)

The mounted component renders into the same `choicesEl` container `showChoices` uses, so the layout, focus management, and system-button placement (back, disconnect) stay identical. The system buttons are rendered by a small helper extracted from the bottom of `showChoices` — `appendSystemButtons(choicesEl)` — so both the choice and component renderers append them after their own content.

**Alternatives considered:**
- *Make the input component render alongside the choices (above them)* — rejected. Phase 3 spec says input replaces choices. Mixing them gives authors a UX with two competing interaction surfaces in the same node; defer until there's a real need.
- *Render the input component above the typewriter content* — rejected. Breaks the existing "text types out, then interactive surface appears" cadence the typewriter cadence depends on. Keeping the input rendered after the typewriter settles means the user can't submit before the prompt has finished printing — same anti-spoiler logic that already gates the choice buttons via `getLastTypingEndAt`.

### D5. CRT styling reuses the existing input visual rules via a new selector

A new CSS rule in `src/styles/terminal.css`:

```
#choices-container .input-field {
  background: transparent; color: var(--terminal-green);
  border: 1px solid var(--terminal-green); font-family: inherit;
  font-size: 1rem; padding: 0.4rem; margin: 0.3rem 0;
  text-shadow: 0 0 5px var(--terminal-green); display: block;
  width: 100%; box-sizing: border-box;
}
```

The class name `input-field` (not `crt-input` or `terminal-input`) matches the existing naming style (`choice-btn`, `system-separator`, `state-error`). The rules mirror `#login-screen input[type="password"]` exactly, plus `width: 100%` since the input lives inside the choices container (which is full-width) rather than the centered login screen.

The submit button is a standard `.choice-btn` and inherits the existing button style. No new class needed.

**Alternatives considered:**
- *Refactor `#login-screen input[type="password"]`, `#hidden-input`, and the new `.input-field` into a shared CSS custom property + reusable class* — rejected for Phase 3. Worth doing as a CSS cleanup but it's a refactor that should land in its own change, not bundled into a feature phase. The duplication is three rule blocks; the cost of leaving it is low.
- *Use the same `#login-screen` selector for the new field* — rejected. The input field renders inside `#terminal-container`, not the login overlay. Reusing the selector would require changes to the DOM structure or extra specificity hacks.

### D6. The mutation dispatch path is shared with Phase 2 by exposing a small helper

Phase 2's `dispatch(mutations, terminalId, campaignId)` in `src/engine/node-resolver.js` is currently file-private (called by `dispatchOnEnter` and `dispatchChoiceSet`). Phase 3 needs the same path for a different trigger (user-typed submission). The cleanest move is to expose a `dispatchMutations(mutations, terminalId, campaignId)` from `node-resolver.js` and have the input component call it directly.

This is a non-breaking extension to the resolver module: `dispatchOnEnter` and `dispatchChoiceSet` continue to work as-is; `dispatchMutations` is a new export with the same semantics and the same sentinel return values (`null` / `RERENDER_REQUIRED` / `INLINE_ERROR`).

Alternative routing — e.g. the input component constructing a fake `node.on_enter` and calling `dispatchOnEnter` — would work but reads oddly at the call site. A dedicated export makes the trigger explicit in the code.

**Alternatives considered:**
- *Duplicate the dispatch logic inside the input component* — rejected. Defeats the Phase 2 invariant that all state-mutating POSTs go through one chokepoint.
- *Move the dispatcher to a new module (`src/engine/state-dispatcher.js`) so the resolver and the component both import it* — rejected. The resolver IS the dispatcher today; relocating it for tidiness alone is churn that the change doesn't need. Reconsider when a third caller appears.

### D7. Failure handling: empty submission ignored, 4xx re-renders, 5xx/network inline error, malformed branch list inline error

| Trigger                            | Engine behavior                                                                |
|------------------------------------|--------------------------------------------------------------------------------|
| Submit with empty value            | Ignore. Field keeps focus, no POST, no navigation.                             |
| POST 2xx + matching branch         | `applyScope` already ran; navigate to the branch target via `loadNode`.        |
| POST 2xx + no match + default      | Navigate to the default target.                                                 |
| POST 2xx + no match + no default   | Inline error (`ERRORE LOGICA`), field stays, no navigation.                     |
| POST 4xx                           | Phase 2 refresh ran; re-call `loadNode(currentNodeId)`; field re-mounts empty.  |
| POST 5xx                           | Inline error (`ERRORE STATO`), field stays with value, user can retry.          |
| POST network failure               | Inline error (`ERRORE STATO`), field stays with value, user can retry.          |

The "no match + no default" case is the only new failure path Phase 3 introduces that doesn't already exist in Phase 2. It's an authoring bug (the holotape import validator should catch it; if it doesn't, the runtime surfaces it instead of branching to `undefined`). The inline error message is distinct from the network/state one because the cause is different.

**Alternatives considered:**
- *Treat "no match + no default" as a silent no-op (stay on the current node, no error)* — rejected. Silent failures violate the project's "no silent failures" cross-cutting constraint (ARCHITECTURE.md §10). An author who forgot to add a default deserves a loud signal.
- *Auto-navigate back to the current node on every submission failure regardless of cause* — rejected. The 4xx flow already does a refresh + re-render; the 5xx flow deliberately keeps the user's typed value visible so they can retry without retyping.

### D8. Keyboard model: field-focus on render, Enter to submit, ArrowUp/Down wraps across [field, submit, system-buttons]

The mounted layout in `choicesEl`:

```
<input class="input-field" placeholder="..." type="text">
<button class="choice-btn">[ INVIA ]</button>
... (back if history > 1)
... (disconnect if history === 1)
```

The focus list passed to `setKeyHandler` is `[input, submit, ...systemButtons]`. ArrowDown moves down with wraparound; ArrowUp moves up. Enter on the input submits. Enter on a button activates that button (existing behavior). Escape behaves as in `showChoices`: back if `getHistoryLength() > 1`, else disconnect.

The "post-typing Enter cooldown" guard (`ENGINE_CONFIG.postTypingEnterCooldownMs`) applies to button activations only — the input field is allowed to submit immediately on Enter, because the user has to type a value first (the cooldown's purpose, preventing accidental advancement during typewriter playback, doesn't apply to a deliberate textual submission).

**Alternatives considered:**
- *Auto-submit on Enter inside the input field, no submit button at all* — rejected. The submit button is necessary for mobile / touch input (no keyboard Enter on a soft keyboard's Done key reliably across PWA installs).
- *Apply the post-typing Enter cooldown to the input field* — rejected. The user typed deliberately; gating submission on cooldown adds latency without a benefit.

### D9. Authoring shape and validation expectations

The holotape JSON shape for a node with an input component:

```
{
  "id": "code-entry",
  "text": "DIGITARE IL CODICE:",
  "components": [
    {
      "type": "input",
      "placeholder": "CODICE",
      "target": "local.entered_code",
      "branches": [
        { "condition": { ... }, "target": "code-ok" },
        { "default": true, "target": "code-bad" }
      ]
    }
  ]
}
```

Server-side validation (out of scope for the client but documented here as the contract the client relies on):

- `components[]` is optional; missing means no components.
- At most one entry with `type: "input"` per node.
- `target` MUST match a declared state variable (scope prefix + declared name).
- Each branch MUST be either `{ condition, target }` or `{ default: true, target }`.
- Each `target` MUST point to a node id that exists in the holotape.
- The condition grammar is the same as `variants[].condition`.

The client doesn't replicate these checks at runtime; it trusts the server. The "no match + no default" runtime guard (D7) is the only client-side authoring-bug surface.

**Alternatives considered:**
- *Require an explicit `default` branch as the last entry, syntactically* — rejected. The grammar allows `default: true` anywhere in the list (later entries after a default are unreachable but not malformed); enforcing position is a server-side concern.
- *Allow inline `value` shorthand for the most common case (`{ value: "58874645", target: "..." }`)* — rejected. Two grammars for the same thing. Stick with `condition: { var, op, value }` even when verbose.

### D10. Empty-submission handling: no POST, no navigation, focus stays

Pressing Enter on an empty input field does nothing. The field keeps focus, no mutation is dispatched, no navigation runs. The submit button click on an empty field behaves identically.

This is the minimum viable "don't ship a noisy bug" guard — submitting `value: ""` would POST a string set, the server would either accept it (writing empty string to the variable) or 4xx-reject it depending on the declared type, and the branch evaluator would resolve against a potentially surprising snapshot. Keeping empty submissions inert avoids all of that.

It's deliberately the *only* client-side validation. Beyond non-empty, the server is the schema authority.

**Alternatives considered:**
- *Allow empty submissions and let the server decide* — rejected. The server would 4xx for enum targets (empty is not a member), 2xx for string targets, and the branch evaluation would silently route on `""` — surprising and not what the author meant.
- *Show an inline "campo obbligatorio" error on empty submission* — rejected for Phase 3. The placeholder text is doing the job; an error message for "user did nothing" is noise.

## Risks / Trade-offs

[Numeric / boolean / enum input targets are blocked on server validation, with no client-side affordance for typing.] → Accepted. Authors who want a numeric input express it as a string target backed by a server-side parse, or wait for a future `inputType: "number"` extension. The 4xx flow handles server rejections; the user sees `ERRORE STATO` on a type mismatch, which is correct but not friendly. Documenting this in `guida terminale.md` so authors don't try and get confused.

[The user types a value, the POST 4xx-rejects, the scope refresh runs, the node re-renders, the input field reappears empty. The user has to retype.] → Accepted. 4xx is a server-validated rejection — by definition, the typed value would not have been accepted. Preserving it in the re-rendered field would be misleading (the user might think the same value will work this time). The 5xx / network path preserves the value precisely because the value is unrelated to the failure cause.

[Mixed-content nodes (text + choices + input) are forbidden by spec, which is a UX restriction.] → Accepted. The cost of supporting it (a layout with two interactive surfaces, focus management across both, keyboard ambiguity) is not justified by Phase 3's use case. If a real authoring need surfaces, it lands as its own change.

[The submit button's `[ INVIA ]` label is Italian-only.] → Aligns with the project's Italian-only constraint (no localization layer in scope). A non-issue for Phase 3.

[The branch evaluator reads `getSnapshot()` after the POST resolves; if the user submits rapidly and a network reordering delivered an earlier POST's response after a later one's, the branch evaluation could see the wrong scope.] → Not possible. The input component disables the submit affordance during the in-flight POST (the same way `showChoices` removes buttons during render), so the user can't submit a second value until the first resolves. Concretely: on submit, the field is set to `disabled = true` and the submit button is removed from the focus list until the dispatch promise settles.

[`ERRORE LOGICA` (no branch matched, no default) is a new error string with no precedent in the existing engine.] → Accepted. It's a distinct cause from `ERRORE STATO` (network / state desync) and `ERRORE DI RETE` (legacy). Keeping the message specific helps authors debug. The CSS class can be the same `state-error` so the visual treatment is consistent.

[Phase 3's `dispatchMutations` export from `node-resolver.js` widens the resolver's public surface.] → Accepted. The function already exists internally; exporting it is a label change. A future move to a dedicated `src/engine/state-dispatcher.js` is fine but not required for Phase 3.

[`super_duper_admin.json`'s puzzle continues to work via fictional-login after Phase 3 ships — the new component is not retrofitted into existing content.] → Intentional. Phase 3 introduces the capability; authors migrate when they want to. Phase 5 (server-side fictional login) will revisit how login-as-puzzle interacts with input-as-puzzle, but Phase 3 doesn't have to.

## Migration Plan

The migration is invisible to existing content.

1. Land `src/engine/components/input.js`. No call sites use it yet.
2. Export `dispatchMutations` from `src/engine/node-resolver.js`. No call sites use the new export yet.
3. Add the `.input-field` CSS rule to `src/styles/terminal.css`. No DOM uses the class yet.
4. Wire the renderer branch in `src/screens/terminal.js#renderNode`: pick the input component out of `view.components` if present, mount it; otherwise fall through to `showChoices` as today. Extract `appendSystemButtons(choicesEl)` so both paths share the back/disconnect logic.
5. Verify every existing holotape served by the API plays identically — no node currently declares `components`, so the `pickInputComponent` call returns `null` and the existing path runs untouched.
6. Author a fixture holotape (replacing or shadowing the `58874645` puzzle in `super_duper_admin.json`, or living in a developer-only fixture path) that declares an input component with at least two branches (matching + default). Walk through it in the browser, verify the mutation POST + branch evaluation + navigation flow end-to-end against the dev API.

**Rollback:** the additions are additive. If the input component module is buggy, the renderer branch in `renderNode` can be reverted to "always call `showChoices`" in a one-line change, leaving the new module dormant. Existing content is unaffected.

**Service-worker note:** no `sw.js` update is required. The mutation POST is the same shape Phase 2 introduced; the SW already passes non-GET requests through.

## Open Questions

- **Submit button label**: `[ INVIA ]` is the obvious choice for Italian and matches the bracket convention used by `[ Torna al menu ]` / `[ disconnetti terminale ]`. Confirm at implementation time; not load-bearing on the contract.
- **`ERRORE LOGICA` exact wording**: probably `ERRORE LOGICA: ramo di destinazione non trovato.` or similar. Decide at implementation; the spec only requires "an inline non-blocking error message distinct from the state-error message."
- **Mobile soft-keyboard "Done" / "Go" key behavior**: should the input component register a `submit` event listener (form-wrapped) so the soft keyboard's submit key works the same as Enter? Probably yes. Confirm at implementation time on a real iOS / Android device.
- **Whether the holotape `components[]` shape is validated by the existing `openspec/specs.md` content schema today**: probably not — Phase 2's schema covered nodes/variants/choices but not components. If the schema doc has a `components` section, align with it; if not, the new spec is the authority.
