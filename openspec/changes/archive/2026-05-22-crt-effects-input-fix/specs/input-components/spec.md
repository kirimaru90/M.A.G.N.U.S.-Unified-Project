## MODIFIED Requirements

### Requirement: Input component declaration shape
A node MAY declare a `components` array in the holotape JSON, either at the top level or within a variant entry. An input component is an entry of that array with `type: "input"`. The entry SHALL declare:

- `type: "input"` — the component discriminator.
- `placeholder: <string>` — placeholder text rendered inside the empty field (Italian).
- `set: "<scope>.<name>"` — the scope-qualified state variable the submitted value is written into. The scope prefix SHALL be `local.` or `global.`.
- `branches: [<branch>, …]` — an ordered, non-empty list of branches. Each `<branch>` SHALL be either `{ "when": <Condition>, "target": "<nodeId>" }` or `{ "default": true, "target": "<nodeId>" }`, where `<Condition>` uses the same structured grammar as node `variants` (`and` / `or` / `not` / leaf `{ var, op, value }` with operators `eq` / `neq` / `gt` / `gte` / `lt` / `lte` / `in`). The `target` of a branch is a node id; the branch condition field is `when`.

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

## ADDED Requirements

### Requirement: A failed submission never leaves the field permanently disabled
The input component SHALL guarantee that no submission failure leaves the input
field permanently disabled. While a submission's mutation POST is in flight the
field is disabled (single-flight). On ANY non-navigating outcome — a 4xx
re-render, a network/5xx inline error, an unresolvable-branch logic error, or any
thrown exception from the dispatch path (including an invalid mutation key) — the
engine SHALL re-enable the field, clear the in-flight guard, restore the keyboard
focus list, and surface an inline error (except where the existing spec mandates a
re-render or navigation instead). The engine SHALL NOT depend on the mutation key
being valid for the field to recover.

#### Scenario: Thrown dispatch exception re-enables the field
- **WHEN** the mutation dispatch throws an exception (for example, an invalid
  mutation key) during a submission
- **THEN** the engine SHALL re-enable the input field
- **THEN** the engine SHALL clear the in-flight guard so the user can submit again
- **THEN** the engine SHALL surface an inline error
- **THEN** the input field SHALL NOT remain permanently disabled

#### Scenario: Field recovers regardless of failure path
- **WHEN** a submission fails by any path that is not a successful navigation or a
  mandated re-render
- **THEN** the input field SHALL end in an enabled, focusable state with an inline
  error shown
