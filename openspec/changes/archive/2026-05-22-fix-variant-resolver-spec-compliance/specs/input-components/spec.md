## MODIFIED Requirements

### Requirement: Input component declaration shape
A node MAY declare a `components` array in the holotape JSON, either at the top level or within a variant entry. An input component is an entry of that array with `type: "input"`. The entry SHALL declare:

- `type: "input"` — the component discriminator.
- `placeholder: <string>` — placeholder text rendered inside the empty field (Italian).
- `target: "<scope>.<name>"` — the scope-qualified state variable the submitted value is written into. The scope prefix SHALL be `local.` or `global.`.
- `branches: [<branch>, …]` — an ordered, non-empty list of branches. Each `<branch>` SHALL be either `{ "when": <Condition>, "target": "<nodeId>" }` or `{ "default": true, "target": "<nodeId>" }`, where `<Condition>` uses the same structured grammar as node `variants` (`and` / `or` / `not` / leaf `{ var, op, value }` with operators `eq` / `neq` / `gt` / `gte` / `lt` / `lte` / `in`).

A node SHALL declare at most one `components` entry with `type: "input"` across all resolved fields (node-level and variant-level combined).

The resolved `components` for a node SHALL be determined by the variant-override model: if the selected variant (or default variant) declares a `components` field, that array is used; otherwise the node's top-level `components` array is used.

#### Scenario: Node declares an input component at the top level
- **WHEN** a node's load payload contains `components: [{ type: 'input', placeholder: 'CODICE', target: 'local.entered_code', branches: [...] }]` and no matching variant overrides `components`
- **THEN** the engine SHALL render an input field for that node instead of a choice list

#### Scenario: Variant declares its own input component
- **WHEN** a node has `components: []` at the top level and the matched variant declares `components: [{ type: 'input', ... }]`
- **THEN** the engine SHALL render the input field from the variant's `components` array

#### Scenario: Node without components renders choices as before
- **WHEN** the resolved `components` array (after variant override) is empty or absent
- **THEN** the engine SHALL render the node's choices exactly as it does for a node with no input component
- **THEN** no input field SHALL be rendered
