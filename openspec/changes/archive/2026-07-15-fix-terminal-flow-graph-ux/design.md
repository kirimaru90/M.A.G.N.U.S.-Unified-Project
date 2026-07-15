## Context

The flow-graph preview (`terminal-flow-graph.ts` + `flow-graph.layout.ts`) renders a dagre `rankdir: 'LR'` layout as SVG inside a horizontally-scrollable `.flow-canvas-wrap`. The SVG's `width`/`height`/`viewBox` are dagre's intrinsic dimensions, so the canvas is drawn at exactly 1× with no scaling. Four UX problems and one cross-cutting styling problem stem from this baseline:

1. A graph narrower than the panel is left-aligned with dead space on the right (`overflow-x: auto` + intrinsic width).
2. `.fg-node.entry .fg-node-box` paints a permanent accent border on `start`.
3. `isNodeDimmed()` / `isEdgeDimmed()` apply `.dim` (opacity 0.15–0.25) to everything not touching the hovered node.
4. There is no zoom at all.
5. PrimeNG dialogs (`ConfirmDialog`, `p-dialog`) are portaled to `<body>`, outside `.bo-frame`, so `--bo-font-ui` (scoped to `.bo-frame`) never resolves and they fall back to the PrimeNG default font.

The derivation core (`flow-graph.model.ts`) is DOM-free and unit-tested and is **not** touched by this change.

## Goals / Non-Goals

**Goals:**
- Default the canvas to a fit-to-width scale so narrow graphs use the full panel width.
- Add zoom (buttons + plain wheel) that grows inter-node spacing while keeping node boxes, badges, and text a constant on-screen size.
- Remove the permanent `start` highlight while keeping its `start` label.
- Replace hover-dimming with a hovered-node border + incident-edge recolor, deferring to the active node's selected styling.
- Make CMS confirmation/modal dialogs render in the app UI font.

**Non-Goals:**
- Editing the graph from the canvas, drag-to-pan (scrollbars stay the pan mechanism), a minimap.
- Any change to `flow-graph.model.ts` (graph derivation) or the terminal schema.
- Independent horizontal/vertical spacing controls (uniform zoom only for v1).

## Decisions

### Decision 1: Spacing-only zoom by scaling layout coordinates, not an SVG transform

A geometric `<g transform="scale(z)">` scales fonts and stroke widths along with positions — the opposite of the requirement, where text must stay readable and only gaps grow. Instead, zoom multiplies **dagre's output positions and edge points by `z`** while `NODE_WIDTH`, `NODE_HEIGHT`, badge sizes, and font sizes stay fixed. Because the boxes are constant-size, growing their centre-to-centre distance is exactly "distance from nodes becomes bigger" with unchanged type.

Implementation: keep a `zoom` signal on the component. A pure helper `scaleLayout(layout, z)` (in `flow-graph.layout.ts`) returns nodes with `x*z, y*z` (box `width`/`height` unchanged), edge points scaled by `z`, scaled label positions, and canvas `width*z`/`height*z`. The SVG `width`/`height`/`viewBox` use the scaled dimensions; each node still renders via `translate(x,y)` with a constant-size `<rect>`.

**Alternatives considered:**
- *Geometric `scale(z)` group* — rejected: scales fonts, violating the core requirement.
- *Counter-scale trick* (`scale(z)` outer, `scale(1/z)` per node) — rejected: works for boxes but forces `vector-effect: non-scaling-stroke` on every edge plus per-label counter-scaling; more moving parts than scaling plain numbers.
- *Re-run dagre with `ranksep*z`/`nodesep*z`* — rejected for v1: perfect edge routing but a relayout per zoom step and a nonlinear width→ranksep inversion for fit-to-width; the coordinate scale is simpler and these graphs are small.

### Decision 2: Trim edge endpoints to the fixed box border after scaling

Dagre routes edges to box borders in intrinsic space. Scaling points by `z` moves the endpoint to where the border *was* in scaled space, but the box stayed its original size, leaving a small gap with the arrowhead floating short of the node. `scaleLayout` therefore trims each edge's final segment back onto the (constant-size) target box rectangle — clamp the last point to the box edge along the incoming segment direction. Same for the first point against the source box so lines emerge from the border.

### Decision 3: Fit-to-width default, clamped to ≥ 1×

On first render and on "reset", `zoom = clamp(containerWidth / intrinsicWidth, MIN_FIT, MAX)` with `MIN_FIT = 1`. A narrow graph (intrinsic < container) spreads to fill; a wide graph stays at 1× and scrolls exactly as today — no regression. Container width comes from the `.flow-canvas-wrap` client width via a `ResizeObserver` (or an element ref read on demand); the fit recomputes when the panel is expanded or the viewport resizes. Manual zoom overrides the fit until reset. `MAX` is a fixed ceiling (≈ 3×). Uniform scaling means a tall graph may gain a vertical scrollbar at fit — accepted per the proposal.

### Decision 4: Wheel zoom captured, focused on the pointer

A `wheel` listener on the canvas calls `preventDefault()` (so the page does not scroll) and steps `zoom` by a small factor per notch, clamped to `[MIN, MAX]`. To keep the spot under the cursor stable, adjust the wrap's `scrollLeft`/`scrollTop` so the pre-zoom pointer position maps to the same content point post-zoom. The listener must be registered non-passive (`{ passive: false }`) for `preventDefault` to take effect — done via `@HostListener` alternative of an explicit `addEventListener` in an `afterNextRender`/`effect`, since Angular template `(wheel)` bindings are passive-safe but here we need `preventDefault`.

### Decision 5: Hover = border + edge recolor, active node wins

Drop `isNodeDimmed`/`isEdgeDimmed` and the `.dim` styles. Add:
- `.fg-node.hovered:not(.active) .fg-node-box` → accent border (reuse the exact stroke the `.entry` rule used to apply).
- `isEdgeHighlighted(edge)` = `edge.from === hovered || edge.to === hovered` → `.fg-edge.hl .fg-edge-line` recolored to accent, with `marker-end` switched to a new accent arrowhead marker `#fg-arrow-hl` (SVG markers cannot inherit the line's stroke, so a dedicated marker def is required). A highlighted `broken` edge keeps its danger styling.

The `active` class continues to own the selected look; the `:not(.active)` guard ensures hovering the selected node does not override its selected styling.

### Decision 6: Remove permanent entry highlight, keep the label

Delete the `.fg-node.entry .fg-node-box` border rule. Keep the `@if (... n.id === graph().entryId)` `start` `<text>` label so the entry node stays identifiable. The `entry` class may remain on the group for the label conditional but no longer carries border styling.

### Decision 7: Overlay dialog font via a global rule mirroring the multiselect pattern

`tokens.css` already mirrors surface tokens onto `:root[data-theme]` for the multiselect overlay because PrimeNG portals it outside `.bo-frame`. Extend the same idea: add a global rule setting `font-family` to the Inter UI stack on the PrimeNG dialog/confirm overlay classes (`.p-dialog`, `.p-confirmdialog`, and their header/content/footer parts) so confirmation popups match the backoffice. The value is the literal `--bo-font-ui` stack (or a `:root`-level `--bo-font-ui`) since the token variable is scoped to `.bo-frame` and will not resolve on a body-level overlay.

## Risks / Trade-offs

- **Edge-endpoint trim imperfect on curved/multi-point routes** → dagre emits polylines; trimming the final segment to the box handles the common case. For the rare multi-bend edge the trim still lands on the box border along the last segment, which is visually correct. → Mitigation: unit-test the trim against a straight and an L-shaped edge.
- **Wheel capture hijacks scroll over the canvas** → the user chose plain-wheel zoom knowingly; only `preventDefault` while the pointer is over the canvas, so page scroll resumes off-canvas. → Mitigation: keep the zoom step small and the fit/reset button prominent.
- **Fit-to-width makes tall graphs scroll vertically** → accepted per proposal; uniform scale is simpler than independent axes. → Mitigation: `MAX` ceiling and reset-to-fit keep it recoverable.
- **Global `.p-dialog` font rule could bleed into other PrimeNG dialogs** → intended: every CMS dialog should use the app font, so a global rule is the correct scope, not a regression.
- **`ResizeObserver` in `OnPush`** → must trigger change detection (write a signal) when the container resizes so the fit recomputes. → Mitigation: store container width in a signal read by the `zoom` fit computation.

## Migration Plan

Pure front-end, no data or API change. Ship the component + layout + CSS edits together; behavior is additive/visual. Rollback is a straight revert of the changed files. No feature flag needed.

## Open Questions

- Exact `MAX` zoom ceiling and wheel step factor — pick sensible defaults (≈ 3×, ~1.1 per notch) and tune during `verify`.
- Whether to persist the user's manual zoom across panel collapse/expand or always reset to fit on expand — default to reset-to-fit on expand unless it feels wrong in `verify`.
