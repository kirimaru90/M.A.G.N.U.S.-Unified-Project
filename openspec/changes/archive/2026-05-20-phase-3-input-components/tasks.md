## 1. Mutation dispatch reuse

- [x] 1.1 In `src/engine/node-resolver.js`, export the existing file-private `dispatch(mutations, terminalId, campaignId)` as `dispatchMutations(mutations, terminalId, campaignId)` (rename or re-export), keeping `dispatchOnEnter` and `dispatchChoiceSet` working unchanged.
- [x] 1.2 Verify `dispatchMutations` returns the same sentinels as the existing path (`null` on success/no-op, `RERENDER_REQUIRED` after a 4xx scope refresh, `INLINE_ERROR` on network/5xx) and that a successful 2xx already calls `applyScope` so `getSnapshot()` reflects the mutation.

## 2. Input component module

- [x] 2.1 Create `src/engine/components/input.js` exporting `mountInputComponent({ node, view, component, terminalId, campaignId, choicesEl, requestNavigate, requestRerender, requestInlineError, addBtnSounds, setKeyHandler })`.
- [x] 2.2 Render the field markup into `choicesEl`: an `<input type="text" class="input-field">` with the component's `placeholder`, followed by a `[ INVIA ]` submit button (`.choice-btn`).
- [x] 2.3 Wire submission on Enter in the field and on submit-button click. On empty value, ignore (no POST, no navigation, keep focus on the field).
- [x] 2.4 On non-empty submit: disable the field and remove the submit affordance from the focus list (single-flight guard), then dispatch `[{ op: 'set', key: component.target, value: rawValue }]` via `dispatchMutations(..., terminalId, campaignId)`. Send the raw string value (no trim, no coercion).
- [x] 2.5 On a `null` (success) sentinel: evaluate `component.branches` in declaration order against `getSnapshot()` using `evaluate(branch.condition, snapshot)`; pick the first matching branch, else the `default: true` branch; call `requestNavigate(target)`.
- [x] 2.6 On no-match-and-no-default: call `requestInlineError('logic')` (distinct `ERRORE LOGICA` message), re-enable the field, do not navigate.
- [x] 2.7 On `RERENDER_REQUIRED`: call `requestRerender()` (caller aborts typing and re-loads the current node, re-mounting an empty field).
- [x] 2.8 On `INLINE_ERROR`: call `requestInlineError('state')`, re-enable the field, preserve the typed value, keep focus so the user can retry.
- [x] 2.9 Set up the keyboard handler via `setKeyHandler` over the ordered focus list `[input, submit, ...systemButtons]`: ArrowDown/ArrowUp wrap focus, Enter in the field submits, Enter on a button activates it, Escape navigates back when history depth > 1 else disconnects. Do not apply the post-typing Enter cooldown to in-field submission. Focus the input field on mount.

## 3. Terminal screen wiring

- [x] 3.1 In `src/screens/terminal.js`, add `pickInputComponent(view)` returning the first `view.components` entry with `type === 'input'`, or `null`.
- [x] 3.2 Extract the back/disconnect tail of `showChoices` into a shared `appendSystemButtons(choicesEl)` helper used by both the choice and input-component paths.
- [x] 3.3 In `renderNode`, after the typewriter completes, branch: if `pickInputComponent(view)` is non-null, call `mountInputComponent({...})` (passing `currentTerminalId`, `currentCampaignId`, callbacks); otherwise call `showChoices(view.choices)` as today.
- [x] 3.4 Provide the callbacks to the component: `requestNavigate(target)` → `loadNode(target)`; `requestRerender()` → `abortCurrentTyping()` then `loadNode(currentNodeId)`; `requestInlineError(kind)` → render an inline `state-error` paragraph above the field (`ERRORE STATO` for `'state'`, `ERRORE LOGICA: ramo di destinazione non trovato.` for `'logic'`).
- [x] 3.5 Confirm the fictional-login early-return in `loadNode` still runs before component rendering (login gate precedes input components).

## 4. CRT styling

- [x] 4.1 In `src/styles/terminal.css`, add `#choices-container .input-field` mirroring `#login-screen input[type="password"]` (transparent background, green border, inherited font, green text-shadow) plus `width: 100%; box-sizing: border-box;`.
- [x] 4.2 Verify the `[ INVIA ]` submit button inherits the existing `.choice-btn` style with no extra CSS, and the field is visually consistent with the fictional-login input.

## 5. Fixture holotape

- [x] 5.1 Author a fixture node with an input component for the `58874645` code puzzle, declaring `state.local.entered_code` (type `string`, default `""`). Example snippet:
  ```json
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
- [x] 5.2 Add the `code-accepted` and `code-rejected` target nodes so the branch routing is observable end-to-end.

## 6. Manual verification

- [ ] 6.1 Open the fixture in a browser: confirm the input field renders after the prompt finishes typing, receives focus, and matches the CRT login-input styling.
- [ ] 6.2 Submit the correct code: confirm one `POST .../state/mutate` with `{ op: 'set', key: 'local.entered_code', value: '58874645' }`, the response `state` updates the store, and navigation lands on `code-accepted`.
- [ ] 6.3 Submit a wrong code: confirm the default branch routes to `code-rejected`.
- [ ] 6.4 Submit an empty value: confirm no POST, no navigation, focus retained.
- [ ] 6.5 Force a 4xx (e.g. an undeclared target via a temporary edit): confirm scope refresh + re-render of the current node with an empty field, no navigation.
- [ ] 6.6 Force a network/5xx error: confirm an inline `ERRORE STATO` message, the typed value preserved, no navigation.
- [ ] 6.7 Author a node whose branches have no match and no default; submit a value: confirm an inline `ERRORE LOGICA` message and no navigation.
- [ ] 6.8 Verify keyboard: ArrowDown/Up move across [field, INVIA, back/disconnect], Enter in the field submits, Escape goes back / disconnects per history depth.

## 7. Backward-compat verification

- [ ] 7.1 Confirm every existing holotape (no `components` declarations) renders and navigates identically, with no additional network traffic.
- [ ] 7.2 Confirm a node that declares both `choices` and an input component renders only the input field (choices suppressed).

## 8. Spec compliance and docs

- [x] 8.1 Run `openspec validate phase-3-input-components --strict` and resolve any errors.
- [x] 8.2 Update `openspec/REWORK.md` Phase 3 checklist boxes as each step lands.
- [x] 8.3 Update `guida terminale.md` to document the `components` array, the `input` component shape (`type`, `placeholder`, `target`, `branches`), the string-only value note, and that branch conditions use the same grammar as `variants`.
