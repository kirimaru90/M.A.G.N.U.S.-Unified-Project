## MODIFIED Requirements

### Requirement: Left-to-right themed rendering
The flow graph SHALL render left-to-right with the entry node leftmost, laid out so edges and back-edges are readable. It SHALL render with the CMS `bo-*` design tokens in both light and dark themes (not the emulator CRT styling). Nodes SHALL show badges indicating a per-node login gate, variants, an input component, and `on_enter` mutations. Edge stroke SHALL encode edge kind: direct, conditional, back-edge (cycle), and broken. The canvas SHALL live in a horizontally scrollable container so a wide flow does not scroll the page body sideways. The graph SHALL be read-only — structure cannot be edited from the canvas.

The canvas SHALL support a zoom factor that scales the **layout spacing only**: node boxes, badges, and all text SHALL keep a constant on-screen size at every zoom level, while the distance between nodes scales with the zoom factor. Zoom SHALL be adjustable by header controls (increase, decrease, and reset-to-fit) and by the mouse wheel over the canvas, where a wheel event over the canvas SHALL change the zoom and SHALL NOT scroll the page body. On first render and on reset, the zoom SHALL default to fit-to-width — computed so a graph narrower than the panel spreads to fill the available width — and SHALL never fall below 1×, so a graph already wider than the panel renders at 1× and scrolls as before. Edge endpoints SHALL remain attached to the node box borders at every zoom level.

The entry node SHALL NOT carry a permanent highlight; it SHALL remain identifiable by its `start` label only.

#### Scenario: Node badges reflect node contents
- **WHEN** node `menu` has variants and an `on_enter` mutation
- **THEN** its graph box shows the variants and `on_enter` badges

#### Scenario: Conditional edge is visually distinct
- **WHEN** an edge is kind `cond`
- **THEN** it renders with a dashed stroke distinct from a solid `direct` edge

#### Scenario: Wide flow scrolls within the panel
- **WHEN** the laid-out graph is wider than the panel
- **THEN** the canvas scrolls horizontally within its container and the page body does not scroll sideways

#### Scenario: Narrow graph fills the panel width
- **WHEN** the laid-out graph at 1× is narrower than the panel and the panel is first rendered
- **THEN** the zoom defaults to fit-to-width so the graph spreads to use the full panel width instead of being left-aligned with empty space on the right

#### Scenario: Zoom grows spacing but not text
- **WHEN** the author increases the zoom via the header control or the mouse wheel
- **THEN** the distance between nodes grows while every node box, badge, and text label keeps the same on-screen size, and the edges stay attached to the node box borders

#### Scenario: Wheel over the canvas zooms without scrolling the page
- **WHEN** the author scrolls the mouse wheel while the pointer is over the graph canvas
- **THEN** the zoom factor changes and the page body does not scroll

#### Scenario: Reset returns to fit-to-width
- **WHEN** the author has manually zoomed and then activates the reset control
- **THEN** the zoom returns to the fit-to-width default for the current panel width

#### Scenario: Entry node has no permanent highlight
- **WHEN** the graph renders a terminal whose entry node is `start` and no node is selected or hovered
- **THEN** the `start` node shows its `start` label but carries no accent highlight distinguishing it from the other nodes' resting appearance

### Requirement: Graph drives the node accordions
Clicking a node in the graph SHALL expand and scroll to that node's card in the nodes list and mark that graph node active. The node whose card is currently open SHALL be shown as the active node in the graph (two-way highlight). Hovering a graph node SHALL NOT dim or de-emphasise the other nodes and edges. Instead, hovering a node SHALL apply an accent border highlight to the hovered node and SHALL recolor that node's incident edges (edges entering or leaving it) to a distinct highlight colour, leaving all other nodes and edges at their resting appearance. When the hovered node is the active (last-selected) node, its active/selected styling SHALL take precedence over the hover border.

#### Scenario: Click opens and scrolls to the node card
- **WHEN** the author clicks the `door_check` box in the graph while its card is collapsed
- **THEN** the `door_check` accordion expands, scrolls into view, and the `door_check` graph node is highlighted as active

#### Scenario: Open card is highlighted in the graph
- **WHEN** the `menu` accordion is open
- **THEN** the `menu` node is shown as active in the graph

#### Scenario: Hover highlights the node and its edges without dimming the rest
- **WHEN** the author hovers the `menu` node and `menu` is not the active node
- **THEN** the `menu` box gains an accent border and the edges entering or leaving `menu` are recolored to the highlight colour, while every other node and edge keeps its resting appearance (none are dimmed)

#### Scenario: Active node keeps its selected styling on hover
- **WHEN** the author hovers a node that is the active (last-selected) node
- **THEN** the node retains its active/selected styling rather than switching to the hover border, and its incident edges are still highlighted
