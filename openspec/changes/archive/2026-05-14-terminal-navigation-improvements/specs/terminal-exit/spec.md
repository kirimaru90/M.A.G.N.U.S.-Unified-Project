## ADDED Requirements

### Requirement: Disconnect button visible only at root node
The system SHALL render a "disconnect terminal" button in the choices panel if and only if the user is at the root node (`navigationHistory.length === 1`). The button SHALL be visually separated from narrative choices by a `---` separator element and styled with reduced opacity (0.5) and no text-shadow, distinguishing it as a system action rather than a narrative choice.

#### Scenario: Disconnect button appears at start node
- **WHEN** the user is at the `start` node (navigationHistory has exactly 1 entry)
- **THEN** a "disconnect terminal" button SHALL appear below a `---` separator, after all narrative choices

#### Scenario: Disconnect button absent at deeper nodes
- **WHEN** the user is at any node other than `start` (navigationHistory has more than 1 entry)
- **THEN** no disconnect button SHALL be rendered in the choices panel

### Requirement: Disconnect resets state and returns to boot screen
Clicking the disconnect button SHALL fully reset all terminal session state and return the user to the boot screen.

#### Scenario: Full state reset on disconnect
- **WHEN** the user clicks the disconnect button
- **THEN** `terminalData` SHALL be reset to `{}`, `navigationHistory` SHALL be reset to `[]`, `seenNodes` SHALL be reset to an empty Set, `terminalContainer` SHALL be hidden, `bootScreen` SHALL be shown, and `initBoot()` SHALL be called to rebuild the boot screen

#### Scenario: Disconnect is not available mid-navigation
- **WHEN** the user has navigated to any node beyond `start`
- **THEN** the only navigation options SHALL be the node's choices and the "go back" button
