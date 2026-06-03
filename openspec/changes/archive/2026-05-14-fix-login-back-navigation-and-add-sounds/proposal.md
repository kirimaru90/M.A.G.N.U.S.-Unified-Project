## Why

The login screen's back button always calls `initBoot()`, losing the user's navigation position when a node-level login gate is dismissed. Additionally, there is no audio feedback during typing or button interaction, making the terminal feel less immersive.

## What Changes

- The `[ Torna al menu ]` button inside the login overlay SHALL navigate back to the previous node in `navigationHistory` when the login block belongs to a node (not the root). It SHALL call `initBoot()` only when the login is root-level (`terminalData.login`).
- A startup sound SHALL play once when `initBoot()` runs (terminal boot screen initialises).
- A data-terminal sound SHALL play once when `startSystem()` runs (a data file has been loaded and the session begins).
- A typing sound SHALL play in a continuous loop while the typewriter effect is rendering text. The loop starts in two situations: immediately after the click sound when a `.choice-btn` is pressed, and immediately after the data-terminal sound when a file session begins via `startSystem()`. The loop stops when the typewriter completes.
- A hover sound and a click sound SHALL play when the user interacts with `.choice-btn` buttons.
- All five sound behaviours SHALL fail silently if the corresponding audio files are absent (no console errors, no broken UI).

## Capabilities

### New Capabilities

- `terminal-sound-effects`: Ambient audio feedback — startup sound on boot, data-terminal sound when a file session begins, a looping typing sound that runs while text is being typed, and click/hover sounds on `.choice-btn` buttons; all loaded from optional static files with graceful no-op fallback when files are missing.

### Modified Capabilities

- `login-access-control`: The back button in the login overlay now navigates to the previous node (via `navigationHistory`) when the login is node-level, and only calls `initBoot()` when the login is root-level.

## Impact

- `index.html`: `showLoginView` gains a `isRootLogin` boolean parameter; two factory helpers (`createSound` for one-shots, `createLoopSound` for looping audio) replace the old `<audio id="type-sound">` element; `.choice-btn` elements get hover and click listeners (click also starts the typing loop); `initBoot()` plays the startup sound on entry; `startSystem()` plays the data-terminal sound on entry; the typewriter's completion callback stops the typing loop.
- No new dependencies — audio loaded via `new Audio()` from relative paths in `suoni/`.
- No changes to the JSON content schema or the manifest format.
- Content-creator workflow is unaffected — no authoring changes required.
