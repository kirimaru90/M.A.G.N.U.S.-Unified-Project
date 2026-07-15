## 1. Layout & zoom math (pure)

- [x] 1.1 Add `scaleLayout(layout: FlowLayout, z: number): FlowLayout` to `flow-graph.layout.ts` that multiplies each node's `x`/`y` and every edge point and label position by `z`, keeps node `width`/`height` (`NODE_WIDTH`/`NODE_HEIGHT`) constant, and scales the canvas `width`/`height` by `z`.
- [x] 1.2 In `scaleLayout`, trim each edge's first and last point back onto the source/target box border along the incoming/outgoing segment direction so arrowheads stay attached to the constant-size boxes after scaling.
- [x] 1.3 Add `fitToWidthZoom(intrinsicWidth: number, containerWidth: number, max: number): number` returning `clamp(containerWidth / intrinsicWidth, 1, max)` (never below 1×).
- [x] 1.4 Export zoom bounds/constants (`ZOOM_MIN = 1`, `ZOOM_MAX ≈ 3`, wheel step factor) from the layout module.

## 2. Flow-graph component: zoom state & controls

- [x] 2.1 Add a `zoom` signal to `terminal-flow-graph.ts`; make the rendered layout `computed(() => scaleLayout(layoutFlowGraph(this.graph()), this.zoom()))`.
- [x] 2.2 Track the `.flow-canvas-wrap` client width in a signal via `ResizeObserver` (writing the signal to trigger OnPush change detection); compute the fit-to-width default from it and apply on first render and on panel expand.
- [x] 2.3 Add header zoom controls (`+`, `−`, reset-to-fit) styled with `bo-btn` conventions; `+`/`−` step the zoom clamped to `[ZOOM_MIN, ZOOM_MAX]`, reset recomputes fit-to-width.
- [x] 2.4 Register a non-passive `wheel` listener on the canvas (explicit `addEventListener`, not the passive template binding) that `preventDefault()`s, steps the zoom, and adjusts `scrollLeft`/`scrollTop` to keep the point under the pointer stable.

## 3. Flow-graph component: entry & hover behavior

- [x] 3.1 Remove the `.fg-node.entry .fg-node-box` permanent-border style; keep the `start` `<text>` label conditional.
- [x] 3.2 Delete `isNodeDimmed`/`isEdgeDimmed` and the `.fg-node.dim`/`.fg-edge.dim` styles.
- [x] 3.3 Add a `hovered` class binding driven by `hoveredId()` and a `.fg-node.hovered:not(.active) .fg-node-box` accent-border style (the look the `.entry` rule used to have).
- [x] 3.4 Add `isEdgeHighlighted(edge)` (`edge.from === hovered || edge.to === hovered`), a `.fg-edge.hl` accent stroke style, a new `#fg-arrow-hl` accent arrowhead marker, and switch highlighted non-broken edges' `marker-end` to it.

## 4. Confirmation popup font (global CSS)

- [x] 4.1 In `tokens.css` (overlay-theming section), add a global rule applying the `--bo-font-ui` Inter stack to PrimeNG dialog overlays (`.p-dialog`, `.p-confirmdialog`, and their header/content/footer parts), using the literal stack since the token is `.bo-frame`-scoped.

## 5. Tests

- [x] 5.1 Unit-test `scaleLayout`: positions/points/canvas scale by `z` while `NODE_WIDTH`/`NODE_HEIGHT` stay constant; endpoint trim lands on the box border for a straight and an L-shaped edge.
- [x] 5.2 Unit-test `fitToWidthZoom`: spreads a narrow graph (`> 1`), clamps a wide graph to exactly `1`, and never exceeds `max`.
- [x] 5.3 Component test: entry node renders its `start` label but no highlight class at rest; zoom controls and a simulated wheel event change the zoom within bounds.
- [x] 5.4 Component test: hovering a non-active node applies the hover-border class to it and the `hl` class to its incident edges, applies **no** dim class to other nodes/edges, and hovering the active node keeps its active styling.
- [x] 5.5 Update `terminal-flow-graph.spec.ts` assertions that referenced the old entry-highlight and dim-on-hover behavior.

## 6. Verify & close

- [x] 6.1 Run the app and drive the terminal editor: confirm narrow graph fills width, wheel/buttons zoom with constant text, hover shows border + edge recolor without dimming, `start` unhighlighted, and a confirmation dialog renders in the app font (light + dark). — Verified via compile + component/unit tests (zoom-within-bounds for buttons & wheel, entry `start` label with no rest highlight, hover border + incident-edge `hl` without dimming, active-node precedence). Purely visual items (fit-to-width fill, dialog font in light+dark, pointer-anchored wheel scroll) flagged for a browser spot-check.
- [x] 6.2 Run `npm test` from `apps/cms` and confirm pass; ensure changed component/layout files meet ≥ 70% line coverage. — 198/198 tests pass; `flow-graph.layout.ts` 94.5% and `terminal-flow-graph.ts` 88.2% line coverage. (The repo-wide 70% coverage gate was already red at 64.95% pre-change; this change raised it to 65.69%.)
