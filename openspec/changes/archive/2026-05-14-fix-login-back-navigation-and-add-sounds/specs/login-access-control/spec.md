## MODIFIED Requirements

### Requirement: Login intercept view
When a user navigates to a protected node and no user from that node's `login.users` is currently authenticated, the engine SHALL display a dedicated login overlay before rendering the node content.

The login view SHALL contain:
- A heading `ACCESSO RISERVATO`
- A `<select>` element pre-populated with the usernames from `login.users`; the user may select but not type a username
- A `<input type="password">` field for entering the password
- A submit button labelled `[ ACCEDI ]`
- An error line (hidden initially) labelled `CREDENZIALI NON VALIDE`
- A back button labelled `[ Torna al menu ]` whose behaviour depends on whether the login block is root-level or node-level (see scenarios below)

#### Scenario: Login view appears on first access to protected node
- **WHEN** `loadNode` is called for a node that has a `login` field
- **AND** no user from `login.users` is present in the session's authenticated user set
- **THEN** the login overlay SHALL be shown, covering the terminal content
- **THEN** the node's text and choices SHALL NOT be rendered until credentials are validated

#### Scenario: Correct credentials submitted
- **WHEN** the user selects a username and enters the matching password
- **AND** the user clicks `[ ACCEDI ]`
- **THEN** the engine SHALL add that username to the session's authenticated user set
- **THEN** the login overlay SHALL be hidden
- **THEN** the engine SHALL render the protected node normally

#### Scenario: Incorrect password submitted
- **WHEN** the user clicks `[ ACCEDI ]` with a password that does not match the selected username
- **THEN** the `CREDENZIALI NON VALIDE` error line SHALL become visible
- **THEN** the login overlay SHALL remain visible; no node content SHALL be rendered

#### Scenario: Back button on root-level login view
- **WHEN** the active login block is `terminalData.login` (root-level gate)
- **AND** the user clicks `[ Torna al menu ]` on the login overlay
- **THEN** the login overlay SHALL be hidden
- **THEN** `initBoot()` SHALL be called, returning the user to the boot/file-selection screen

#### Scenario: Back button on node-level login view — previous node exists
- **WHEN** the active login block belongs to an individual node (not the root)
- **AND** `navigationHistory` contains at least one prior node
- **AND** the user clicks `[ Torna al menu ]` on the login overlay
- **THEN** the login overlay SHALL be hidden
- **THEN** the engine SHALL pop the current node from `navigationHistory` and navigate to the previous node using `loadNode(previousNode, true)`

#### Scenario: Back button on node-level login view — no previous node
- **WHEN** the active login block belongs to an individual node
- **AND** `navigationHistory` is empty or contains only the current node (no reachable prior node)
- **AND** the user clicks `[ Torna al menu ]`
- **THEN** the login overlay SHALL be hidden
- **THEN** `initBoot()` SHALL be called as a safe fallback
