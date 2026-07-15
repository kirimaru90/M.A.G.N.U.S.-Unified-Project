## Why

A terminal is a directed graph — nodes joined by `target` strings on choices and branches — but the CMS editor shows it as a flat, linear list of node cards. Authors can't see the flow at a glance; they can't tell that a `target` points at a node that doesn't exist until they hit a dead end in the emulator; and they can't see which nodes are unreachable from `start`. As a terminal grows past a handful of nodes the flat list also just gets long to scroll.

This change adds a read-only **flow-graph preview** above the nodes list and makes the node cards **collapsible (collapsed by default)**, with the graph acting as the navigation surface into them. Everything it shows is derived from data already in the form — no schema, API, or persistence change.

## What Changes

- Add a **flow-graph preview** panel to the terminal editor, placed after the summary sections (metadata / state / fictional users) and before the nodes list.
- Derive the graph purely from the reactive form: nodes = node ids; edges = every `target` reachable from a node's choices, its variants' choices, and its input-component branches (node-level and per-variant). No new persisted data.
- Render the flow **left-to-right** with `start` as the entry node, using `dagre` for layout and custom SVG for rendering so it honours the `bo-*` theme tokens (light + dark).
- Surface three things the flat list cannot: the **entry** node (`start`), **unreachable** nodes (dimmed), and **broken targets** — a `target` matching no node id, shown as a red ghost node plus an inline warning on the offending node card.
- Encode node metadata as small badges (login gate, variants, input component, on_enter) and edge kind by stroke (direct / conditional / back-edge / broken).
- Make node cards **collapsible accordions, collapsed by default**.
- Wire **graph → accordion**: clicking a graph node expands and scrolls to that node's card, and the open card stays highlighted in the graph (two-way sync). Hovering a graph node isolates its incident edges.
- Recompute the graph reactively as the form changes (add/remove node, edit a target), debounced, under `OnPush`.

## Capabilities

### New Capabilities

- `cms-terminal-flow-graph`: derive-and-render the terminal flow graph from the editor form; entry / unreachable / broken-target detection; left-to-right dagre layout with themed SVG; graph-drives-accordion interaction and hover isolation; reactive recompute; read-only (no editing from the canvas).

### Modified Capabilities

- `cms-terminal-nodes-editor`: node cards become collapsible and collapsed by default, and expose a programmatic open so the graph can reveal a node.
- `cms-terminal-editor-shell`: the flow-graph panel is positioned between the fictional-users section and the nodes section and wired to the nodes list.

## Testing

Per the cms-* rule (runner unblocked — `enable-cms-testing` is archived; `npm test` → `ng test --no-watch`):

- **Unit (pure, no DOM)** — the derivation function `deriveFlowGraph(content) → { nodes, edges, entryId, unreachable[], broken[] }`: edge extraction across choices + variant choices + component branches (node-level and per-variant), `start` as entry, reachability from entry, broken-target detection, and cycle / back-edge handling. Highest-value coverage.
- **Component** — flow-graph component: renders one box per node plus a ghost per broken target; clicking a node emits the selected id; hovering sets the isolation state.
- **Component** — nodes-section: cards render collapsed by default; calling the programmatic open for a node expands and marks that card active.
- **Component / integration** — editor shell: the graph panel renders between the users and nodes sections, and clicking a graph node opens the matching accordion.

Final task runs `npm test` from `apps/cms` and confirms pass; changed files meet ≥ 70% line coverage.

## Impact

- **New runtime dependency**: `dagre` (~40 kb, layout-only — computes positions, never touches the DOM, so it carries no theming cost). Fallback if the team prefers zero new deps: a hand-rolled layered layout behind the same SVG renderer; the derivation core is layout-agnostic and unaffected either way.
- **New files** under `apps/cms/src/app/features/terminals/editor/`: `flow-graph.model.ts` (pure derivation) and `terminal-flow-graph.ts` (component). `nodes-section.ts` gains collapse state and a programmatic open; `terminal-editor.ts` gains the panel and the graph↔nodes wiring.
- **No API, schema, or persistence change**; the emulator (`apps/terminal`) is untouched. This is a read-only view of data already in the form.
- **Out of scope**: editing the graph from the canvas (drag-to-connect, create/delete nodes), pan/zoom controls (v1 uses a scrollable canvas; zoom is a later add via a group transform), and a minimap.
