## MODIFIED Requirements

### Requirement: Typing sound loop scoped to renderNode

The typing sound loop SHALL start at the entry of `renderNode()` and SHALL stop at every defined termination point: when the `typeWriterHTML` callback fires for natural completion or for a user-initiated skip; AND when the typing animation is cancelled via the abort helper (`abortCurrentTyping()` or equivalent) on any back-to-boot path. The typing sound SHALL NOT be started in `startSystem()` or in button click handlers. The typing sound SHALL only play when `renderNode` is invoked directly, ensuring it is always tied to visible text being typed.

#### Scenario: Typing sound starts when a node begins rendering

- **WHEN** `renderNode(nodeId, node)` is called
- **THEN** `typingSound.start()` SHALL be called at the entry of `renderNode`
- **THEN** the typing animation SHALL begin for that node's text

#### Scenario: Typing sound stops when typing completes naturally

- **WHEN** `typeWriterHTML` finishes rendering the node text without being skipped or cancelled
- **THEN** `typingSound.stop()` SHALL be called before `showChoices` renders the buttons

#### Scenario: Typing sound stops when user skips typing

- **WHEN** the user invokes a skip gesture (Enter, Escape, right-click, or tap) while typing is in progress
- **AND** the current typing handle's `skip()` completes the animation
- **THEN** `typingSound.stop()` SHALL be called before `showChoices` renders the buttons

#### Scenario: Typing sound stops when typing is cancelled mid-flight

- **WHEN** the abort helper is called while typing is in progress (e.g., on disconnect or login-back to boot)
- **THEN** the current typing handle's `cancel()` SHALL be invoked
- **THEN** `typingSound.stop()` SHALL be called as part of the same abort path
- **THEN** the completion callback from the cancelled animation SHALL NOT subsequently restart the typing sound

#### Scenario: Typing sound does not start in startSystem

- **WHEN** `startSystem()` is called
- **THEN** `typingSound.start()` SHALL NOT be called inside `startSystem`

#### Scenario: Typing sound does not start on button click

- **WHEN** the user clicks a `.choice-btn`
- **THEN** the click handler SHALL NOT call `typingSound.start()`
- **THEN** the typing sound SHALL only start once `renderNode` is subsequently invoked

## ADDED Requirements

### Requirement: Typing sound silenced on every back-to-boot transition

Every code path that transitions the application back to the boot screen SHALL call the abort helper (`abortCurrentTyping()` or equivalent), which guarantees `typingSound.stop()` has been called before `bootScreen.style.display = 'flex'` is applied. The abort helper SHALL also be invoked unconditionally at the entry of `initBoot()` as a defence-in-depth measure. Covered paths SHALL include at minimum: `disconnectTerminal()`, the root login's "Torna al menu" button, the catch/error fall-throughs of `initBoot` and `loadServerFile`, and any future re-entry into the boot screen.

#### Scenario: Disconnect mid-typing silences the sound on the boot screen

- **WHEN** the user triggers disconnect while the typing animation is in progress
- **THEN** the typing sound SHALL be silent by the time the boot screen is visible
- **THEN** no callback from the cancelled animation SHALL subsequently restart the typing sound

#### Scenario: Root login back-to-menu silences the sound

- **WHEN** the user clicks "[ Torna al menu ]" on the root login screen
- **AND** the previous tape had an in-flight typing animation
- **THEN** the typing sound SHALL be silent on the boot screen

#### Scenario: initBoot defensively stops the typing sound

- **WHEN** `initBoot()` is invoked
- **THEN** the abort helper SHALL be called at the entry of `initBoot`
- **THEN** `typingSound.stop()` SHALL have been called by the time the boot UI renders
- **THEN** if no typing was in flight, the call SHALL be a harmless no-op

#### Scenario: Error fall-through during loadServerFile silences the sound

- **WHEN** `loadServerFile` enters its catch block
- **AND** the previous tape had an in-flight typing animation
- **THEN** the typing sound SHALL be silent under the error UI rendered by the catch block
