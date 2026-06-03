## REMOVED Requirements

### Requirement: Public flag in manifest schema
**Reason**: There is no longer a client-side manifest. Visibility of a campaign's terminals is determined server-side by `GET /campaigns/:id/terminals`, which returns only the terminals the caller is allowed to see (public terminals for anonymous callers). The client receives no metadata for hidden terminals and therefore has no notion of a `public` flag to enforce.
**Migration**: The list of buttons rendered on the terminal-list screen SHALL be exactly the entries returned by `GET /campaigns/:id/terminals`, in the order returned. No client-side filtering is performed.

---

## MODIFIED Requirements

### Requirement: Secret-name input on the terminal-list screen
The terminal-list screen (mounted from a selected campaign) SHALL include a text input field and a submit mechanism (Enter key or a button labelled `[ CARICA ]`) positioned below the visible terminal list. The input SHALL be labelled or accompanied by the placeholder text `INSERISCI NOME ARCHIVIO`. The input SHALL be present regardless of whether any hidden terminals exist on the server (its presence does not reveal whether hidden terminals exist).

#### Scenario: Input rendered on the terminal-list screen
- **WHEN** the terminal-list screen successfully loads the list of visible terminals for a campaign
- **THEN** a text input with placeholder `INSERISCI NOME ARCHIVIO` and a `[ CARICA ]` button SHALL appear below the terminal-selection buttons

#### Scenario: Input present when the visible list is empty
- **WHEN** `GET /campaigns/:id/terminals` returns an empty list
- **THEN** the secret-name input SHALL still be rendered

---

### Requirement: Hidden terminal lookup via server by-meta endpoint
When the player submits the secret-name input, the engine SHALL trim the input value and, if non-empty, issue `GET /campaigns/<campaignId>/terminals/by-meta/<value>` through the API client wrapper, where `<campaignId>` is the id of the currently-selected campaign. The client SHALL NOT consult any local list of hidden terminals; the lookup is server-mediated only.

- On a successful (2xx) response, the server SHALL return the same playback payload that `GET /terminals/<terminalId>/load` returns (`{ content: { nodes, login, meta, state }, localState, globalState }`). The engine SHALL feed this payload directly into the normal loading path (typewriter intro, optional fictional-login gate, then play) WITHOUT issuing a second `GET /terminals/<terminalId>/load` request.
- On a 404 response, the engine SHALL display the error message `ARCHIVIO NON TROVATO` near the input and leave the terminal-list screen otherwise unchanged.
- On any other error (network failure, 5xx, parse error, 401/403), the engine SHALL also display `ARCHIVIO NON TROVATO` rather than a server-specific message, so that authorization-related failures do not leak the existence of a terminal.

The client SHALL pass the input value to the URL with appropriate URL-encoding (e.g. via `encodeURIComponent`). Case normalization of the submitted value is a server concern; the client SHALL submit the trimmed value as typed.

#### Scenario: Correct hidden meta id entered
- **WHEN** the player types a valid hidden terminal meta id and submits
- **THEN** the engine SHALL issue `GET /campaigns/<campaignId>/terminals/by-meta/<value>`
- **THEN** on a 2xx response, the engine SHALL hand the returned payload (same shape as `GET /terminals/<terminalId>/load`) directly to the loader and navigate normally, with no additional load request

#### Scenario: Unknown meta id entered
- **WHEN** the player submits a value for which `GET /campaigns/<campaignId>/terminals/by-meta/<value>` returns 404
- **THEN** the engine SHALL display the message `ARCHIVIO NON TROVATO` near the input
- **THEN** the terminal-selection button list SHALL remain visible and unchanged

#### Scenario: Empty input submitted
- **WHEN** the player submits the input with no text (or only whitespace)
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO`
- **THEN** the engine SHALL NOT issue any HTTP request

#### Scenario: Server error does not leak existence
- **WHEN** `GET /campaigns/<campaignId>/terminals/by-meta/<value>` returns 401, 403, or 5xx, or the request fails at the network layer
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO` (the same message shown for 404)

#### Scenario: Visible terminal meta id entered in secret field is not a special case
- **WHEN** the player submits the meta id of a visible terminal in the secret field
- **THEN** the engine SHALL issue `GET /campaigns/<campaignId>/terminals/by-meta/<value>` and load the terminal on 2xx, identical to clicking the visible button (the client makes no client-side distinction; the server returns the terminal because the caller is allowed to see it)

---

### Requirement: Error message cleared on next attempt
The `ARCHIVIO NON TROVATO` error message SHALL be cleared (hidden) each time the player submits a new value via the secret-name input, before the new lookup is issued.

#### Scenario: Error clears on resubmit
- **WHEN** the player has seen `ARCHIVIO NON TROVATO` and then submits a new value
- **THEN** the error message SHALL be hidden before the new lookup runs
- **THEN** if the new value also fails (404 or any other error per the lookup requirement), the error message SHALL appear again
