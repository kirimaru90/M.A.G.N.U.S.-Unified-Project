## Why

The current sound triggers are misaligned with the visual events they should accompany: the data-terminal sound fires too late (after loading, not during it), the typing sound starts prematurely (before any text is visible), and it incorrectly plays during login screens where no typing is occurring.

## What Changes

- `data_terminal` sound moves from `startSystem()` to `loadServerFile()` so it plays the moment a terminal file is selected, while the loading indicator is visible
- `typingSound.start()` moves from `startSystem()` and button click handlers into `renderNode()` so it plays only when a node actually begins typing
- `typingSound` is suppressed during login screens: it does not start when a node requires unauthenticated login, and only begins once the correct password is accepted and `renderNode` is invoked
- `typingSound.start()` is removed from `addBtnSounds()` click listener (sound lifecycle is fully owned by `renderNode`)
- `typingSound.stop()` remains in the `typeWriterHTML` callback inside `renderNode` (no change)

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `terminal-sound-effects`: data-terminal sound trigger moves to file-load time; typing sound lifecycle is scoped to `renderNode` only; typing sound is gated behind successful login when a node requires it

## Impact

- `index.html` (JavaScript logic only): `loadServerFile`, `startSystem`, `addBtnSounds`, `renderNode`
- No JSON schema changes, no new files, no CSS changes
- Content-creator workflow is unaffected
