## ADDED Requirements

### Requirement: Session re-verification on resume

When the installed app returns to the foreground — the document's `visibilitychange` reports `visible` after having been hidden, or a `pageshow` fires (including a bfcache restore) on reopen — and a stored session token is present, the app SHALL re-verify the session against `api-auth` (`GET /auth/me`) before continuing to trust the currently rendered screen.

- On a `200`, the app SHALL refresh the in-memory user and, when a character sheet is mounted, silently reload and re-render that character's current data, WITHOUT prompting for re-login while the token remains valid.
- On a `401` (expired/invalid token), the app SHALL clear the local session and route to the login screen.
- On a network/transport failure (no HTTP status), the app SHALL leave the current screen in place and SHALL NOT force a logout — a transient offline blip is not treated as an expired session.

When no token is stored, resume SHALL do nothing (the user is already anonymous).

#### Scenario: Resume with a valid token refreshes in place
- **GIVEN** a mounted character sheet and a stored token that is still valid
- **WHEN** the app returns to the foreground and `GET /auth/me` responds `200`
- **THEN** the character is silently reloaded and re-rendered and no login screen is shown

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

## MODIFIED Requirements

### Requirement: Navigation between sheet, character selection, campaign selection, and logout

From an open character sheet, the app SHALL present the navigation controls in the **case status bar** (not the sheet header), per the reference layout: a status dot and label on the left, `[◄ DOSSIER]` and `[ESCI]` controls on the right of the sheet screen only, and an OS label. `◄ DOSSIER` returns to character selection for the current campaign; `ESCI` clears the local session and returns to login. These two controls SHALL appear only while the sheet screen is mounted.

For a user who may write the character (its owner, or an admin), the app SHALL additionally present the `✎` editor-mode toggle in the **bottom-right of the case bezel** (not in the status-bar control cluster), styled with the case control theme. For any other viewer the `✎` toggle SHALL NOT be rendered. The toggle's placement, its green case LED, and its behaviour are specified by `pipboy-terminal-chrome` and `pipboy-character-sheet`; this requirement fixes only that the `◄ DOSSIER`/`ESCI` cluster lives in the status bar and that the editor toggle no longer sits among them.

Changing campaign SHALL remain reachable from the dossier screen (not the sheet), keeping the sheet's status bar to these reference controls.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − +`), never bracketed ASCII labels such as `[ Personaggi ]`.

#### Scenario: Sheet status bar carries the two reference controls
- **WHEN** a character sheet is open
- **THEN** the case status bar shows a status dot and label, a `◄ DOSSIER` control, an `ESCI` control, and an OS label, and no `✎` toggle among them

#### Scenario: Owner sees the editor toggle in the bezel
- **WHEN** the owning player (or an admin) opens a character sheet
- **THEN** the `✎` editor-mode toggle is rendered in the bottom-right of the case bezel

#### Scenario: Non-writer does not see the editor toggle
- **WHEN** a viewer who may not write the character opens the sheet
- **THEN** no `✎` toggle is rendered anywhere on the sheet

#### Scenario: Nav controls absent outside the sheet
- **WHEN** the login, campaign-selection, or dossier screen is mounted
- **THEN** neither `◄ DOSSIER` nor `ESCI` is rendered in the status bar, and no `✎` toggle is rendered in the bezel

#### Scenario: Back to the dossier
- **WHEN** a user activates `◄ DOSSIER` from an open sheet
- **THEN** the app returns to character selection for the current campaign without logging out

#### Scenario: Logout clears session
- **WHEN** a user activates `ESCI`
- **THEN** the local session/JWT is cleared and the app returns to the login screen

#### Scenario: Changing campaign is reachable from the dossier
- **GIVEN** a user with access to two campaigns
- **WHEN** they are on the dossier screen
- **THEN** a control returning to campaign selection is available
