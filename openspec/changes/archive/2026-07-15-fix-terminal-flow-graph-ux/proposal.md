## Why

The terminal flow-graph preview shipped, but authors hit four rough edges in daily use. A shallow flow is **cramped against the left** of the panel while the right half sits empty. The `start` node is **permanently highlighted**, competing for attention with the node the author actually selected. **Hovering a node dims everything else**, which hides the surrounding structure instead of clarifying it. And there is **no zoom** — a dense pocket of the graph stays cramped no matter what, because the original panel is a fixed-scale scrollable canvas (zoom was explicitly deferred in the first proposal). Separately, the CMS **confirmation popups render in the wrong font** — PrimeNG portals them to `<body>`, outside `.bo-frame`, so they never inherit the app's Inter UI font and look foreign next to the rest of the backoffice.

## What Changes

- **Fill the width.** The canvas defaults to a fit-to-width zoom so a graph narrower than the panel spreads to use the whole width instead of hugging the left. A graph already wider than the panel stays at 1× and scrolls (unchanged).
- **Spacing-only zoom.** Add zoom via header buttons (`+` / `−` / reset-to-fit) and plain mouse-wheel over the canvas (wheel is captured so it does not scroll the page). Zoom scales the **layout spacing only** — node boxes, badges, and all text keep a constant size while inter-node distance grows, so zooming *in* declutters a dense area and keeps labels readable rather than magnifying them.
- **Drop the permanent start highlight.** The `start` node loses its always-on accent border but **keeps its `start` text label** so it stays identifiable.
- **Rework hover.** Hovering a node no longer dims the rest of the graph. Instead the hovered node gets an accent border (the look the `start` node used to have) — **unless it is the active/last-selected node, whose selected styling wins** — and the node's incident edges recolor to an accent highlight so they stand out against the untouched rest of the graph.
- **Align popup fonts.** CMS confirmation dialogs (the shared PrimeNG `ConfirmDialog` and the `p-dialog`-based confirms) adopt the app UI font so their type matches the rest of the backoffice, following the same overlay-theming pattern already used for the multiselect overlay.

## Capabilities

### New Capabilities

<!-- None — this change modifies existing behavior only. -->

### Modified Capabilities

- `cms-terminal-flow-graph`: the "Left-to-right themed rendering" requirement gains fit-to-width defaulting and spacing-only zoom (constant-size boxes/text, growing gaps) via buttons + wheel; the "Graph drives the node accordions" requirement changes hover from dim-the-rest isolation to a hovered-node border plus incident-edge recolor, with the active node's selected styling taking precedence; the permanent entry-node highlight is removed while the `start` label is retained.
- `cms-app-shell`: adds a requirement that PrimeNG overlay dialogs (confirmation and modal `p-dialog`) render with the `--bo-font-ui` app font despite being portaled outside `.bo-frame`, extending the existing overlay-token-mirroring approach.

## Testing

Per the cms-* rule (runner unblocked — `cms-testing` is archived; `npm test` → `ng test --no-watch`):

- **Unit (pure, no DOM)** — the layout/zoom math: scaling dagre positions and edge points by a zoom factor `z` leaves `NODE_WIDTH`/`NODE_HEIGHT` and font sizes untouched while inter-node distance scales by `z`; the fit-to-width default computes `z = clamp(containerWidth / intrinsicWidth, 1, max)` and never drops below 1×. Highest-value coverage.
- **Component** — flow-graph component: the entry node no longer carries the permanent-highlight class but still renders its `start` label; hovering a node applies the hover-border class to that node (and NOT when it is the active node) and the highlight class to its incident edges, and does **not** apply any dim class to other nodes/edges; the zoom buttons and wheel change the zoom factor within bounds.
- **Presentational (CSS-only)** — the confirmation-popup font is a global stylesheet rule targeting PrimeNG overlay classes; it carries no component logic to unit-test. Verified by driving the app (see the `verify` step in tasks) and inspecting the rendered dialog, and asserted structurally where a spec can reach the overlay class.

Final task runs `npm test` from `apps/cms` and confirms pass; changed component/layout files meet ≥ 70% line coverage.

## Impact

- **No new dependencies.** `dagre` already ships; the SVG renderer already exists. This is behavior and styling on files already in place.
- **Changed files** under `apps/cms/src/app/features/terminals/editor/`: `terminal-flow-graph.ts` (zoom state + controls, hover/entry template and styles, wheel handler), `flow-graph.layout.ts` (or a small pure helper) for the position/edge scaling and fit-to-width computation, and their `.spec.ts` files. Global styling in `apps/cms/src/app/styles/tokens.css` (or `styles.css`) gains the overlay-font rule.
- **No API, schema, or persistence change**; the emulator (`apps/terminal`) is untouched. The graph remains a read-only view of data already in the form.
- **Out of scope**: editing the graph from the canvas, drag-to-pan (scroll bars remain the pan mechanism), a minimap, and any change to the derivation core (`flow-graph.model.ts`).
