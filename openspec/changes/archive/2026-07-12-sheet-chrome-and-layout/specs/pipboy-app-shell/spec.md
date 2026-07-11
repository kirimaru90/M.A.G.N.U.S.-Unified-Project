## MODIFIED Requirements

### Requirement: Navigation between sheet, character selection, campaign selection, and logout

From an open character sheet, the app SHALL present the navigation controls in the **case status bar** (not the sheet header), per the reference layout: a status dot and label on the left, `[◄ DOSSIER]` and `[ESCI]` controls on the right of the sheet screen only, and an OS label. `◄ DOSSIER` returns to character selection for the current campaign; `ESCI` clears the local session and returns to login. These two controls SHALL appear only while the sheet screen is mounted.

For a user who may write the character (its owner, or an admin), the status bar SHALL additionally present the `✎` editor-mode toggle alongside `◄ DOSSIER` and `ESCI`, styled with the same status-bar control theme. For any other viewer the `✎` toggle SHALL NOT be rendered. The toggle's placement and behaviour are specified by `pipboy-character-sheet`; this requirement fixes only that it lives in the status-bar control cluster rather than the tab bar.

Changing campaign SHALL remain reachable from the dossier screen (not the sheet), keeping the sheet's status bar to these reference controls.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − +`), never bracketed ASCII labels such as `[ Personaggi ]`.

#### Scenario: Sheet status bar carries the two reference controls
- **WHEN** a character sheet is open
- **THEN** the case status bar shows a status dot and label, a `◄ DOSSIER` control, an `ESCI` control, and an OS label

#### Scenario: Owner sees the editor toggle in the status bar
- **WHEN** the owning player (or an admin) opens a character sheet
- **THEN** the case status bar additionally shows the `✎` editor-mode toggle beside `◄ DOSSIER` and `ESCI`

#### Scenario: Non-writer does not see the editor toggle
- **WHEN** a viewer who may not write the character opens the sheet
- **THEN** no `✎` toggle is rendered in the status bar

#### Scenario: Nav controls absent outside the sheet
- **WHEN** the login, campaign-selection, or dossier screen is mounted
- **THEN** neither `◄ DOSSIER` nor `ESCI` nor `✎` is rendered in the status bar

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
