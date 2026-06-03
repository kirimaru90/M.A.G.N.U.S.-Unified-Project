## REMOVED Requirements

### Requirement: Hidden terminal lookup via server by-meta endpoint
**Reason**: The server contract has been revised. The slug surface that used to be called `meta.id` has been renamed and moved: holotapes now carry a separate human-authored slug `meta.hiddenId` for hidden-terminal lookup, while `meta.id` becomes a server-injected mirror of the top-level terminal id and is rejected on input. The lookup endpoint changes from `GET /campaigns/:id/terminals/by-meta/:metaId` to `GET /campaigns/:id/terminals/by-hidden-id/:hiddenId` to reflect this. Every other client→server reference to a specific terminal (load, state mutation, fictional login) was already keyed on the terminal id and continues to be — see the replacement requirement below.

## ADDED Requirements

### Requirement: Hidden terminal lookup via server by-hidden-id endpoint
When the player submits the secret-name input, the engine SHALL trim the input value and, if non-empty, issue `GET /campaigns/<campaignId>/terminals/by-hidden-id/<hiddenId>` through the API client wrapper, where `<campaignId>` is the id of the currently-selected campaign and `<hiddenId>` is the trimmed input value (the human-authored slug authored on the terminal's `meta.hiddenId` field). The client SHALL NOT consult any local list of hidden terminals; the lookup is server-mediated only.

This `by-hidden-id` endpoint is the ONLY path that consumes `meta.hiddenId`. Every other client→server reference to a specific terminal SHALL use the terminal's actual id (the value of `terminal.id` from `/campaigns/:id/terminals`, mirrored on the load envelope as `content.meta.id`), specifically:

- `GET /terminals/:id/load` for visible-list selection and for state refresh after a rejected mutation.
- `POST /terminals/:id/state/mutate` for `local.*` state mutations.

The `meta.id` field is server-owned: the client MUST NOT send it on any input payload. Inputs (e.g. terminal-creation payloads on other surfaces) carry only `meta.title`, optional `meta.hiddenId`, and optional `meta.public`; the server injects `meta.id` on the load response as a mirror of the terminal id.

- On a successful (2xx) response, the server SHALL return the same playback payload that `GET /terminals/<terminalId>/load` returns (`{ content: { nodes, login, meta, state }, localState, globalState }`). The engine SHALL feed this payload directly into the normal loading path (typewriter intro, optional fictional-login gate, then play) WITHOUT issuing a second `GET /terminals/<terminalId>/load` request.
- On a 404 response, the engine SHALL display the error message `ARCHIVIO NON TROVATO` near the input and leave the terminal-list screen otherwise unchanged.
- On any other error (network failure, 5xx, parse error, 401/403), the engine SHALL also display `ARCHIVIO NON TROVATO` rather than a server-specific message, so that authorization-related failures do not leak the existence of a terminal.

The client SHALL pass the input value to the URL with appropriate URL-encoding (e.g. via `encodeURIComponent`). Case normalization of the submitted value is a server concern; the client SHALL submit the trimmed value as typed.

#### Scenario: Correct hiddenId entered
- **WHEN** the player types a valid hidden terminal `hiddenId` and submits
- **THEN** the engine SHALL issue `GET /campaigns/<campaignId>/terminals/by-hidden-id/<hiddenId>`
- **THEN** on a 2xx response, the engine SHALL hand the returned payload (same shape as `GET /terminals/<terminalId>/load`) directly to the loader and navigate normally, with no additional load request

#### Scenario: Unknown hiddenId entered
- **WHEN** the player submits a value for which `GET /campaigns/<campaignId>/terminals/by-hidden-id/<hiddenId>` returns 404
- **THEN** the engine SHALL display the message `ARCHIVIO NON TROVATO` near the input
- **THEN** the terminal-selection button list SHALL remain visible and unchanged

#### Scenario: Empty input submitted
- **WHEN** the player submits the input with no text (or only whitespace)
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO`
- **THEN** the engine SHALL NOT issue any HTTP request

#### Scenario: Server error does not leak existence
- **WHEN** `GET /campaigns/<campaignId>/terminals/by-hidden-id/<hiddenId>` returns 401, 403, or 5xx, or the request fails at the network layer
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO` (the same message shown for 404)

#### Scenario: Visible terminal hiddenId entered in secret field is not a special case
- **WHEN** the player submits the `hiddenId` of a visible terminal in the secret field
- **THEN** the engine SHALL issue `GET /campaigns/<campaignId>/terminals/by-hidden-id/<hiddenId>` and load the terminal on 2xx, identical to clicking the visible button (the client makes no client-side distinction; the server returns the terminal because the caller is allowed to see it)

#### Scenario: Visible-list path uses the terminal id, not hiddenId
- **WHEN** the player clicks a visible terminal button on the terminal-list screen
- **THEN** the engine SHALL call `GET /terminals/<id>/load` with the value of `terminal.id` from the `/campaigns/:id/terminals` listing — NOT `meta.hiddenId`
- **THEN** the terminal id that the engine remembers for subsequent state mutation requests SHALL be `content.meta.id` from the load envelope (the server-injected mirror of the top-level terminal id)

#### Scenario: State mutations key on the terminal id
- **WHEN** the engine dispatches a `local.*` mutation triggered by an `on_enter` block or a `choice.set` block
- **THEN** it SHALL `POST` to `/terminals/<terminalId>/state/mutate` where `<terminalId>` is the value of `content.meta.id` from the load envelope (NOT `meta.hiddenId`, even when the terminal was reached through the hidden-id input)

#### Scenario: meta.hiddenId is the only slug surface
- **WHEN** a holotape author wants a terminal to be reachable through the secret-name input
- **THEN** they SHALL set `meta.hiddenId` on the terminal
- **THEN** the client SHALL submit that exact `hiddenId` to `by-hidden-id/<hiddenId>` and to no other endpoint
