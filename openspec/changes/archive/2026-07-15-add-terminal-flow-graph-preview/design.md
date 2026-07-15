## Context

The CMS terminal editor (`apps/cms/src/app/features/terminals/editor/`) mirrors `TerminalContentSchema` into an Angular reactive form tree and renders it as four stacked sections: metadata, state schema, fictional users, and nodes. Nodes are a flat `FormArray` of node cards (`nodes-section.ts` → `node-editor.ts`). A terminal's structure is a directed graph — `main.js` boots the emulator at the node whose id is `start` and navigates by following `target` strings — but nothing in the editor shows that graph.

Constraints carried in from exploration:
- **All graph data already lives in the form.** No schema, API, or persistence change; the graph is a pure projection.
- **Entry node is `start`** (emulator boots `loadNode('start')`). It is the graph root for reachability.
- **`target`s are only node ids.** "Back" is emulator run-time history (`back-history.js`), never an edge. A `target` that matches no node id is therefore a genuine authoring bug this preview should surface.
- **Direction is left-to-right**, `start` leftmost (chosen in exploration).
- **The graph drives the accordions** (chosen in exploration): with cards collapsed by default, the graph is the navigation surface.

## Goals / Non-Goals

**Goals:**
- A read-only, always-in-sync preview of the terminal flow between the summary sections and the nodes list.
- Make visible three things the flat list hides: the entry node, unreachable nodes, and broken (dangling) targets.
- Collapse node cards by default and let the graph open/scroll to any one.
- Match the CMS `bo-*` theme in light and dark; no emulator CRT styling.

**Non-Goals:**
- Editing structure from the canvas (drag-to-connect, create/delete/rename nodes).
- Pan/zoom controls, minimap (v1 is a scrollable canvas).
- Any change to `TerminalContentSchema`, the API, or the emulator.
- Rendering condition semantics beyond "this edge is conditional" (the condition builder remains the source of truth).

## Graph model

Derivation is a single pure function, kept DOM-free so it is unit-testable in isolation:

```
deriveFlowGraph(content: TerminalContent): FlowGraph

FlowGraph = {
  nodes:      { id, hasLogin, hasVariants, hasInput, hasOnEnter, snippet }[]
  edges:      { from, to, kind, label }[]      // kind: 'direct' | 'cond' | 'back' | 'broken'
  entryId:    'start' | null                   // null + warning if no 'start' node
  unreachable: string[]                        // node ids no path from entryId reaches
  broken:      { from, to }[]                   // edges whose `to` is not a node id
}
```

**Edge extraction** walks, for each node:
- `node.choices[].target` — `label` = choice label; `kind` = `cond` if the choice has a `when`, else `direct`.
- `node.variants[].choices[].target` — always `cond` (guarded by the variant's `when` / default).
- `node.components[](input).branches[].target` — `cond` (each branch is condition/default guarded).
- `node.variants[].components[].branches[].target` — `cond`.

Post-passes: `kind='broken'` when `to ∉ nodeIds`; `kind='back'` when the edge closes a cycle (target already on the DFS stack); reachability = BFS from `entryId` → everything unvisited is `unreachable`.

## Decisions

### D1. Derive from the form, own no new state
The graph is recomputed from `form.getRawValue()` (via the existing `toContent` mapper) rather than maintained as a parallel model. There is exactly one source of truth; add/remove a node or edit a target and the graph follows. Cost: a recompute per relevant change — mitigated by D7.
**Alternatives considered:** a mutable graph model kept in sync with the form (rejected — two sources of truth, drift bugs); deriving from persisted content on save only (rejected — preview would lie about unsaved edits, defeating the point).

### D2. `dagre` for layout, custom SVG for rendering
`dagre` computes node positions for a left-to-right DAG (handles crossings and back-edges); we render our own SVG nodes and edges so styling stays on `bo-*` tokens. Layout and rendering stay separate, so zoom/theme are ours to control.
**Alternatives considered:** hand-rolled layered layout (viable at current scale, 0 dep, but we would own crossing/back-edge routing as terminals grow — kept as the documented fallback); a full graph library such as `ngx-graph` / cytoscape (rejected — ~180–400 kb and opinionated chrome/styling to fight; buys pan/zoom we don't need in v1). The derivation core (D1) is layout-agnostic, so swapping dagre ↔ hand-rolled later touches only the positioning step.

### D3. Left-to-right, `start` leftmost
Reads like a pipeline; `dagre` `rankdir: 'LR'` with `start` pinned to rank 0. The canvas sits in an `overflow-x: auto` container so a wide flow scrolls horizontally without pushing the page sideways.

### D4. Graph drives the accordions (two-way highlight)
Clicking a graph node calls the nodes-section's programmatic open for that id → the card expands and `scrollIntoView`s, and the graph marks that node active. Conversely, the currently-open card is the active node in the graph. This is what makes collapse-by-default usable instead of a hunt.
**Alternatives considered:** read-only graph decoupled from the list (rejected — with cards collapsed by default you'd navigate blind).

### D5. Surface entry / unreachable / broken as first-class visuals
- **Entry**: `start` gets an accent border + "start" tag. If no `start` node exists, show a panel-level warning (the emulator would fail to boot).
- **Unreachable**: dimmed, dashed border, "irraggiungibile" pill.
- **Broken target**: rendered as a red dashed *ghost* box (it is not a real node) with a broken edge into it, plus a `target rotto` pill on the source node's accordion row so it's fixable from the list too.

### D6. Visual encoding
Node badges are letter pills (not emoji, for crisp theme-aware rendering): `L` login gate, `V` variants, `I` input component, `E` on_enter. Edge stroke: solid = direct choice, dashed = conditional (`when`/variant/branch), faint dotted = back-edge/cycle, red dashed = broken. Edge labels (choice label, truncated) sit at the mid-point and brighten on hover.

### D7. Reactive but debounced recompute, `OnPush`
The component recomputes on `form.valueChanges` debounced (~150 ms) and on node add/remove. Between recomputes nothing mutates the graph. The component is `ChangeDetectionStrategy.OnPush`; derivation output is a plain immutable object so change detection is a reference check.

### D8. Panel is collapsible; v1 has no zoom
The whole preview collapses from its header (like other editor sections). Within it, v1 relies on the scrollable canvas; pan/zoom is deferred and, when added, is a single `transform` on the SVG group — no dependency and no layout change (see D2).

## Data flow

```
form (reactive tree)
  │  valueChanges (debounced) + add/remove node
  ▼
toContent(raw)  ──►  deriveFlowGraph(content)  ──►  FlowGraph  ──►  dagre layout (LR)
                                                        │                    │
                                                        ▼                    ▼
                                              broken / unreachable      positions
                                                        └─────────┬──────────┘
                                                                  ▼
                                                     <app-terminal-flow-graph>  (themed SVG)
                                                                  │ click node id
                                                                  ▼
                                                     nodes-section.openNode(id)  ──► expand + scrollIntoView
```
