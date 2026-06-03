## ADDED Requirements

### Requirement: Nodes editor as an ordered, id-keyed list
The editor SHALL render `nodes` as an ordered `FormArray` of node groups, each carrying an explicit `id` control plus the node's content. Adding and removing nodes SHALL use the `FormArray`. Node `id`s SHALL be required and unique; a duplicate or empty id SHALL surface an inline error. On save the array SHALL be reduced back to a `Record<id, node>` keyed by `id` in array order. The list SHALL NOT be allowed to become empty (the schema requires at least one node).

#### Scenario: Add a node
- **WHEN** the admin adds a node with id `bunker_aperto` and some text
- **THEN** the serialized `nodes` object contains a `bunker_aperto` key whose value is that node

#### Scenario: Duplicate id rejected
- **WHEN** two nodes share the id `start`
- **THEN** an inline error appears and the form is invalid for save

#### Scenario: Last node cannot be removed
- **WHEN** only one node remains
- **THEN** the remove action for that node is unavailable or blocked so `nodes` never serializes empty

### Requirement: Node text with Markdown preview
Each node SHALL provide a Markdown `text` editor (textarea bound to the node's `text`) with an adjacent live preview rendered via `ngx-markdown`. Blank text SHALL be omitted from the serialized node rather than emitted as an empty string.

#### Scenario: Markdown renders in preview
- **WHEN** the admin types `# Titolo` into a node's text editor
- **THEN** the preview pane renders it as a heading via `ngx-markdown`

#### Scenario: Blank text omitted
- **WHEN** a node's text is left blank but it has choices
- **THEN** the serialized node has no `text` key

### Requirement: Node on_enter mutations
Each node SHALL provide an `on_enter` editor using the recursive mutation editor. When the list is empty, `on_enter` SHALL be omitted from the serialized node.

#### Scenario: on_enter serializes
- **WHEN** the admin adds an `on_enter` increment of `local.access_count` by `1`
- **THEN** the serialized node includes `"on_enter": [ { "key": "local.access_count", "op": "increment", "by": 1 } ]`

#### Scenario: Empty on_enter omitted
- **WHEN** a node has no `on_enter` mutations
- **THEN** the serialized node has no `on_enter` key

### Requirement: Node choices with optional condition and mutations
Each node SHALL provide a choices editor (`FormArray`). Each choice SHALL have a **label** (required, min 1) and a **target** node, an optional **when** condition built with the recursive condition builder, and an optional **set** mutation list built with the recursive mutation editor. Empty optional `when`/`set` SHALL be omitted from the serialized choice.

#### Scenario: Minimal choice
- **WHEN** the admin adds a choice with label `Entra` and target `bunker_aperto` and no condition or mutations
- **THEN** the serialized choice equals `{ "label": "Entra", "target": "bunker_aperto" }` with no `when` or `set` keys

#### Scenario: Conditional choice with mutations
- **WHEN** the admin adds a `when` condition and a `set` mutation to a choice
- **THEN** the serialized choice includes both `when` (canonical condition shape) and `set` (mutation array)

#### Scenario: Empty label blocked
- **WHEN** a choice label is empty
- **THEN** an inline error appears and the form is invalid for save

### Requirement: Node variants as full-node tabbed editors
Each node SHALL render its `variants` as a **tab strip** inside the node box. The tab strip SHALL be hidden when the node has no variants; in that state the author edits the node-level content directly with no tab chrome. When one or more variants exist, the strip SHALL show one tab per variant plus a trailing add tab marked with a "+".

Each variant tab SHALL edit the variant **as a full node rendering**, using the same controls as the node-level content editor: its own `text` (with the `ngx-markdown` preview), `choices` (each with optional `when` and `set` mutations), and `components` (input components). `on_enter` SHALL remain a per-node editor shown once outside the tab strip and SHALL NOT be editable per variant. Variants SHALL NOT be nestable — a variant tab SHALL NOT contain its own variants editor.

Each variant SHALL be either **conditional** (a `when` condition built with the recursive condition builder) or the **default fallback** (a toggle that serializes `default: true` and carries no `when`). At most one variant per node SHALL be the default fallback; violating this SHALL surface an inline error. The default-fallback variant's tab SHALL always be rendered first.

A node with a single variant SHALL be equivalent to a node with no variants: the editor SHALL NOT show the tab strip and SHALL NOT serialize a `variants` array until at least one conditional variant exists alongside the node-level (default) content.

On save each variant SHALL serialize only the fields the author defined — its selector (`when` or `default: true`) plus any of `text`, `choices`, `components` — with empty optionals pruned (a variant with no `text` emits no `text` key, etc.).

#### Scenario: Tabs hidden without variants
- **WHEN** a node has no variants
- **THEN** no tab strip is shown and the node-level text/choices/components are edited directly

#### Scenario: Add a variant via the "+" tab
- **WHEN** the admin clicks the "+" add tab on a node that has no variants
- **THEN** the tab strip becomes visible with the default (node-level) tab plus the new variant tab

#### Scenario: Variant edits full node content
- **WHEN** the admin opens a variant tab
- **THEN** it exposes the same `text` (with Markdown preview), `choices` (with optional `when`/`set`), and `components` controls as a node, but no `on_enter` and no nested variants editor

#### Scenario: Conditional variant
- **WHEN** the admin adds a variant with a `when` condition, alternative text, and a component
- **THEN** the serialized variant includes `when`, `text`, and `components`, and no `default` key

#### Scenario: Default fallback variant pinned first
- **WHEN** the admin marks a variant as the default fallback
- **THEN** the serialized variant includes `"default": true` and no `when` key, and its tab is rendered first

#### Scenario: At most one default
- **WHEN** two variants are marked as default fallback
- **THEN** an inline error appears and the form is invalid for save

#### Scenario: Remove a variant tab
- **WHEN** the admin removes a variant tab
- **THEN** that variant is dropped from `variants`; if no conditional variant remains the tab strip is hidden and `variants` is omitted on save

### Requirement: Accent styling for node header and active variant tab
The nodes editor SHALL use the application's green accent (`--bo-accent`, the same accent token used for primary buttons and active navigation highlights) as the **background** with inverse text (`--bo-text-inverse`) for two surfaces, so the active node identity and the active variant are visually emphasized consistently with the rest of the backoffice:

- The **node header** (the row containing the `ID nodo *` label, its input, and the remove-node action) SHALL render with the accent background and inverse-colored label text. The destructive remove-node button SHALL remain legible against the accent at rest and SHALL surface the danger color on hover.
- The **active variant tab** in the per-node tab strip SHALL render with the accent background and inverse text (replacing the prior plain surface highlight). Inactive tabs are unchanged.

#### Scenario: Node header uses the accent
- **WHEN** a node is rendered in the editor
- **THEN** its header (with the `ID nodo *` label) shows the green accent background with inverse-colored text

#### Scenario: Active variant tab uses the accent
- **WHEN** a variant tab (or the node-level tab) is the active tab
- **THEN** it is highlighted with the green accent background and inverse text, while inactive tabs keep the neutral surface style

### Requirement: Input component editor
Each node SHALL provide a components editor supporting the `input` component type. The same components editor SHALL be reused inside each variant tab (per the variants requirement). An input component SHALL have a **placeholder**, a **set** target variable (scope-prefixed string), and a **branches** `FormArray`. Each branch SHALL be either conditional (a `when` condition + a **target** node) or the default fallback (a toggle that serializes `{ default: true, target }`). At most one branch SHALL be the default fallback. The serialized component SHALL be `{ type: 'input', placeholder, set, branches }`.

#### Scenario: Input with conditional and default branches
- **WHEN** the admin adds an input component with placeholder `Codice`, set `local.entered_code`, one branch `{ when: entered_code eq "58874645", target: bunker_aperto }`, and one default branch targeting `bunker_negato`
- **THEN** the serialized component is `{ "type": "input", "placeholder": "Codice", "set": "local.entered_code", "branches": [ { "when": { "key": "local.entered_code", "eq": "58874645" }, "target": "bunker_aperto" }, { "default": true, "target": "bunker_negato" } ] }`

#### Scenario: At most one default branch
- **WHEN** two branches are marked as default fallback
- **THEN** an inline error appears and the form is invalid for save

#### Scenario: Empty components omitted
- **WHEN** a node has no components
- **THEN** the serialized node has no `components` key
