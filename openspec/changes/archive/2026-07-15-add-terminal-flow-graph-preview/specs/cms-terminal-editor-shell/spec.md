## ADDED Requirements

### Requirement: Editor hosts the flow-graph preview wired to the nodes list
The terminal editor SHALL render the flow-graph preview panel between the fictional-users section and the nodes section. The graph SHALL be fed from the same reactive form the sections edit (derived from the form content, recomputed on relevant form changes), so it stays consistent with unsaved edits. The editor SHALL connect the graph's node-selection to the nodes editor's `openNode(id)`, and SHALL reflect the currently-open node card back to the graph as its active node.

#### Scenario: Graph panel is positioned between users and nodes
- **WHEN** the editor renders for an existing terminal
- **THEN** the flow-graph panel appears after `app-fictional-users-section` and before `app-nodes-section`

#### Scenario: Clicking a graph node opens its card
- **WHEN** the author clicks a node in the flow-graph preview
- **THEN** the editor calls the nodes editor's `openNode` for that id and the matching node card expands

#### Scenario: Graph reflects unsaved edits
- **WHEN** the author adds a node or edits a choice `target` without saving
- **THEN** the flow-graph preview updates to reflect the current, unsaved form content
