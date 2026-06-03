### Requirement: Session-scoped seen-nodes tracking
The engine SHALL maintain a session-scoped Set of node IDs (`seenNodes`) that have been rendered at least once. This Set SHALL be initialised empty at page load, populated whenever `renderNode` is called, and SHALL NOT be persisted across page reloads.

#### Scenario: seenNodes initialised empty
- **WHEN** the page loads
- **THEN** `seenNodes` SHALL be empty

#### Scenario: Node added to seenNodes on first render
- **WHEN** `renderNode` is called for a node with id `X` for the first time in the session
- **THEN** `X` SHALL be added to `seenNodes` before the typewriter animation begins

#### Scenario: seenNodes cleared on page reload
- **WHEN** the user reloads the page
- **THEN** `seenNodes` SHALL be empty and all nodes SHALL be treated as unseen

---

### Requirement: Instant text rendering for previously-seen nodes
When `renderNode` is called for a node whose id is already in `seenNodes`, the engine SHALL render the node's text content at 0 ms per character (instant display) instead of the standard `typingSpeed`.

#### Scenario: Revisited node renders instantly
- **WHEN** `renderNode` is called for a node id that is already in `seenNodes`
- **THEN** the full text content SHALL appear in the terminal without a visible typewriter delay
- **THEN** choices SHALL be shown immediately after the text appears

#### Scenario: First-visit node renders at normal speed
- **WHEN** `renderNode` is called for a node id that is NOT in `seenNodes`
- **THEN** the text SHALL be rendered at the standard `typingSpeed` (15 ms per character)

#### Scenario: Back-navigation to a seen node renders instantly
- **WHEN** the player presses `[ Torna al menu precedente ]` and `goBack()` calls `loadNode` for a previously-visited node
- **THEN** that node's text SHALL render instantly (it is already in `seenNodes`)

#### Scenario: seenNodes persists across forward-and-back cycles
- **WHEN** the player navigates forward to node A (first visit), then back, then forward to node A again
- **THEN** on the second visit to A, text SHALL render instantly
