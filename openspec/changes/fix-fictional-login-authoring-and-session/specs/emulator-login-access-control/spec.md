## MODIFIED Requirements

### Requirement: Session-scoped login state
The engine SHALL maintain a session-scoped set of authenticated fictional logins keyed by **terminal and username** (`${terminalId}:${username}`), not by bare username. This set SHALL be initialised empty at page load and SHALL NOT be persisted to `localStorage`, cookies, or any storage mechanism that survives a page reload.

An authenticated entry SHALL satisfy a gate **only for the terminal it was recorded against**: authenticating a username on one terminal SHALL NOT satisfy a gate for the same username on a different terminal.

On terminal **disconnect**, the engine SHALL clear the authenticated entries for that terminal ("logout"), so reconnecting the terminal re-presents its gates. Within a single connected session (no disconnect), a successful login SHALL continue to satisfy that terminal's gates without re-prompting.

Separately, the engine SHALL maintain a session-scoped **remembered-credentials** cache keyed by `${terminalId}:${username}` holding the password the operator typed after a server-validated success. Unlike the authenticated set, the remembered-credentials cache SHALL survive disconnect and SHALL be cleared only on page reload. Remembered passwords SHALL originate solely from operator input in the current session; they SHALL NOT be read from any delivered payload (which remains password-free) and SHALL NOT be persisted across a reload.

#### Scenario: Authenticated set initialised empty
- **WHEN** the page loads
- **THEN** the authenticated set SHALL be empty

#### Scenario: Successful login persists for the connected session
- **WHEN** a user authenticates successfully on a protected node of terminal `T`
- **THEN** `${T}:${username}` SHALL be added to the authenticated set
- **THEN** subsequent navigations within `T` to any node protected by that same username SHALL NOT trigger the login view again while `T` stays connected

#### Scenario: Login does not leak across terminals
- **WHEN** the operator authenticates username `tecnico` on terminal `A`
- **AND** later opens terminal `B` which also gates a node with username `tecnico`
- **THEN** entering `B`'s gated node SHALL present the login view (A's authentication SHALL NOT satisfy B's gate)

#### Scenario: Disconnect logs out the terminal
- **WHEN** the operator disconnects terminal `T`
- **THEN** every authenticated entry for `T` SHALL be cleared
- **THEN** reconnecting `T` and entering a previously-unlocked protected node SHALL present the login view again

#### Scenario: Session cleared on page reload
- **WHEN** the user reloads the page
- **THEN** both the authenticated set and the remembered-credentials cache SHALL be empty again and all protected nodes SHALL require re-authentication

## ADDED Requirements

### Requirement: Remembered-credentials prefill on reconnect
When the login intercept view is presented for a terminal/username that has a remembered password in the session cache, the engine SHALL pre-fill the overlay: the username `<select>` SHALL be pre-selected to that username and the password `<input>` SHALL be pre-populated with the remembered password. The engine SHALL still require the operator to submit `[ ACCEDI ]` (or Enter), and SHALL still validate the credentials against `POST /terminals/:id/fictional-login` — the prefill is a convenience, not an auto-bypass. When no remembered password exists for the presented gate, the overlay SHALL render with an empty password field as before.

This applies to both root (boot) and node-level gates.

#### Scenario: Reconnect pre-fills the remembered password
- **WHEN** the operator authenticated `tecnico` on terminal `T`, disconnected `T`, then reconnects `T` and reaches a `tecnico`-gated node (or `T`'s boot gate)
- **THEN** the login overlay SHALL appear with `tecnico` selected and its password field pre-filled from the remembered cache
- **THEN** pressing `[ ACCEDI ]` SHALL submit to `POST /terminals/T/fictional-login` and, on success, render the node

#### Scenario: No prefill without a remembered credential
- **WHEN** a gate is presented for a terminal/username with no remembered password
- **THEN** the overlay's password field SHALL be empty

#### Scenario: Prefill still validates against the server
- **WHEN** a remembered password no longer matches (e.g. the fictional password was rotated) and the operator submits the pre-filled overlay
- **THEN** the server SHALL reject it, the `CREDENZIALI NON VALIDE` error SHALL appear, and no authentication SHALL be recorded
