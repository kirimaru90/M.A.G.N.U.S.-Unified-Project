## MODIFIED Requirements

### Requirement: Recursive condition builder component
The editor SHALL provide a single recursive condition-builder component bound to a `FormGroup` carrying a synthetic `kind` discriminator (`leaf | and | or | not`). For `kind = leaf` it SHALL render a **`var`** (scope-prefixed variable) input, an operator selector (`eq | neq | gt | lt | gte | lte | in`), and a value editor. For `kind = and | or` it SHALL render a `FormArray` of child conditions, each rendered by recursively instancing the same component, and SHALL offer actions to **add a leaf**, **add an AND group**, **add an OR group**, and **remove** a node. For `kind = not` it SHALL render its **single** child condition recursively under a "NOT" label, with the add-child actions hidden so the one-child invariant holds; authoring a `not` from a blank builder (a convert-to-NOT action) is out of scope for this change — a `not` node enters the builder only via load.

#### Scenario: Leaf renders predicate controls
- **WHEN** a condition node has `kind = leaf`
- **THEN** the component renders a `var` input, an operator selector, and a value editor

#### Scenario: Combinator nests children
- **WHEN** the admin adds an AND group and then adds a leaf and an OR group inside it
- **THEN** the AND node renders both children, each editable through the same recursive component

#### Scenario: Add and remove controls
- **WHEN** the admin clicks "add leaf", "add AND", or "add OR" on a combinator, then "remove" on a child
- **THEN** the corresponding child `FormGroup` is appended to or removed from the combinator's children `FormArray`

#### Scenario: NOT node renders a single child without add controls
- **WHEN** a condition node has `kind = not`
- **THEN** the component renders exactly its one child condition recursively under a "NOT" label and exposes no add-leaf/add-AND/add-OR actions on that node

### Requirement: Condition serializes to canonical var/op/value JSON
The condition builder SHALL serialize to the canonical `ConditionSchema` shape from `terminal-authoring-guide.md` v1.2: a leaf becomes `{ var, op, value }` where the operator is the **value of the `op` field** (never a JSON property name); `in` SHALL produce an array `value` while the other operators produce a single primitive (string, number, or boolean). An `and`/`or` node SHALL produce `{ and: [...] }` / `{ or: [...] }`, and a `not` node SHALL produce `{ not: <condition> }`. Loading SHALL accept **both** the new `{ var, op, value }` leaf shape **and** the legacy `{ key, <op>: value }` leaf shape (operator as the property name), normalizing both into the internal model, and SHALL always re-serialize in the new `{ var, op, value }` shape (migrate-on-write). `{ and }`/`{ or }`/`{ not }` objects SHALL map to the corresponding combinator kinds. The produced JSON SHALL validate against `ConditionSchema`. Mutation serialization is unaffected and continues to use `{ key, op, value }`.

#### Scenario: Leaf serialization
- **WHEN** a leaf has var `local.bunker_code_seen`, operator `eq`, value `true`
- **THEN** it serializes to `{ "var": "local.bunker_code_seen", "op": "eq", "value": true }`

#### Scenario: in-operator uses an array value
- **WHEN** a leaf has operator `in` with values `[1, 2, 3]`
- **THEN** it serializes to `{ "var": "...", "op": "in", "value": [1, 2, 3] }`

#### Scenario: Legacy leaf loads and upgrades on save
- **WHEN** an existing `{ "key": "local.access_count", "gte": 3 }` condition is loaded and then re-serialized
- **THEN** it loads into a leaf with var `local.access_count`, operator `gte`, value `3`, and serializes back as `{ "var": "local.access_count", "op": "gte", "value": 3 }`

#### Scenario: NOT round-trips
- **WHEN** an existing `{ "not": { "var": "local.x", "op": "eq", "value": true } }` condition is loaded and re-serialized
- **THEN** the builder renders a NOT node wrapping a single leaf and serializes back to `{ "not": { "var": "local.x", "op": "eq", "value": true } }`

#### Scenario: Three-level nesting validates
- **WHEN** the admin builds an AND containing an OR that contains an AND of leaves (three levels)
- **THEN** the serialized condition validates against `ConditionSchema`

#### Scenario: Load maps JSON back to the tree
- **WHEN** an existing `{ or: [ { var, op, value }, { and: [...] } ] }` condition is loaded
- **THEN** the builder renders an OR combinator with a leaf child and an AND child
