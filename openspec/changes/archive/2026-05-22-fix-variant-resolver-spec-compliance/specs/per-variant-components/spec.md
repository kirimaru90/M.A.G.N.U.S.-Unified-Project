## ADDED Requirements

### Requirement: Variant components override node-level components
When the resolver selects a variant (matching or default), the variant's `components` array SHALL replace the node's top-level `components` in the resolved view. If the selected variant does not declare a `components` field, the resolver SHALL fall back to the node's top-level `components`. The resolver SHALL NOT modify the underlying node or variant objects.

#### Scenario: Variant components replace node components
- **WHEN** a node has `components: []` (empty) and the matching variant declares `components: [{ type: 'input', ... }]`
- **THEN** the resolved view SHALL contain the variant's `components` array
- **THEN** the node's top-level `components` SHALL be ignored

#### Scenario: Variant without components falls back to node components
- **WHEN** a node has `components: [{ type: 'input', ... }]` and the matching variant declares no `components` field
- **THEN** the resolved view SHALL contain the node's top-level `components` array

#### Scenario: Resolution does not mutate node or variant
- **WHEN** the resolver runs against a node with a variant that declares `components`
- **THEN** the original node object SHALL be unchanged after the call
- **THEN** the original variant object SHALL be unchanged after the call
