## ADDED Requirements

### Requirement: Flow graph derived from the editor form
The editor SHALL derive the terminal flow graph from the current form content via a single pure function `deriveFlowGraph(content)`, with no new persisted data and no change to `TerminalContentSchema`. Graph nodes SHALL be the terminal's node ids. Graph edges SHALL be extracted from every `target` reachable from a node's `choices`, its `variants[].choices`, its input-component `branches` (`components[].branches[].target`), and its per-variant input-component branches (`variants[].components[].branches[].target`). An edge SHALL carry a `label` (the choice label where present) and a `kind` of `direct` (an unconditional node-level choice) or `cond` (a choice with a `when`, or any variant/branch-guarded edge). The graph SHALL recompute reactively as the form changes (node added or removed, or a `target` edited).

#### Scenario: Edge extracted from a node-level choice
- **WHEN** node `menu` has a choice labelled `Apri porta` with `target: door_check` and no `when`
- **THEN** the derived graph contains an edge `menu → door_check` with label `Apri porta` and kind `direct`

#### Scenario: Conditional and branch edges extracted
- **WHEN** node `door_check` has an input component with a branch `target: vault_open` guarded by a condition and a default branch `target: menu`
- **THEN** the derived graph contains edges `door_check → vault_open` and `door_check → menu`, both kind `cond`

#### Scenario: Graph recomputes on target edit
- **WHEN** the author changes a choice's `target` from `logs` to `menu`
- **THEN** the derived graph replaces the `→ logs` edge with a `→ menu` edge without a page reload

### Requirement: Entry, unreachable, and broken-target detection
The derivation SHALL treat the node with id `start` as the entry node (`entryId`), matching the emulator boot. Nodes that no path from `entryId` reaches SHALL be reported as `unreachable`. Any edge whose `target` does not match an existing node id SHALL be reported as `broken`. When no node has id `start`, `entryId` SHALL be `null` and the panel SHALL show a warning that the terminal has no boot node.

#### Scenario: Unreachable node reported
- **WHEN** node `orphan` is not the target of any edge and no path from `start` reaches it
- **THEN** `orphan` appears in the graph's `unreachable` set and renders dimmed with an "irraggiungibile" marker

#### Scenario: Broken target reported
- **WHEN** node `menu` has a choice with `target: vault_doorX` and no node has id `vault_doorX`
- **THEN** the edge `menu → vault_doorX` is reported as `broken` and renders as a red ghost box distinct from real nodes

#### Scenario: Missing start node warned
- **WHEN** the terminal has no node with id `start`
- **THEN** `entryId` is `null` and the panel surfaces a warning that no boot node exists

### Requirement: Left-to-right themed rendering
The flow graph SHALL render left-to-right with the entry node leftmost, laid out so edges and back-edges are readable. It SHALL render with the CMS `bo-*` design tokens in both light and dark themes (not the emulator CRT styling). Nodes SHALL show badges indicating a per-node login gate, variants, an input component, and `on_enter` mutations. Edge stroke SHALL encode edge kind: direct, conditional, back-edge (cycle), and broken. The canvas SHALL live in a horizontally scrollable container so a wide flow does not scroll the page body sideways. The graph SHALL be read-only — structure cannot be edited from the canvas.

#### Scenario: Node badges reflect node contents
- **WHEN** node `menu` has variants and an `on_enter` mutation
- **THEN** its graph box shows the variants and `on_enter` badges

#### Scenario: Conditional edge is visually distinct
- **WHEN** an edge is kind `cond`
- **THEN** it renders with a dashed stroke distinct from a solid `direct` edge

#### Scenario: Wide flow scrolls within the panel
- **WHEN** the laid-out graph is wider than the panel
- **THEN** the canvas scrolls horizontally within its container and the page body does not scroll sideways

### Requirement: Graph drives the node accordions
Clicking a node in the graph SHALL expand and scroll to that node's card in the nodes list and mark that graph node active. The node whose card is currently open SHALL be shown as the active node in the graph (two-way highlight). Hovering a graph node SHALL isolate that node and its incident edges, de-emphasising the rest.

#### Scenario: Click opens and scrolls to the node card
- **WHEN** the author clicks the `door_check` box in the graph while its card is collapsed
- **THEN** the `door_check` accordion expands, scrolls into view, and the `door_check` graph node is highlighted as active

#### Scenario: Open card is highlighted in the graph
- **WHEN** the `menu` accordion is open
- **THEN** the `menu` node is shown as active in the graph

#### Scenario: Hover isolates incident edges
- **WHEN** the author hovers the `menu` node
- **THEN** only edges entering or leaving `menu` are emphasised and the other nodes and edges are de-emphasised

### Requirement: Flow-graph panel placement and collapsibility
The flow-graph preview SHALL be a collapsible panel rendered after the fictional-users section and before the nodes section of the terminal editor. Collapsing the panel from its header SHALL hide the graph without affecting the form.

#### Scenario: Panel sits between users and nodes
- **WHEN** the terminal editor renders for an existing terminal
- **THEN** the flow-graph panel appears after the fictional-users section and before the nodes section

#### Scenario: Panel collapses
- **WHEN** the author collapses the flow-graph panel
- **THEN** the graph is hidden and the form state is unchanged
