## ADDED Requirements

### Requirement: Node cards are collapsible and collapsed by default
Each node card in the nodes editor SHALL be a collapsible accordion with a header (showing the node id and its badges) and a body (the node editor). Cards SHALL be **collapsed by default** when the editor loads. Toggling a card's header SHALL expand or collapse only that card; other cards SHALL be unaffected. Collapsing a card SHALL NOT alter the node's form state or validity — an invalid node stays invalid while collapsed.

#### Scenario: Cards start collapsed
- **WHEN** the editor loads a terminal with several nodes
- **THEN** every node card renders collapsed, showing its header (id + badges) but not its body

#### Scenario: Toggling one card leaves others alone
- **WHEN** the author expands the `menu` card
- **THEN** the `menu` body becomes visible and all other cards remain collapsed

#### Scenario: Collapsed invalid node stays invalid
- **WHEN** a node with a duplicate id is collapsed
- **THEN** the form remains invalid for save and the duplicate-id error is preserved

### Requirement: Nodes editor exposes a programmatic open
The nodes editor SHALL expose a programmatic `openNode(id)` that expands the card for the node with that id and scrolls it into view, marking it the active card. This lets the flow-graph preview reveal a node on click. Calling `openNode` for an id with no matching card SHALL be a no-op.

#### Scenario: openNode expands and scrolls
- **WHEN** `openNode('door_check')` is called while that card is collapsed
- **THEN** the `door_check` card expands, scrolls into view, and is marked active

#### Scenario: openNode for unknown id is a no-op
- **WHEN** `openNode('does_not_exist')` is called
- **THEN** no card changes state and no error is raised

### Requirement: Node card flags a broken outgoing target
A node card whose node has an outgoing `target` that matches no existing node id SHALL show a broken-target marker on its header, so the problem is fixable from the list as well as visible in the graph.

#### Scenario: Broken-target pill on the card header
- **WHEN** node `menu` has a choice targeting `vault_doorX` and no node has that id
- **THEN** the `menu` card header shows a broken-target marker
