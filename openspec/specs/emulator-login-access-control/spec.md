# emulator-login-access-control Specification

## Purpose

Server-validated fictional-login gating (root- or node-level) with a CRT login overlay, session-scoped authenticated-user set, already-connected acknowledgement, half-speed typing, and Enter-to-submit.

## Requirements

### Requirement: Server-side fictional credential validation
The terminal client SHALL validate fictional-login attempts by sending the entered username and password to `POST /terminals/:id/fictional-login` for the active terminal. The client SHALL NOT compare passwords in JavaScript, and SHALL NOT depend on any `password` field being present in the loaded holotape payload. A fictional credential (password) SHALL never appear in any client-bound payload.

#### Scenario: Validation delegated to the server
- **WHEN** a player submits a fictional-login attempt (username + password)
- **THEN** the client SHALL POST the username and password to `POST /terminals/:id/fictional-login` for the active terminal
- **THEN** the client SHALL determine success or failure solely from the server response, with no client-side password comparison

#### Scenario: No fictional credentials in client payloads
- **WHEN** any holotape content is delivered to the client (e.g. `GET /terminals/:id/load`)
- **THEN** no `login.users[]` entry SHALL contain a `password` field

#### Scenario: Unlock recorded only after server success
- **WHEN** the server returns a success response for a fictional-login attempt
- **THEN** the client SHALL add the validated username to the in-memory session unlock set
- **THEN** the client SHALL NOT persist that unlock across a page reload

---

### Requirement: Login block in olonastro JSON schema
The olonastro JSON schema SHALL support an optional `login` field on the root object and on any individual node object. In the canonical (authored, server-stored) document the `login` field SHALL have the following structure:

```json
"login": {
  "gateOnBoot": false,
  "users": [
    { "username": "<string>", "password": "<string>" }
  ]
}
```

`login.users` SHALL hold the fictional credential registry. `login.gateOnBoot` SHALL be an **optional boolean** that is meaningful **only on the root object** and controls whether a non-empty root registry prompts for login before the `"start"` node:

- When `gateOnBoot` is `true` or omitted, a non-empty root `login.users` SHALL gate the entire file (the login prompt is applied before `"start"` is shown) — this is the historical behaviour and the default.
- When `gateOnBoot` is `false`, the root registry SHALL still exist (its usernames remain available to per-node gates and the login dropdown) but the terminal SHALL NOT prompt for login at boot.

`gateOnBoot` on a node-level `login` block SHALL have no effect (node gating is applied whenever the node is entered without an authenticated user).

When this content is delivered to the terminal client via `GET /terminals/:id/load`, the server SHALL strip every `login.users[].password`, so the client receives only usernames (and `gateOnBoot`, when stored):

```json
"login": {
  "gateOnBoot": false,
  "users": [
    { "username": "<string>" }
  ]
}
```

A `login` field on an individual node gates only that node. Node-level `login` takes precedence over root-level `login` for that specific node. The client SHALL treat the presence of a `login.users` array (regardless of any `password` field) as the gate, and SHALL NOT read or rely on a `password` field.

#### Scenario: Root login with gateOnBoot omitted gates before start
- **WHEN** the loaded JSON contains a non-empty `login.users` array at the root level and no `gateOnBoot` key
- **THEN** the engine SHALL treat the entire file as protected and apply the root login gate before navigating to `"start"`

#### Scenario: Root login with gateOnBoot true gates before start
- **WHEN** the loaded JSON contains a non-empty root `login.users` array and `login.gateOnBoot` is `true`
- **THEN** the engine SHALL apply the root login gate before navigating to `"start"`

#### Scenario: Root login with gateOnBoot false does not gate at boot
- **WHEN** the loaded JSON contains a non-empty root `login.users` array and `login.gateOnBoot` is `false`
- **THEN** the engine SHALL navigate directly to `"start"` with no login intercept
- **AND** navigating to a node that carries its own `login.users` SHALL still apply that node's gate

#### Scenario: Valid login block on a node
- **WHEN** a node object contains a `login.users` array
- **THEN** the engine SHALL apply that node's login gate instead of the root-level gate when navigating to that node
- **AND** any `gateOnBoot` on that node's `login` block SHALL be ignored

#### Scenario: No login block present
- **WHEN** neither the root object nor the target node contains a `login` field
- **THEN** the engine SHALL navigate to the node without any login intercept (identical to current behaviour)

#### Scenario: Delivered login block omits passwords
- **WHEN** `GET /terminals/:id/load` returns a holotape whose root or a node carries a `login` block
- **THEN** every entry in `login.users` SHALL contain a `username` and SHALL NOT contain a `password`
- **THEN** the client SHALL still present the gate (subject to `gateOnBoot` at the root), populating the username `<select>` from the delivered usernames

---

### Requirement: Login intercept view
When a user navigates to a protected node and no user from that node's `login.users` is currently authenticated, the engine SHALL display a dedicated login overlay before rendering the node content.

The login view SHALL contain:
- A heading `ACCESSO RISERVATO`
- A `<select>` element pre-populated with the usernames from `login.users`; the user may select but not type a username
- A `<input type="password">` field for entering the password
- A submit button labelled `[ ACCEDI ]`
- An error line (hidden initially) labelled `CREDENZIALI NON VALIDE`
- A back button labelled `[ Torna al menu ]` whose behaviour depends on whether the login block is root-level or node-level (see scenarios below)

Credential validation SHALL be performed by the server (see "Server-side fictional credential validation"); the overlay's markup and styling are unchanged from the prior client-side-validation behaviour.

#### Scenario: Login view appears on first access to protected node
- **WHEN** `loadNode` is called for a node that has a `login` field
- **AND** no user from `login.users` is present in the session's authenticated user set
- **THEN** the login overlay SHALL be shown, covering the terminal content
- **THEN** the node's text and choices SHALL NOT be rendered until credentials are validated

#### Scenario: Correct credentials submitted
- **WHEN** the user selects a username and enters a password
- **AND** the user clicks `[ ACCEDI ]`
- **THEN** the engine SHALL submit the username and password to `POST /terminals/:id/fictional-login` for the active terminal
- **THEN** on a success response the engine SHALL add that username to the session's authenticated user set
- **THEN** the login overlay SHALL be hidden and the engine SHALL render the protected node normally

#### Scenario: Incorrect password submitted
- **WHEN** the user clicks `[ ACCEDI ]` with credentials the server rejects (e.g. an HTTP `401`)
- **THEN** the `CREDENZIALI NON VALIDE` error line SHALL become visible
- **THEN** the login overlay SHALL remain visible; no node content SHALL be rendered
- **THEN** no username SHALL be added to the authenticated user set

#### Scenario: Validation request fails for a non-credential reason
- **WHEN** the user clicks `[ ACCEDI ]` and the validation request fails for a reason other than credential rejection (network failure, HTTP 5xx, or an unparseable response)
- **THEN** an error message SHALL be shown and the login overlay SHALL remain visible
- **THEN** no username SHALL be added to the authenticated user set

#### Scenario: Submit disabled while a validation request is in flight
- **WHEN** the user clicks `[ ACCEDI ]`
- **THEN** the submit control SHALL be disabled until the request settles, so a duplicate submission cannot be issued for the same attempt
- **THEN** on a failed attempt the control SHALL be re-enabled so the user can retry

#### Scenario: Back button on root-level login view
- **WHEN** the active login block is `terminalData.login` (root-level gate)
- **AND** the user clicks `[ Torna al menu ]` on the login overlay
- **THEN** the login overlay SHALL be hidden
- **THEN** `initBoot()` SHALL be called, returning the user to the boot/file-selection screen

#### Scenario: Back button on node-level login view — previous node exists
- **WHEN** the active login block belongs to an individual node (not the root)
- **AND** `navigationHistory` contains at least one prior node
- **AND** the user clicks `[ Torna al menu ]` on the login overlay
- **THEN** the login overlay SHALL be hidden
- **THEN** the engine SHALL pop the current node from `navigationHistory` and navigate to the previous node using `loadNode(previousNode, true)`

#### Scenario: Back button on node-level login view — no previous node
- **WHEN** the active login block belongs to an individual node
- **AND** `navigationHistory` is empty or contains only the current node (no reachable prior node)
- **AND** the user clicks `[ Torna al menu ]`
- **THEN** the login overlay SHALL be hidden
- **THEN** `initBoot()` SHALL be called as a safe fallback

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

---

### Requirement: Enter key submits login form
When the login intercept view is visible and focus is in the `#login-password` field, pressing the Enter key SHALL trigger the same credential-validation logic as clicking `[ ACCEDI ]` (i.e. the server validation call).

#### Scenario: Enter key with correct credentials
- **WHEN** the login screen is displayed
- **AND** the user has selected a username and typed a password in `#login-password`
- **AND** the user presses Enter
- **THEN** the engine SHALL submit the credentials to `POST /terminals/:id/fictional-login` and, on a success response, dismiss the login overlay and proceed as if `[ ACCEDI ]` was clicked

#### Scenario: Enter key with incorrect credentials
- **WHEN** the login screen is displayed
- **AND** the user presses Enter with credentials the server rejects
- **THEN** the `CREDENZIALI NON VALIDE` error line SHALL become visible
- **THEN** the login overlay SHALL remain visible, identical to the button-click path

#### Scenario: Enter key listener re-registered on each showLoginView call
- **WHEN** `showLoginView` is called multiple times in a session (e.g., navigating to different protected nodes)
- **THEN** exactly one Enter key listener SHALL be active at a time (no duplicate firings)
