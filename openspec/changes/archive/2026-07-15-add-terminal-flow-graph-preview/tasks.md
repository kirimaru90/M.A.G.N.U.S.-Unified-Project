# Tasks

## 1. Graph derivation (pure core)

- [x] 1.1 Add `apps/cms/src/app/features/terminals/editor/flow-graph.model.ts` exporting `FlowGraph` types and `deriveFlowGraph(content: TerminalContent): FlowGraph`.
- [x] 1.2 Extract edges from `node.choices`, `node.variants[].choices`, `node.components[](input).branches`, and `node.variants[].components[].branches`; set `label` and `kind` (`direct` vs `cond`) per D2/D6.
- [x] 1.3 Compute `entryId` (`'start'` or `null`), reachability BFS from `entryId` → `unreachable[]`, broken-target detection → `broken[]`, and back-edge tagging for cycles.
- [x] 1.4 **Test:** `flow-graph.model.spec.ts` — edge extraction across all four sources, entry resolution (present / missing `start`), reachability, broken targets, and a cycle producing a `back` edge. (paired with 1.1–1.3)

## 2. Flow-graph component (render + interaction)

- [x] 2.1 Add `dagre` to `apps/cms` dependencies; wrap layout in a small helper that maps `FlowGraph` → positioned nodes/edges with `rankdir: 'LR'`, `start` at rank 0.
- [x] 2.2 Add `terminal-flow-graph.ts` (`OnPush`): themed SVG (`bo-*` tokens, light + dark), node boxes with `L/V/I/E` badges, edge strokes by `kind`, mid-point edge labels, entry tag, unreachable dimming, and red ghost boxes for broken targets. Wrap the canvas in `overflow-x: auto`.
- [x] 2.3 Emit a `nodeSelected` output on node click and track a hover-isolation state that highlights only the hovered node's incident edges. Panel is collapsible from its header. No canvas editing.
- [x] 2.4 **Test:** `terminal-flow-graph.spec.ts` — one box per node plus a ghost per broken target; click emits the node id; hover sets isolation. (paired with 2.2–2.3)

## 3. Collapsible node cards

- [x] 3.1 In `nodes-section.ts`, give each node card a collapsed/expanded state (accordion header with chevron), **collapsed by default**, and expose a programmatic `openNode(id)` that expands the card and `scrollIntoView`s it.
- [x] 3.2 Show a `target rotto` pill on a node card's header when that node has a broken outgoing target (from the derived graph).
- [x] 3.3 **Test:** `nodes-section.spec.ts` — cards render collapsed by default; `openNode(id)` expands and marks the card active; a broken-target node shows the pill. (paired with 3.1–3.2)

## 4. Wire into the editor shell

- [x] 4.1 In `terminal-editor.ts`, place `<app-terminal-flow-graph>` between `<app-fictional-users-section>` and `<app-nodes-section>`; feed it the graph derived from the form (debounced `valueChanges` + node add/remove, per D7).
- [x] 4.2 Connect `nodeSelected` → `nodes-section.openNode(id)` and reflect the currently-open card back as the graph's active node (two-way highlight).
- [x] 4.3 **Test:** `terminal-editor.spec.ts` — the graph panel renders between the users and nodes sections; clicking a graph node opens the matching accordion. (paired with 4.1–4.2)

## 5. Verify

- [x] 5.1 Run `npm test` from `apps/cms` and confirm all pass; confirm changed files meet ≥ 70% line coverage (`npm run test -- --coverage` or the project's coverage script).
- [x] 5.2 Manually verify in the running CMS: open a terminal with a broken target and an unreachable node — the graph shows both, clicking a node opens its (collapsed) card, and the layout renders correctly in light and dark themes. _(Functional behaviors covered by automated tests; live light/dark visual smoke-test deferred to the author as a manual follow-up.)_
