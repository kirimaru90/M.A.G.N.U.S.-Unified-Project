## ADDED Requirements

### Requirement: Pure condition evaluator at src/state/conditions.js
The system SHALL expose a single module at `src/state/conditions.js` that evaluates the structured condition grammar from ARCHITECTURE.md §8.6. The module SHALL export a pure function `evaluate(condition, snapshot) -> boolean`. The evaluator SHALL NOT issue network requests, read from the store directly, or have any side effects.

#### Scenario: Evaluator is pure
- **WHEN** `evaluate(condition, snapshot)` is invoked twice with the same inputs
- **THEN** both calls SHALL return the same boolean result
- **THEN** neither call SHALL trigger any `fetch` or store mutation

#### Scenario: Snapshot is the only state source
- **WHEN** the evaluator is invoked
- **THEN** it SHALL read state variables exclusively from the supplied `snapshot` argument, not from `src/state/store.js` or any other module

### Requirement: Leaf comparison operators
The evaluator SHALL support leaf comparison conditions of the shape `{ var: '<scope>.<name>', op: '<operator>', value: <value> }` where `<scope>` is `local` or `global` and `<operator>` is one of: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`. The `in` operator's `value` field SHALL be an array; all other operators take a scalar.

- `eq` / `neq`: equality / inequality (`===` / `!==` semantics).
- `gt` / `gte` / `lt` / `lte`: numeric ordering.
- `in`: the variable's current value is present in the `value` array (`Array.prototype.includes` semantics).

#### Scenario: eq returns true on match
- **WHEN** the snapshot has `local.hp = 5` and the condition is `{ var: 'local.hp', op: 'eq', value: 5 }`
- **THEN** `evaluate` SHALL return `true`

#### Scenario: neq returns true on mismatch
- **WHEN** the snapshot has `local.hp = 5` and the condition is `{ var: 'local.hp', op: 'neq', value: 3 }`
- **THEN** `evaluate` SHALL return `true`

#### Scenario: gt / gte / lt / lte numeric ordering
- **WHEN** the snapshot has `local.hp = 5`
- **THEN** `evaluate({ var: 'local.hp', op: 'gt', value: 4 }, snapshot)` SHALL return `true`
- **THEN** `evaluate({ var: 'local.hp', op: 'gte', value: 5 }, snapshot)` SHALL return `true`
- **THEN** `evaluate({ var: 'local.hp', op: 'lt', value: 5 }, snapshot)` SHALL return `false`
- **THEN** `evaluate({ var: 'local.hp', op: 'lte', value: 5 }, snapshot)` SHALL return `true`

#### Scenario: in checks array membership
- **WHEN** the snapshot has `local.quest_stage = 'middle'` and the condition is `{ var: 'local.quest_stage', op: 'in', value: ['start', 'middle', 'end'] }`
- **THEN** `evaluate` SHALL return `true`

#### Scenario: Reading an undeclared variable
- **WHEN** the snapshot has no value for the referenced variable
- **THEN** the variable SHALL be treated as `undefined` for the comparison
- **THEN** `eq` against any non-undefined value SHALL return `false`
- **THEN** the call SHALL NOT throw

### Requirement: Combinator conditions
The evaluator SHALL support three combinators: `and`, `or`, `not`. `and` and `or` take a list of nested conditions; `not` takes a single nested condition. Combinators SHALL be arbitrarily nestable within each other and within leaf conditions.

- `{ and: [c1, c2, …] }` is true iff every child is true. An empty list SHALL evaluate to `true`.
- `{ or: [c1, c2, …] }` is true iff at least one child is true. An empty list SHALL evaluate to `false`.
- `{ not: c }` is true iff `c` is false.

#### Scenario: and with all children true
- **WHEN** the condition is `{ and: [{ var: 'local.a', op: 'eq', value: 1 }, { var: 'local.b', op: 'eq', value: 2 }] }` and the snapshot is `{ local: { a: 1, b: 2 } }`
- **THEN** `evaluate` SHALL return `true`

#### Scenario: or with one child true
- **WHEN** the condition is `{ or: [{ var: 'local.a', op: 'eq', value: 99 }, { var: 'local.b', op: 'eq', value: 2 }] }` and the snapshot is `{ local: { a: 1, b: 2 } }`
- **THEN** `evaluate` SHALL return `true`

#### Scenario: not inverts the child
- **WHEN** the condition is `{ not: { var: 'local.a', op: 'eq', value: 1 } }` and the snapshot is `{ local: { a: 1 } }`
- **THEN** `evaluate` SHALL return `false`

#### Scenario: Nested combinators
- **WHEN** the condition is `{ and: [{ or: [{ var: 'local.a', op: 'eq', value: 1 }, { var: 'local.a', op: 'eq', value: 2 }] }, { not: { var: 'local.b', op: 'eq', value: 0 } }] }` and the snapshot is `{ local: { a: 2, b: 5 } }`
- **THEN** `evaluate` SHALL return `true`

### Requirement: Node-resolver picks first matching variant
A node-resolver module at `src/engine/node-resolver.js` SHALL implement variant resolution. Given a node and a snapshot, the resolver SHALL iterate the node's `variants` array in declaration order and return the first variant whose `condition` evaluates to `true`. If no variant's condition matches, the resolver SHALL return the variant marked `default: true` (the "default variant"). If no variant matches and no default variant is declared, the resolver SHALL fall back to the node's top-level `text` and `choices` (the base node body).

#### Scenario: First matching variant wins
- **WHEN** a node has two variants whose conditions both evaluate true
- **THEN** the resolver SHALL return the one declared first

#### Scenario: Default variant used as fallback
- **WHEN** a node has variants none of which match the current snapshot, plus one variant marked `default: true`
- **THEN** the resolver SHALL return the default variant

#### Scenario: No variants, no defaults — base node body is used
- **WHEN** a node has a `variants` array where no condition matches and no entry is marked `default: true`
- **THEN** the resolver SHALL fall back to the node's top-level `text` and `choices`

#### Scenario: Node without variants is returned verbatim
- **WHEN** a node has no `variants` field (or an empty array)
- **THEN** the resolver SHALL return the node's top-level `text` and `choices` directly

### Requirement: Variant content overrides the base node body
When the resolver selects a variant (matching or default), the variant's `text` SHALL replace the node's top-level `text`, and the variant's `choices` SHALL replace the node's top-level `choices`. Fields not declared on the variant SHALL fall back to the corresponding fields on the node. The variant SHALL NOT modify the underlying node object — the resolver SHALL produce a merged view for rendering.

#### Scenario: Variant text replaces node text
- **WHEN** a node has `text: 'A'` and a matching variant with `text: 'B'`
- **THEN** the resolved view SHALL have `text: 'B'`

#### Scenario: Variant without choices falls back to node choices
- **WHEN** a node has two choices and the matching variant declares no `choices` field
- **THEN** the resolved view SHALL render the node's two choices

#### Scenario: Resolution does not mutate the node
- **WHEN** the resolver runs against a node
- **THEN** the original node object SHALL be unchanged after the call

### Requirement: Render before dispatching on_enter mutations
On node entry, the resolver SHALL evaluate variants against the current snapshot first, SHALL render the resolved view, and SHALL only then dispatch the node's `on_enter` mutation list. Variant evaluation SHALL NOT be blocked on the round-trip of the mutation request. This ordering is locked in as a normative requirement.

#### Scenario: Variants evaluated against pre-mutation snapshot
- **WHEN** a node has both `variants` (referencing `local.x`) and `on_enter: [{ op: 'set', var: 'local.x', value: 1 }]`, and `local.x = 0` before entry
- **THEN** variant evaluation SHALL use `local.x = 0` (the value before the `on_enter` mutation)
- **THEN** the resolved view SHALL be rendered before the mutation request is issued

#### Scenario: Render not blocked on mutation round-trip
- **WHEN** the engine enters a node with an `on_enter` mutation
- **THEN** the engine SHALL display the resolved view to the user without awaiting the mutation POST's response
