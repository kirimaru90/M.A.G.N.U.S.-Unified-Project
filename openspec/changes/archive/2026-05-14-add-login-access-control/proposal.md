## Why

Content creators need to restrict access to specific terminal entries or branching paths (terminalData) behind per-user credentials, enabling password-gated narrative sections that fit naturally within the Fallout universe's secure terminal aesthetic. This feature is purely data-driven — no engine changes are required beyond reading new JSON fields.

## What Changes

- New `login` field on root objects and individual `entries`/`terminalData` nodes in olonastro JSON files, defining which users may access that resource.
- A dedicated **Login View** rendered before the protected content when an unauthenticated user attempts to navigate to a restricted node.
- A session-level login state that persists across navigation within a single session, so a logged-in user is not re-prompted on subsequent visits to the same protected node.
- A status message ("Utente [username] connesso") displayed with a 2-second delay when an already-authenticated user navigates to a protected node.
- Typing speed for the login acknowledgement message is 50% faster than the default terminal typewriter effect.

## Capabilities

### New Capabilities

- `login-access-control`: JSON schema extension (`login` field) and session-aware authentication gate that blocks navigation to protected entries or terminalData until valid credentials are provided via a dedicated login view.

### Modified Capabilities

- `file-error-back-navigation`: No requirement changes; navigation flow is unaffected structurally, though the login gate inserts a new intermediate view in the navigation stack.

## Impact

- **`index.html`** (engine): New login view rendering logic, credential validation, session state management, and conditional typing-speed override. This cannot be achieved via content alone — engine changes are required.
- **JSON content files** (`dati/*.json`): New optional `login` field at root or node level; backward-compatible (existing files without `login` are unaffected).
- **Content creator workflow**: Authors add a `login` block to any entry or terminalData to gate it; they define `users` as an array of `{username, password}` objects.
- **No new dependencies**: All logic remains in vanilla JS within `index.html`.
