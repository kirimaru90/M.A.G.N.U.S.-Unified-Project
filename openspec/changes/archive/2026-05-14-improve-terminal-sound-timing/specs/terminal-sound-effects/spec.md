## MODIFIED Requirements

### Requirement: Data-terminal sound on file selection
The engine SHALL play the data-terminal sound once at the start of `loadServerFile()`, before the fetch begins, while the "ESTRAZIONE DATI IN CORSO…" loading indicator is visible. The data-terminal sound SHALL be loaded from `suoni/data_terminal.mp3`. `startSystem()` SHALL no longer play the data-terminal sound.

#### Scenario: Data-terminal sound plays when a file is selected
- **WHEN** the user selects a terminal file from the boot menu
- **AND** `loadServerFile` is invoked
- **THEN** the data-terminal sound SHALL play once immediately, before the fetch
- **THEN** the loading indicator "ESTRAZIONE DATI IN CORSO…" SHALL be visible while the sound plays

#### Scenario: Data-terminal sound does not play in startSystem
- **WHEN** `startSystem()` is called after a successful file load
- **THEN** `dataTerminalSound()` SHALL NOT be called inside `startSystem`

#### Scenario: Data-terminal sound file absent
- **WHEN** `suoni/data_terminal.mp3` does not exist
- **THEN** `loadServerFile()` SHALL complete normally with no error or console warning

---

### Requirement: Typing sound loop scoped to renderNode
The typing sound loop SHALL start at the entry of `renderNode()` and stop when the `typeWriterHTML` callback fires (before `showChoices`). The typing sound SHALL NOT be started in `startSystem()` or in button click handlers. The typing sound SHALL only play when `renderNode` is invoked directly, ensuring it is always tied to visible text being typed.

#### Scenario: Typing sound starts when a node begins rendering
- **WHEN** `renderNode(nodeId, node)` is called
- **THEN** `typingSound.start()` SHALL be called at the entry of `renderNode`
- **THEN** the typing animation SHALL begin for that node's text

#### Scenario: Typing sound stops when typing completes
- **WHEN** `typeWriterHTML` finishes rendering the node text
- **THEN** `typingSound.stop()` SHALL be called before `showChoices` renders the buttons

#### Scenario: Typing sound does not start in startSystem
- **WHEN** `startSystem()` is called
- **THEN** `typingSound.start()` SHALL NOT be called inside `startSystem`

#### Scenario: Typing sound does not start on button click
- **WHEN** the user clicks a `.choice-btn`
- **THEN** the click handler SHALL NOT call `typingSound.start()`
- **THEN** the typing sound SHALL only start once `renderNode` is subsequently invoked

---

### Requirement: Typing sound suppressed during login screens
The typing sound SHALL NOT play while a login screen is displayed. When a node requires authentication and the user is not yet logged in, `loadNode` shows the login view without invoking `renderNode`, so the typing sound loop SHALL remain silent. After the correct password is submitted and `renderNode` is called, the typing sound SHALL start normally.

#### Scenario: Typing sound silent when login is required and user is not authenticated
- **WHEN** `loadNode` is called for a node with a `login` block
- **AND** the user is not already logged in
- **THEN** the login screen SHALL be displayed
- **THEN** `typingSound.start()` SHALL NOT be called

#### Scenario: Typing sound starts after successful login
- **WHEN** the user submits the correct password on the login screen
- **AND** `renderNode` is subsequently called for the protected node
- **THEN** `typingSound.start()` SHALL be called at the entry of `renderNode`
- **THEN** the typing animation SHALL play normally

#### Scenario: Typing sound silent when root login is required at system start
- **WHEN** `loadServerFile` finds a top-level `login` block in the terminal data
- **AND** the user is not already logged in
- **THEN** the login screen SHALL be displayed before `startSystem` is called
- **THEN** `typingSound.start()` SHALL NOT be called until `renderNode` is invoked after login success
