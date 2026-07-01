# emulator-terminal-sound-effects Specification

## Purpose

Sound helpers with graceful fallback, startup/data-terminal/hover one-shots, a renderNode-scoped typing loop stopped on every completion/abort/back-to-boot path and suppressed during login, plus global enable and master volume.

## Requirements

### Requirement: Sound helpers with graceful fallback
The engine SHALL expose two internal factory functions. `createSound(path)` returns a zero-argument play function for one-shot sounds. `createLoopSound(path)` returns an object with `start()` and `stop()` methods for continuous looping sounds. In both cases, if the audio file at `path` is unavailable, if the browser prevents playback, or if any media-element API call throws synchronously, the returned function(s) SHALL do nothing and SHALL NOT throw or log any error.

#### Scenario: One-shot sound file present — play is called
- **WHEN** `createSound(path)` is called with a valid, accessible file path
- **AND** the returned play function is invoked
- **THEN** the audio clip SHALL begin playback from the start

#### Scenario: One-shot sound file absent — play is called
- **WHEN** `createSound(path)` is called with a path that resolves to a missing file
- **AND** the returned play function is invoked
- **THEN** no error SHALL be thrown
- **THEN** no unhandled promise rejection SHALL propagate to the console

#### Scenario: Loop sound start and stop
- **WHEN** `createLoopSound(path)` is called with a valid file path
- **AND** `start()` is called on the returned object
- **THEN** the audio clip SHALL loop continuously
- **WHEN** `stop()` is subsequently called
- **THEN** playback SHALL cease and the position SHALL reset to the beginning

#### Scenario: Browser autoplay policy blocks playback
- **WHEN** the browser's autoplay policy rejects an `Audio.play()` promise
- **THEN** the rejection SHALL be silently caught
- **THEN** the engine SHALL continue normally with no visible or console-level error

---

### Requirement: Startup sound on boot/menu screen initialisation
The engine SHALL play the startup sound once when a boot/menu screen mounts — at the beginning of `mountCampaignSelect()` and `mountTerminalList()` (the `initSound` helper). The sound SHALL be loaded from `suoni/init.mp3`. If the file is absent or playback is blocked, the screen SHALL continue mounting normally with no error.

#### Scenario: Startup sound plays on entry to the first menu screen
- **WHEN** the app boots and the first menu screen mounts (`mountCampaignSelect()`, or `mountTerminalList()` when landing directly on a campaign)
- **THEN** the startup sound SHALL play once at the start of that mount
- **THEN** the menu UI SHALL render normally regardless of whether the sound played

#### Scenario: Startup sound plays on return to the menu
- **WHEN** a boot/menu screen is mounted again (e.g., via a "[ Torna al menu ]" / back action that re-runs `mountTerminalList()` or `mountCampaignSelect()`)
- **THEN** the startup sound SHALL play again

#### Scenario: Startup sound file absent
- **WHEN** `suoni/init.mp3` does not exist
- **THEN** the boot/menu screen mount SHALL complete normally with no error or console warning

---

### Requirement: Data-terminal sound on file selection
The engine SHALL play the data-terminal sound once at the start of `playTerminalData()`, while the "ESTRAZIONE DATI IN CORSO…" loading indicator is visible. The data-terminal sound SHALL be loaded from `suoni/data_terminal.mp3` (the `dataTerminalSound` helper). The node-render path (`terminal.loadNode('start')`) SHALL NOT separately play the data-terminal sound.

#### Scenario: Data-terminal sound plays when a terminal is selected
- **WHEN** the user selects a terminal from the terminal-list menu
- **AND** `playTerminalData` is invoked with the loaded terminal data
- **THEN** the data-terminal sound SHALL play once immediately at the start of `playTerminalData`
- **THEN** the loading indicator "ESTRAZIONE DATI IN CORSO…" SHALL be visible while the sound plays

#### Scenario: Data-terminal sound does not replay on node render
- **WHEN** `terminal.loadNode('start')` runs to render the first node after a successful load
- **THEN** `dataTerminalSound()` SHALL NOT be called again by the node-render path

#### Scenario: Data-terminal sound file absent
- **WHEN** `suoni/data_terminal.mp3` does not exist
- **THEN** `playTerminalData()` SHALL complete normally with no error or console warning

---

### Requirement: Typing sound loop scoped to renderNode

The typing sound loop SHALL start at the entry of `renderNode()` and SHALL stop at every defined termination point: when the `typeWriterHTML` callback fires for natural completion or for a user-initiated skip; AND when the typing animation is cancelled via the abort helper (`abortCurrentTyping()` or equivalent) on any back-to-boot path. The typing sound SHALL NOT be started by the terminal-load path (`playTerminalData()`) or in button click handlers. The typing sound SHALL only play when `renderNode` is invoked directly, ensuring it is always tied to visible text being typed.

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

#### Scenario: Typing sound does not start on terminal load

- **WHEN** `playTerminalData()` is called to load a terminal
- **THEN** `typingSound.start()` SHALL NOT be called by the load path (only later, when `renderNode` runs)

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
- **WHEN** `playTerminalData` finds a top-level `login` block in the terminal data
- **AND** the user is not already logged in
- **THEN** the login screen SHALL be displayed before the start node is rendered
- **THEN** `typingSound.start()` SHALL NOT be called until `renderNode` is invoked after login success

---

### Requirement: Hover sound on choice buttons
Every `.choice-btn` element created during `showChoices` SHALL have a `mouseenter` listener that plays the hover sound.

#### Scenario: Hover sound on button mouseenter
- **WHEN** the user moves the pointer over a `.choice-btn`
- **THEN** the hover sound SHALL play

#### Scenario: Hover sound file absent
- **WHEN** `suoni/hover.mp3` does not exist
- **THEN** hovering over `.choice-btn` elements SHALL produce no error

---

### Requirement: Typing sound silenced on every back-to-boot transition

Every code path that transitions the application back to the boot/menu screen SHALL call the abort helper (`abortCurrentTyping()` or equivalent), which guarantees `typingSound.stop()` has been called before the boot/menu screen is shown. The abort helper SHALL also be invoked when the app returns to a menu screen (e.g., `showCampaignSelect()` calls it at its entry before `mountCampaignSelect()`) as a defence-in-depth measure. Covered paths SHALL include at minimum: `disconnectTerminal()`, the root login's "Torna al menu" button, the catch/error fall-throughs of the terminal-load path (`playTerminalData` / `handleTerminalSelected`), and any future re-entry into the boot/menu screen.

#### Scenario: Disconnect mid-typing silences the sound on the boot screen

- **WHEN** the user triggers disconnect while the typing animation is in progress
- **THEN** the typing sound SHALL be silent by the time the boot screen is visible
- **THEN** no callback from the cancelled animation SHALL subsequently restart the typing sound

#### Scenario: Root login back-to-menu silences the sound

- **WHEN** the user clicks "[ Torna al menu ]" on the root login screen
- **AND** the previous tape had an in-flight typing animation
- **THEN** the typing sound SHALL be silent on the boot screen

#### Scenario: Returning to the menu defensively stops the typing sound

- **WHEN** the app transitions back to a menu screen (e.g., `showCampaignSelect()` runs before `mountCampaignSelect()`)
- **THEN** the abort helper SHALL be called as part of that transition
- **THEN** `typingSound.stop()` SHALL have been called by the time the menu UI renders
- **THEN** if no typing was in flight, the call SHALL be a harmless no-op

#### Scenario: Error fall-through during terminal load silences the sound

- **WHEN** `playTerminalData` (or `handleTerminalSelected`) enters its catch block
- **AND** the previous tape had an in-flight typing animation
- **THEN** the typing sound SHALL be silent under the error UI rendered by the catch block

---

### Requirement: Global sound enable switch
The sound engine SHALL expose a global enable flag and a `setSoundEnabled(boolean)`
setter, initialized from `soundEnabled` in the active configuration. When sound is
disabled, every one-shot `play()` and every loop `start()` SHALL become a no-op and
SHALL NOT begin or resume playback. Disabling sound while a loop is playing SHALL
stop it.

#### Scenario: Disabled sound suppresses playback
- **WHEN** `setSoundEnabled(false)` has been called
- **AND** any sound's `play()` or a loop's `start()` is invoked
- **THEN** no audio SHALL be produced
- **THEN** no error SHALL be thrown

#### Scenario: Re-enabling restores playback
- **WHEN** `setSoundEnabled(true)` is called after being disabled
- **AND** a sound's `play()` is invoked
- **THEN** the audio clip SHALL play normally

#### Scenario: Disabling stops an active loop
- **WHEN** a loop sound is playing and `setSoundEnabled(false)` is called
- **THEN** the loop SHALL stop

---

### Requirement: Master sound volume
The sound engine SHALL expose `setSoundVolume(level)` where `level` is clamped to
`0.0–1.0`, initialized from `soundVolume` in the active configuration. The current
volume SHALL be applied to each audio element's `volume` before playback so all
sounds honor the master level.

#### Scenario: Volume applied to playback
- **WHEN** `setSoundVolume(0.5)` has been called
- **AND** any sound is played
- **THEN** that sound's audio element `volume` SHALL be `0.5` during playback

#### Scenario: Volume is clamped
- **WHEN** `setSoundVolume` is called with a value outside `0.0–1.0`
- **THEN** the applied volume SHALL be clamped into the `0.0–1.0` range
