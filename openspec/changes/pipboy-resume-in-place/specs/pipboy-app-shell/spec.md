## MODIFIED Requirements

### Requirement: Session re-verification on resume

When the installed app returns to the foreground — the document's `visibilitychange` reports `visible` after having been hidden, or a `pageshow` fires (including a bfcache restore) on reopen — and a stored session token is present, the app SHALL re-verify the session against `api-auth` (`GET /auth/me`) before continuing to trust the currently rendered screen.

- On a `200`, the app SHALL refresh the in-memory user and, when a character sheet is mounted, silently reload that character's current data and **refresh the mounted sheet in place**, WITHOUT prompting for re-login while the token remains valid. The sheet SHALL NOT be remounted.
- On a `401` (expired/invalid token), the app SHALL clear the local session and route to the login screen.
- On a network/transport failure (no HTTP status), the app SHALL leave the current screen in place and SHALL NOT force a logout — a transient offline blip is not treated as an expired session.

When no token is stored, resume SHALL do nothing (the user is already anonymous).

A refresh in place SHALL merge the reloaded data into the sheet's existing in-memory character rather than replacing it, and SHALL preserve the sheet's view state: the active first-level tab, every first-level tab's remembered subtab, ✎ edit mode, immersive map mode, the dice roller's state, the codex and quest view state (list or open entry, filters, search), and the map's view. Any open editor overlay (note, background, codex or quest editor) SHALL stay open with its unsaved content, and a later save from it SHALL update the refreshed sheet.

The refresh SHALL always redraw the sheet header, the critical/editor strip and the footer from the reloaded data. It SHALL redraw the active tab's content only when that cannot discard work:

- when the active tab is `MAPPA`, its content SHALL NOT be redrawn (the map reads no character data);
- while ✎ edit mode is on, the active tab's content SHALL NOT be redrawn (inline inputs may hold uncommitted values);
- while any popup or editor overlay is open, the active tab's content SHALL NOT be redrawn (the overlay's callbacks update the tab content that opened it);
- otherwise the active tab's content SHALL be redrawn from the reloaded data, and its scroll position SHALL be restored afterwards.

A tab not redrawn by the refresh SHALL show the reloaded data the next time it renders.

A refresh SHALL NOT start when the sheet that issued the reload is no longer the mounted sheet by the time the data arrives.

#### Scenario: Resume with a valid token refreshes in place
- **GIVEN** a mounted character sheet and a stored token that is still valid
- **WHEN** the app returns to the foreground and `GET /auth/me` responds `200`
- **THEN** the character is silently reloaded, the header shows the reloaded data, and no login screen is shown

#### Scenario: Resume keeps the active tab and subtab
- **GIVEN** a mounted sheet whose active position is `INFO › Quest`
- **WHEN** the app resumes with a valid token
- **THEN** `INFO › Quest` is still the active position, and `STATS` still remembers the subtab it had before the resume

#### Scenario: Resume keeps an open editor
- **GIVEN** the note editor is open with unsaved text
- **WHEN** the app resumes with a valid token
- **THEN** the editor is still open with the same text, the notes tab beneath it is not redrawn, and saving it updates the notes list shown on the mounted sheet

#### Scenario: Resume keeps edit mode and does not redraw its tab
- **GIVEN** ✎ edit mode is on and a value has been typed but not committed in an inline input of the active tab
- **WHEN** the app resumes with a valid token
- **THEN** edit mode is still on, the typed value is still in its input, and the header shows the reloaded data

#### Scenario: Resume on the map keeps the map
- **GIVEN** the active tab is `MAPPA`, panned and zoomed away from the start view
- **WHEN** the app resumes with a valid token
- **THEN** the same map instance is still mounted at the same centre and zoom, and immersive mode is unchanged

#### Scenario: Resume redraws a safe tab with fresh data
- **GIVEN** the active position is `STATS › Salute`, edit mode is off, and the server's data for the character has changed
- **WHEN** the app resumes with a valid token
- **THEN** the Salute content shows the reloaded data and its scroll position is unchanged

#### Scenario: Resume with an expired token routes to login
- **GIVEN** a stored token that the server now rejects
- **WHEN** the app returns to the foreground and `GET /auth/me` responds `401`
- **THEN** the local session is cleared and the login screen is shown

#### Scenario: Resume while offline keeps the current screen
- **GIVEN** a mounted character sheet and no network
- **WHEN** the app returns to the foreground and `GET /auth/me` fails without an HTTP status
- **THEN** the current screen remains and the user is not logged out

#### Scenario: Resume while anonymous does nothing
- **GIVEN** no stored token (the login screen is shown)
- **WHEN** the app returns to the foreground
- **THEN** no `GET /auth/me` request is issued and the screen is unchanged
