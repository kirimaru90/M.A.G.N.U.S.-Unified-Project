## ADDED Requirements

### Requirement: Login block in olonastro JSON schema
The olonastro JSON schema SHALL support an optional `login` field on the root object and on any individual node object. When present, the `login` field SHALL have the following structure:

```json
"login": {
  "users": [
    { "username": "<string>", "password": "<string>" }
  ]
}
```

A `login` field on the root object gates the entire file (applied before the `"start"` node is shown). A `login` field on an individual node gates only that node. Node-level `login` takes precedence over root-level `login` for that specific node.

#### Scenario: Valid login block on root object
- **WHEN** the loaded JSON contains a `login.users` array at the root level
- **THEN** the engine SHALL treat the entire file as protected and apply the root login gate before navigating to `"start"`

#### Scenario: Valid login block on a node
- **WHEN** a node object contains a `login.users` array
- **THEN** the engine SHALL apply that node's login gate instead of the root-level gate when navigating to that node

#### Scenario: No login block present
- **WHEN** neither the root object nor the target node contains a `login` field
- **THEN** the engine SHALL navigate to the node without any login intercept (identical to current behaviour)

---

### Requirement: Login intercept view
When a user navigates to a protected node and no user from that node's `login.users` is currently authenticated, the engine SHALL display a dedicated login overlay before rendering the node content.

The login view SHALL contain:
- A heading `ACCESSO RISERVATO`
- A `<select>` element pre-populated with the usernames from `login.users`; the user may select but not type a username
- A `<input type="password">` field for entering the password
- A submit button labelled `[ ACCEDI ]`
- An error line (hidden initially) labelled `CREDENZIALI NON VALIDE`
- A back button labelled `[ Torna al menu ]` that calls `initBoot()` and dismisses the login view

#### Scenario: Login view appears on first access to protected node
- **WHEN** `loadNode` is called for a node that has a `login` field
- **AND** no user from `login.users` is present in the session's authenticated user set
- **THEN** the login overlay SHALL be shown, covering the terminal content
- **THEN** the node's text and choices SHALL NOT be rendered until credentials are validated

#### Scenario: Correct credentials submitted
- **WHEN** the user selects a username and enters the matching password
- **AND** the user clicks `[ ACCEDI ]`
- **THEN** the engine SHALL add that username to the session's authenticated user set
- **THEN** the login overlay SHALL be hidden
- **THEN** the engine SHALL render the protected node normally

#### Scenario: Incorrect password submitted
- **WHEN** the user clicks `[ ACCEDI ]` with a password that does not match the selected username
- **THEN** the `CREDENZIALI NON VALIDE` error line SHALL become visible
- **THEN** the login overlay SHALL remain visible; no node content SHALL be rendered

#### Scenario: Back button on login view
- **WHEN** the user clicks `[ Torna al menu ]` on the login overlay
- **THEN** `initBoot()` SHALL be called
- **THEN** the login overlay SHALL be hidden

---

### Requirement: Session-scoped login state
The engine SHALL maintain a session-scoped set of authenticated usernames (`loggedInUsers`). This set SHALL be initialised empty at page load and SHALL NOT be persisted to `localStorage`, cookies, or any storage mechanism that survives a page reload.

#### Scenario: Authenticated user set initialised empty
- **WHEN** the page loads
- **THEN** `loggedInUsers` SHALL be empty

#### Scenario: Successful login persists for session
- **WHEN** a user authenticates successfully on a protected node
- **THEN** their username SHALL be added to `loggedInUsers`
- **THEN** subsequent navigations to any node protected by that same username SHALL NOT trigger the login view again during the same session

#### Scenario: Session cleared on page reload
- **WHEN** the user reloads the page
- **THEN** `loggedInUsers` SHALL be empty again and all protected nodes SHALL require re-authentication

---

### Requirement: Already-authenticated user acknowledgement
When a user navigates to a protected node and a user from that node's `login.users` is already present in `loggedInUsers`, the engine SHALL display the message `Utente [username] connesso` (where `[username]` is the authenticated username) typed at 50% of the standard typing speed, then wait 2000 ms after typing completes before rendering the node's text and choices.

#### Scenario: Already-logged-in user navigates to protected node
- **WHEN** `loadNode` is called for a node with a `login` field
- **AND** at least one user from `login.users` is present in `loggedInUsers`
- **THEN** the content area SHALL display `Utente [username] connesso` using the typewriter effect at half the standard typing speed (≤ 13 ms per character)
- **THEN** after the typing completes AND 2000 ms have elapsed, the engine SHALL render the node's full text and choices

#### Scenario: Typing speed at half rate for acknowledgement
- **WHEN** the acknowledgement message `Utente [username] connesso` is typed
- **THEN** the per-character delay SHALL be `Math.round(typingSpeed * 0.5)` milliseconds
- **THEN** all other typewriter calls in the engine SHALL continue to use the standard `typingSpeed` (25 ms)

---

### Requirement: typeWriterHTML speed parameter
The `typeWriterHTML` function SHALL accept an optional fourth argument `speed` (number, milliseconds per visible character). When omitted, `speed` SHALL default to the global `typingSpeed` constant (25 ms). Existing call sites that do not pass `speed` SHALL be unaffected.

#### Scenario: Default speed used when argument omitted
- **WHEN** `typeWriterHTML` is called without a `speed` argument
- **THEN** visible characters SHALL be delayed by `typingSpeed` (25 ms) as before

#### Scenario: Custom speed used when argument provided
- **WHEN** `typeWriterHTML` is called with a `speed` argument (e.g., 12)
- **THEN** visible characters SHALL be delayed by that value instead of `typingSpeed`
