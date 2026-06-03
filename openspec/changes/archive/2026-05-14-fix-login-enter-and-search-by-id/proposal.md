## Why

Two small usability bugs in the terminal UI plus one UX improvement: the login screen ignores the Enter key on the password field (requiring a mouse click); the hidden-archive search compares typed input against `nome` instead of `id`; and revisiting a node the player has already read forces them to sit through the full typewriter animation again.

## What Changes

- **Login screen Enter key**: add a `keydown` listener on `#login-password` so pressing Enter triggers the same submit logic as clicking `[ ACCEDI ]`.
- **Hidden archive search**: change the `lookupHidden` comparison from `t.nome` to `t.id` so the typed value is matched against the manifest's `id` field.
- **Fast replay typing**: when navigating to a node that has already been seen in the current session, render its text instantly (0 ms delay) instead of replaying the full typewriter animation.

## Capabilities

### New Capabilities
- `login-enter-key`: pressing Enter in the password field submits the login form
- `fast-replay-typing`: previously-seen nodes render instantly on revisit

### Modified Capabilities
- `login-access-control`: add keyboard submit path to the login intercept view
- `hidden-terminal-access`: fix manifest lookup to use `id` field instead of `nome`

## Impact

- `index.html`: three targeted JS changes — Enter listener in `showLoginView`, field name in `lookupHidden`, and a session-scoped `seenNodes` Set with speed override in `renderNode`
- No schema changes, no new files, no impact on JSON authoring workflow
