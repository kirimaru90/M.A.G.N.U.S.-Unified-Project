# emulator-input-components Specification

## Purpose

Node input components replacing choices, rendered focused after typing, submitting a raw-string set mutation, evaluating post-mutation branches to navigate, with single-flight, error recovery, and stateless-holotape inertness.

## Requirements

### Requirement: Input component declaration shape
A node MAY declare a `components` array in the holotape JSON, either at the top level or within a variant entry. An input component is an entry of that array with `type: "input"`. The entry SHALL declare:

- `type: "input"` — the component discriminator.
- `placeholder: <string>` — placeholder text rendered inside the empty field (Italian).
- `set: "<scope>.<name>"` — the scope-qualified state variable the submitted value is written into. The scope prefix SHALL be `local.` or `global.`.
- `branches: [<branch>, …]` — an ordered, non-empty list of branches. Each `<branch>` SHALL be either `{ "when": <Condition>, "target": "<nodeId>" }` or `{ "default": true, "target": "<nodeId>" }`, where `<Condition>` uses the same structured grammar as node `variants` (`and` / `or` / `not` / leaf `{ var, op, value }` with operators `eq` / `neq` / `gt` / `gte` / `lt` / `lte` / `in`).

A node SHALL declare at most one `components` entry with `type: "input"` across all resolved fields (node-level and variant-level combined).

The resolved `components` for a node SHALL be determined by the variant-override model: if the selected variant (or default variant) declares a `components` field, that array is used; otherwise the node's top-level `components` array is used.

#### Scenario: Node declares an input component at the top level
- **WHEN** a node's load payload contains `components: [{ type: 'input', placeholder: 'CODICE', set: 'local.entered_code', branches: [...] }]` and no matching variant overrides `components`
- **THEN** the engine SHALL render an input field for that node instead of a choice list

#### Scenario: Variant declares its own input component
- **WHEN** a node has `components: []` at the top level and the matched variant declares `components: [{ type: 'input', ... }]`
- **THEN** the engine SHALL render the input field from the variant's `components` array

#### Scenario: Node without components renders choices as before
- **WHEN** the resolved `components` array (after variant override) is empty or absent
- **THEN** the engine SHALL render the node's choices exactly as it does for a node with no input component
- **THEN** no input field SHALL be rendered

### Requirement: Input component replaces the choice list
When a node declares an input component, the engine SHALL render the input field in place of the node's `choices`. If the node also declares `choices`, those choices SHALL NOT be rendered while the input component is present. The system-level affordances ("back" when history depth > 1, "disconnect terminal" when history depth == 1) SHALL render below the input field exactly as they render below a choice list.

#### Scenario: Choices are suppressed when an input component is present
- **WHEN** a node declares both a `choices` list and a `components` entry with `type: 'input'`
- **THEN** the engine SHALL render the input field
- **THEN** the engine SHALL NOT render any choice buttons from the node's `choices`

#### Scenario: System buttons render below the input field
- **WHEN** an input component is rendered and the back-history depth is greater than 1
- **THEN** a "back" button SHALL render below the input field and its submit affordance

### Requirement: Input field is rendered after the node text finishes typing
The input field SHALL be rendered only after the node's text has finished its typewriter animation, mirroring the timing by which choice buttons currently appear. The field SHALL receive focus when it is rendered.

#### Scenario: Field appears after typewriter completes
- **WHEN** a node with an input component is entered
- **THEN** the engine SHALL run the typewriter animation for the node text
- **THEN** the engine SHALL render the input field only after the typewriter animation completes
- **THEN** the input field SHALL receive focus

### Requirement: CRT-styled input field consistent with the fictional-login input
The rendered input field SHALL be a single-line text input styled to match the existing fictional-login and hidden-tape inputs: transparent background, green-phosphor border, inherited monospace font, and green text-shadow. The submit affordance SHALL be rendered as a standard choice button (`.choice-btn`) so it participates in the existing keyboard navigation.

#### Scenario: Field uses the CRT input style
- **WHEN** an input component is rendered
- **THEN** the input field SHALL carry the CRT input styling (transparent background, green border, green text-shadow, inherited font)
- **THEN** the submit affordance SHALL be a `.choice-btn`

### Requirement: Submission writes the value to the target variable via a state mutation
On submission (Enter in the field or activation of the submit affordance) with a non-empty value, the engine SHALL dispatch a single mutation `{ op: 'set', key: <component.set>, value: <rawValue> }` through the same mutation path used by `on_enter` and `choice.set` (scope-routed to `POST /terminals/:id/state/mutate` for `local.*` targets or `POST /campaigns/:id/state/mutate` for `global.*` targets). The submitted value SHALL be sent as the raw field string; the engine SHALL NOT parse or coerce it. On a 2xx response the engine SHALL replace the corresponding scope of the in-memory store from the response's `state` map (per the Phase 2 mutation-response contract).

#### Scenario: Submission posts a set mutation to the correct endpoint
- **WHEN** the user submits the value `58874645` into a component whose `set` is `local.entered_code` on terminal `T1`
- **THEN** the engine SHALL issue `POST /terminals/T1/state/mutate` with body `{ "mutations": [{ "op": "set", "key": "local.entered_code", "value": "58874645" }] }`

#### Scenario: Global-scope target posts to the campaign endpoint
- **WHEN** the user submits a value into a component whose `set` is `global.codename` in campaign `C1`
- **THEN** the engine SHALL issue `POST /campaigns/C1/state/mutate` with the corresponding `set` mutation

#### Scenario: Value is sent as a raw string
- **WHEN** the user types `007` into the field and submits
- **THEN** the mutation `value` SHALL be the string `"007"` (no numeric coercion, no trimming)

### Requirement: Empty submissions are inert
When the user submits an empty input value, the engine SHALL NOT dispatch any mutation, SHALL NOT navigate, and SHALL keep focus on the input field.

#### Scenario: Empty submission does nothing
- **WHEN** the input field is empty and the user presses Enter (or activates the submit affordance)
- **THEN** the engine SHALL NOT issue any `POST` request
- **THEN** the engine SHALL NOT navigate away from the current node
- **THEN** the input field SHALL retain focus

### Requirement: Branches are evaluated against the post-mutation snapshot
After a successful (2xx) submission, the engine SHALL evaluate the component's `branches` in declaration order against the snapshot that reflects the just-applied mutation. The first branch whose `when` evaluates `true` SHALL determine the target node. A branch with `default: true` SHALL act as the fallback when no preceding conditional branch matches. The engine SHALL NOT evaluate branches before the mutation response has been applied to the store.

#### Scenario: First matching branch wins
- **WHEN** the post-mutation snapshot satisfies the condition of the first branch
- **THEN** the engine SHALL navigate to that branch's `target`
- **THEN** the engine SHALL NOT evaluate any later branch

#### Scenario: Default branch is the fallback
- **WHEN** no conditional branch's condition evaluates true and a branch with `default: true` exists
- **THEN** the engine SHALL navigate to the default branch's `target`

#### Scenario: Branch evaluation observes the submitted value
- **WHEN** the user submits `58874645` into a `local.entered_code` target whose first branch is `{ when: { var: 'local.entered_code', op: 'eq', value: '58874645' }, target: 'code-ok' }`
- **THEN** after the mutation response is applied, the condition SHALL evaluate true against the updated snapshot
- **THEN** the engine SHALL navigate to `code-ok`

### Requirement: Navigation runs the normal node-entry flow
When a branch determines a target node, the engine SHALL navigate to it through the standard node-entry path (`loadNode`), so the target node's back-history push, `on_enter` mutation dispatch, variant resolution, and rendering all run exactly as for a choice-driven navigation.

#### Scenario: Target node's on_enter runs after input-driven navigation
- **WHEN** an input submission routes to a target node that declares `on_enter` mutations
- **THEN** the engine SHALL dispatch the target node's `on_enter` mutations after entering it
- **THEN** the target node SHALL be pushed onto the back-history

### Requirement: Submission is single-flight
While a submission's mutation POST is in flight, the engine SHALL prevent a second submission: the input field SHALL be disabled and the submit affordance SHALL not trigger another dispatch until the in-flight POST settles.

#### Scenario: Second submission blocked during in-flight POST
- **WHEN** the user submits a value and, before the POST resolves, attempts to submit again
- **THEN** the engine SHALL NOT issue a second `POST` for the second attempt while the first is in flight

### Requirement: Server rejection refreshes the failing scope and re-renders the node
On a submission mutation rejected with `kind: 'http'` and a 4xx status, the engine SHALL refresh the failing scope (`GET /terminals/:id/state` for `local.*`, `GET /campaigns/:id/state` for `global.*`) and re-render the current node against the refreshed snapshot, re-mounting the input field empty. The engine SHALL NOT navigate. The engine SHALL NOT retry the rejected mutation.

#### Scenario: 4xx rejection re-renders the input node
- **WHEN** an input submission's `POST` rejects with `kind: 'http'` and `status === 400`
- **THEN** the engine SHALL refresh the failing scope
- **THEN** the engine SHALL re-render the current node with an empty input field
- **THEN** the engine SHALL NOT navigate to any branch target

### Requirement: Network and server errors surface inline without losing the typed value
On a submission mutation rejected with `kind: 'network'` or `kind: 'http'` with a 5xx status, the engine SHALL surface an inline non-blocking error message and SHALL keep the input field mounted with the typed value preserved so the user can retry. The engine SHALL NOT refresh the store and SHALL NOT navigate.

#### Scenario: Network error preserves the typed value
- **WHEN** an input submission's `POST` rejects with `kind: 'network'`
- **THEN** the engine SHALL render an inline error message above the input field
- **THEN** the input field SHALL remain mounted with its typed value intact
- **THEN** the engine SHALL NOT navigate

#### Scenario: 5xx error preserves the typed value
- **WHEN** an input submission's `POST` rejects with `kind: 'http'` and `status === 503`
- **THEN** the engine SHALL render an inline error message and SHALL NOT refresh the store

### Requirement: Unresolvable branch list surfaces an inline error
When a submission succeeds (2xx) but no conditional branch matches and no `default: true` branch exists, the engine SHALL surface an inline non-blocking error distinct from the network/state error, SHALL keep the input field mounted, and SHALL NOT navigate to an undefined target.

#### Scenario: No match and no default does not navigate
- **WHEN** a submission succeeds but no branch condition matches and there is no default branch
- **THEN** the engine SHALL render an inline error indicating no destination branch was found
- **THEN** the engine SHALL NOT navigate
- **THEN** the input field SHALL remain mounted

### Requirement: Keyboard interaction matches the choice-list model
The input component's keyboard model SHALL be consistent with the existing choice-list navigation: focus starts on the input field; pressing Enter in the field submits; ArrowDown / ArrowUp move focus across the ordered list `[field, submit, …system buttons]` with wraparound; Escape navigates back when the back-history depth is greater than 1, otherwise disconnects the terminal. The post-typing Enter cooldown SHALL NOT gate submission from within the input field.

#### Scenario: Enter in the field submits
- **WHEN** the input field has focus and the user presses Enter with a non-empty value
- **THEN** the engine SHALL submit the value

#### Scenario: Arrow keys move focus across field and buttons
- **WHEN** the input field has focus and the user presses ArrowDown
- **THEN** focus SHALL move to the submit affordance

#### Scenario: Escape navigates back when history allows
- **WHEN** an input component is rendered, the back-history depth is greater than 1, and the user presses Escape
- **THEN** the engine SHALL navigate back to the previous node

### Requirement: Input components are absent from stateless holotapes
A holotape with no input-component nodes SHALL play identically to its pre-Phase-3 behavior. The presence of input-component support SHALL NOT alter the rendering, navigation, or network traffic of any node that does not declare a `components` entry with `type: "input"`.

#### Scenario: Existing holotape unaffected
- **WHEN** an existing holotape with no `components` declarations is played
- **THEN** every node SHALL render and navigate exactly as it did before Phase 3
- **THEN** no additional network traffic SHALL be issued on account of input-component support

### Requirement: A failed submission never leaves the field permanently disabled
The input component SHALL guarantee that no submission failure leaves the input field permanently disabled. While a submission's mutation POST is in flight the field is disabled (single-flight). On ANY non-navigating outcome — a 4xx re-render, a network/5xx inline error, an unresolvable-branch logic error, or any thrown exception from the dispatch path (including an invalid mutation key) — the engine SHALL re-enable the field, clear the in-flight guard, restore the keyboard focus list, and surface an inline error (except where the existing spec mandates a re-render or navigation instead). The engine SHALL NOT depend on the mutation key being valid for the field to recover.

#### Scenario: Thrown dispatch exception re-enables the field
- **WHEN** the mutation dispatch throws an exception (for example, an invalid mutation key) during a submission
- **THEN** the engine SHALL re-enable the input field
- **THEN** the engine SHALL clear the in-flight guard so the user can submit again
- **THEN** the engine SHALL surface an inline error
- **THEN** the input field SHALL NOT remain permanently disabled

#### Scenario: Field recovers regardless of failure path
- **WHEN** a submission fails by any path that is not a successful navigation or a mandated re-render
- **THEN** the input field SHALL end in an enabled, focusable state with an inline error shown
