## MODIFIED Requirements

### Requirement: Node-resolver picks first matching variant
A node-resolver module at `src/engine/node-resolver.js` SHALL implement variant resolution. Given a node and a snapshot, the resolver SHALL iterate the node's `variants` array in declaration order and return the first variant whose `when` condition evaluates to `true`. If no variant's condition matches, the resolver SHALL return the variant marked `default: true` (the "default variant"). If no variant matches and no default variant is declared, the resolver SHALL fall back to the node's top-level `text` and `choices` (the base node body).

#### Scenario: First matching variant wins
- **WHEN** a node has two variants whose `when` conditions both evaluate true
- **THEN** the resolver SHALL return the one declared first

#### Scenario: Default variant used as fallback
- **WHEN** a node has variants none of which match the current snapshot, plus one variant marked `default: true`
- **THEN** the resolver SHALL return the default variant

#### Scenario: No variants, no defaults — base node body is used
- **WHEN** a node has a `variants` array where no `when` condition matches and no entry is marked `default: true`
- **THEN** the resolver SHALL fall back to the node's top-level `text` and `choices`

#### Scenario: Node without variants is returned verbatim
- **WHEN** a node has no `variants` field (or an empty array)
- **THEN** the resolver SHALL return the node's top-level `text` and `choices` directly

### Requirement: Variant content overrides the base node body
When the resolver selects a variant (matching or default), the variant's `text` SHALL replace the node's top-level `text`, the variant's `choices` SHALL replace the node's top-level `choices`, and the variant's `components` SHALL replace the node's top-level `components`. Fields not declared on the variant SHALL fall back to the corresponding fields on the node. The variant SHALL NOT modify the underlying node object — the resolver SHALL produce a merged view for rendering.

#### Scenario: Variant text replaces node text
- **WHEN** a node has `text: 'A'` and a matching variant with `text: 'B'`
- **THEN** the resolved view SHALL have `text: 'B'`

#### Scenario: Variant without choices falls back to node choices
- **WHEN** a node has two choices and the matching variant declares no `choices` field
- **THEN** the resolved view SHALL render the node's two choices

#### Scenario: Variant without components falls back to node components
- **WHEN** a node has a `components` array and the matching variant declares no `components` field
- **THEN** the resolved view SHALL use the node's top-level `components`

#### Scenario: Variant components replace node components
- **WHEN** a node has `components: []` and the matching variant declares a non-empty `components` array
- **THEN** the resolved view SHALL use the variant's `components` array

#### Scenario: Resolution does not mutate the node
- **WHEN** the resolver runs against a node
- **THEN** the original node object SHALL be unchanged after the call
