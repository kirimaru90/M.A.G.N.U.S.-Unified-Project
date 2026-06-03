## Why

Once a terminal experience is loaded, there is no way for the user to exit back to the main menu or navigate choices without a mouse. This creates usability gaps: users who finish an experience are stranded inside it, and keyboard-only interaction is impossible.

## What Changes

- Add a "disconnect terminal" system button that automatically appears at the `start` node, visually separated from narrative choices, allowing users to return to the boot screen
- Add full keyboard navigation for the choices panel: ArrowUp/ArrowDown to move focus, Enter to confirm, Escape to go back (or exit to boot screen when at `start`)

## Capabilities

### New Capabilities

- `terminal-exit`: A discrete system-level exit mechanism that resets terminal state and returns to the boot screen, available only from the root node
- `keyboard-navigation`: Keyboard control of the choices panel (arrow keys, Enter, Escape) with focus wrapping and automatic focus on first render

### Modified Capabilities

<!-- No existing spec-level behavior changes -->

## Impact

- `index.html`: All changes are confined to this single file — CSS additions for focus/exit button styles, and JS changes to `showChoices()` and related functions
- No impact on JSON content format or authoring workflow
- No impact on the login flow, boot screen, or sound system
