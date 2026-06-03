## ADDED Requirements

### Requirement: Recursive condition builder component
The editor SHALL provide a single recursive condition-builder component bound to a `FormGroup` carrying a synthetic `kind` discriminator (`leaf | and | or`). For `kind = leaf` it SHALL render `key`, an operator selector (`eq | neq | gt | lt | gte | lte | in`), and a value editor. For `kind = and | or` it SHALL render a `FormArray` of child conditions, each rendered by recursively instancing the same component. The component SHALL offer actions to **add a leaf**, **add an AND group**, **add an OR group**, and **remove** a node.

#### Scenario: Leaf renders predicate controls
- **WHEN** a condition node has `kind = leaf`
- **THEN** the component renders a key input, an operator selector, and a value editor

#### Scenario: Combinator nests children
- **WHEN** the admin adds an AND group and then adds a leaf and an OR group inside it
- **THEN** the AND node renders both children, each editable through the same recursive component

#### Scenario: Add and remove controls
- **WHEN** the admin clicks "add leaf", "add AND", or "add OR" on a combinator, then "remove" on a child
- **THEN** the corresponding child `FormGroup` is appended to or removed from the combinator's children `FormArray`

### Requirement: Condition serializes to canonical key-presence JSON
The condition builder SHALL serialize to the canonical `ConditionSchema` shape: a leaf becomes `{ key, <op>: value }` where the operator is the JSON key (not a separate `op` field); `in` SHALL produce an array value while the other operators produce a single primitive (string, number, or boolean). An `and`/`or` node SHALL produce `{ and: [...] }` / `{ or: [...] }`. Loading the inverse SHALL map a single-operator object to a leaf and `{ and }`/`{ or }` objects to the combinator kinds. The produced JSON SHALL validate against `ConditionSchema`.

#### Scenario: Leaf serialization
- **WHEN** a leaf has key `local.bunker_code_seen`, operator `eq`, value `true`
- **THEN** it serializes to `{ "key": "local.bunker_code_seen", "eq": true }`

#### Scenario: in-operator uses an array
- **WHEN** a leaf has operator `in` with values `[1, 2, 3]`
- **THEN** it serializes to `{ "key": "...", "in": [1, 2, 3] }`

#### Scenario: Three-level nesting validates
- **WHEN** the admin builds an AND containing an OR that contains an AND of leaves (three levels)
- **THEN** the serialized condition validates against `ConditionSchema`

#### Scenario: Load maps JSON back to the tree
- **WHEN** an existing `{ or: [ { key, eq }, { and: [...] } ] }` condition is loaded
- **THEN** the builder renders an OR combinator with a leaf child and an AND child

### Requirement: Recursive mutation editor
The editor SHALL provide a mutation editor rendering a `FormArray` of mutation rows, each with a scope-prefixed `key`, an `op` selector (`set | increment | toggle`), and an op-appropriate value control. The same component SHALL be usable in `on_enter`, choice `set`, and input-component `set` contexts. Serialization SHALL emit `{ key, op: 'set', value }` for `set`, `{ key, op: 'increment', by }` for `increment`, and `{ key, op: 'toggle' }` for `toggle`; fields irrelevant to the selected op SHALL be omitted. The produced array SHALL validate against `MutationSchema`.

#### Scenario: Set mutation
- **WHEN** a row has key `global.omega_activated`, op `set`, value `true`
- **THEN** it serializes to `{ "key": "global.omega_activated", "op": "set", "value": true }`

#### Scenario: Increment mutation uses by
- **WHEN** a row has key `local.access_count`, op `increment`, by `1`
- **THEN** it serializes to `{ "key": "local.access_count", "op": "increment", "by": 1 }` and carries no `value` key

#### Scenario: Toggle mutation carries neither value nor by
- **WHEN** a row has key `local.flag`, op `toggle`
- **THEN** it serializes to `{ "key": "local.flag", "op": "toggle" }`

#### Scenario: Op switch reshapes the visible control
- **WHEN** the admin switches a row's op from `set` to `increment`
- **THEN** the value control is replaced by a numeric `by` control and the serialized row omits `value`
