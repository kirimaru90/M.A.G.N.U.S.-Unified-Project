## Why

When fetching the manifest or loading a data file fails, the terminal replaces the boot screen with a static error message and traps the user — the only recovery is a full page reload. Adding a "go back" action on error screens lets users return to the file selection menu without leaving the terminal.

## What Changes

- Error screen displayed when manifest fetch fails now includes a button to reload/retry the boot sequence.
- Error screen displayed when a data file fails to load now includes a button to return to the file-selection menu (boot screen with tape list).
- No structural changes to the node navigation (`loadNode` / `goBack`) or the narrative flow.

## Capabilities

### New Capabilities

- `file-error-back-navigation`: Error screens shown during file loading expose a recovery action ("Torna al menu") that returns the user to the boot/file-selection screen without a full page reload.

### Modified Capabilities

<!-- No existing spec-level requirements are changing. -->

## Impact

- `index.html`: two `catch` blocks updated (`window.onload` manifest error handler at line 104 and `loadServerFile` error handler at line 131).
- No changes to JSON content files, manifest, CSS variables, or Docker/nginx config.
- No impact on content-creator workflow — purely a runtime UI improvement.
