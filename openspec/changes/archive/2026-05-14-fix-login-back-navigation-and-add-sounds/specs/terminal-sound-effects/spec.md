## ADDED Requirements

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

### Requirement: Startup sound on boot screen initialisation
The engine SHALL play the startup sound once at the beginning of `initBoot()`. The sound SHALL be loaded from `suoni/init.mp3`. If the file is absent or playback is blocked, `initBoot()` SHALL continue normally with no error.

#### Scenario: Startup sound plays on page load
- **WHEN** the page loads and `window.onload` fires `initBoot()`
- **THEN** the startup sound SHALL play once at the start of `initBoot()`
- **THEN** the boot screen UI SHALL render normally regardless of whether the sound played

#### Scenario: Startup sound plays on return to boot screen
- **WHEN** `initBoot()` is called again (e.g., via a "[ Torna al menu ]" button)
- **THEN** the startup sound SHALL play again

#### Scenario: Startup sound file absent
- **WHEN** `suoni/init.mp3` does not exist
- **THEN** `initBoot()` SHALL complete normally with no error or console warning

---

### Requirement: Data-terminal sound and typing loop on session start
The engine SHALL play the data-terminal sound once at the start of `startSystem()`, immediately followed by starting the typing sound loop. The data-terminal sound SHALL be loaded from `suoni/data_terminal.mp3`. The typing sound loop runs from this point until the first `renderNode` typewriter animation completes.

#### Scenario: Data-terminal sound and typing loop start when a file is loaded
- **WHEN** `loadServerFile` successfully fetches and parses a JSON file and calls `startSystem()`
- **THEN** the data-terminal sound SHALL play once
- **THEN** the typing sound loop SHALL start immediately after
- **THEN** the terminal session SHALL begin normally regardless of whether either sound played

#### Scenario: Typing loop stops when first render completes
- **WHEN** `renderNode` finishes typing the node text via `typeWriterHTML`
- **THEN** `typingSound.stop()` SHALL be called before `showChoices` renders the buttons

#### Scenario: Data-terminal sound file absent
- **WHEN** `suoni/data_terminal.mp3` does not exist
- **THEN** `startSystem()` SHALL complete normally with no error or console warning

---

### Requirement: Typing sound loop on choice button click
Every `.choice-btn` element created during `showChoices` (choice buttons and the back button) SHALL have a `click` listener that plays the click sound once and then starts the typing sound loop. The loop runs until the subsequent `renderNode` typewriter animation completes.

#### Scenario: Click triggers click sound then typing loop
- **WHEN** the user clicks a `.choice-btn`
- **THEN** the click sound SHALL play once
- **THEN** the typing sound loop SHALL start immediately after the click sound

#### Scenario: Typing loop stops when render completes
- **WHEN** `renderNode` finishes typing after a choice button click
- **THEN** `typingSound.stop()` SHALL be called before `showChoices` renders the buttons

#### Scenario: Sounds absent — buttons still function
- **WHEN** the sound files are missing
- **THEN** `.choice-btn` elements SHALL remain fully functional (navigation, login, back)
- **THEN** no error SHALL appear in the console or UI

---

### Requirement: Hover sound on choice buttons
Every `.choice-btn` element created during `showChoices` SHALL have a `mouseenter` listener that plays the hover sound.

#### Scenario: Hover sound on button mouseenter
- **WHEN** the user moves the pointer over a `.choice-btn`
- **THEN** the hover sound SHALL play

#### Scenario: Hover sound file absent
- **WHEN** `suoni/hover.mp3` does not exist
- **THEN** hovering over `.choice-btn` elements SHALL produce no error
