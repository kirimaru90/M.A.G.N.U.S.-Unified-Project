## MODIFIED Requirements

### Requirement: Character selection

For the selected campaign, the app SHALL present the **DOSSIER** screen: the authenticated user's own characters in that campaign (via the existing characters list endpoint), rendered per the reference design as cards showing the character name, a species/PA/tappi meta line, a 7-column S.P.E.C.I.A.L. mini-stat row, an optional trained-skills line, and a bordered amber `✕` delete control that does not open the card. Activating the delete control SHALL open a confirmation dialog naming the character (e.g. `Eliminare {nome}?`) before any deletion occurs; only confirming issues the delete request, and cancelling (via the dialog's cancel action or its backdrop) leaves the character untouched and still listed. Selecting a card opens that character's sheet. An admin user SHALL see every character in the campaign, consistent with the existing list endpoint's admin behavior.

The screen SHALL always offer a dashed `+ NUOVO PERSONAGGIO` action (not only when the list is empty). Activating it SHALL enter the six-step creation wizard specified by `pipboy-character-creation`, rather than prompting for a bare name. For a non-admin player the wizard creates a character owned by that player. For an admin, the app SHALL first list the campaign's players (via the existing admin-only campaign players endpoint) and require the admin to pick an owner before the wizard begins; the created character SHALL be owned by the selected player.

When the user has no characters in the campaign, the app SHALL render the reference's dashed empty-state box (`NESSUN DOSSIER REGISTRATO` / `Crea il tuo primo personaggio.`) above the `+ NUOVO PERSONAGGIO` action, rather than a dead-end list.

#### Scenario: Player sees only their own characters
- **WHEN** a player who owns one character in campaign C reaches the dossier for C
- **THEN** only that character is listed, even if other players have characters in C

#### Scenario: Admin sees every character in the campaign
- **WHEN** an admin reaches the dossier for campaign C, which contains characters owned by several different players
- **THEN** every non-deleted character in C is listed

#### Scenario: Dossier card renders the reference summary
- **WHEN** a character with trained skills is listed
- **THEN** its card shows the name, a species/PA/tappi meta line, a 7-column S.P.E.C.I.A.L. mini-stat row, and a `▸`-prefixed trained-skills line

#### Scenario: Deleting a character requires confirmation naming it
- **WHEN** the user activates a card's `✕` delete control for a character named `Vault Dweller`
- **THEN** a confirmation dialog opens naming `Vault Dweller`, and no delete request is issued yet

#### Scenario: Confirming character deletion does not open the card
- **GIVEN** the delete confirmation dialog is open for a character
- **WHEN** the user confirms
- **THEN** the character is soft-deleted and the sheet for that character is NOT opened

#### Scenario: Cancelling character deletion keeps the character
- **GIVEN** the delete confirmation dialog is open for a character
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** no delete request is issued and the character remains listed in the dossier

#### Scenario: Creation always available and enters the wizard
- **GIVEN** a player who already owns one character in campaign C
- **WHEN** they activate `+ NUOVO PERSONAGGIO`
- **THEN** the six-step creation wizard opens, and on completion a second character owned by that player exists

#### Scenario: Empty dossier shows the empty state and the creation action
- **WHEN** a player with no characters in campaign C reaches the dossier for C
- **THEN** the dashed `NESSUN DOSSIER REGISTRATO` box is shown together with the `+ NUOVO PERSONAGGIO` action

#### Scenario: Admin creation requires picking an owning player first
- **WHEN** an admin activates `+ NUOVO PERSONAGGIO` for campaign C
- **THEN** the app first lists C's players and requires the admin to select one
- **AND** the wizard then runs, creating a character owned by the selected player

#### Scenario: Admin creation blocked when campaign has no players
- **WHEN** an admin activates `+ NUOVO PERSONAGGIO` for a campaign with no assigned players
- **THEN** the app SHALL show an error and SHALL NOT create a character owned by the admin themselves

### Requirement: Navigation between sheet, character selection, campaign selection, and logout

From an open character sheet, the app SHALL present the navigation controls in the **case status bar** (not the sheet header), per the reference layout: a status dot and label on the left, `[◄ DOSSIER]` and `[ESCI]` controls on the right of the sheet screen only, and an OS label. `◄ DOSSIER` returns to character selection for the current campaign; `ESCI` opens a confirmation dialog and, only on confirming, clears the local session and returns to login. Cancelling the `ESCI` confirmation (via its cancel action or its backdrop) SHALL leave the current session and screen unchanged. These two controls SHALL appear only while the sheet screen is mounted.

For a user who may write the character (its owner, or an admin), the app SHALL additionally present the `✎` editor-mode toggle in the **bottom-right of the case bezel** (not in the status-bar control cluster), styled with the case control theme. For any other viewer the `✎` toggle SHALL NOT be rendered. The toggle's placement, its green case LED, and its behaviour are specified by `pipboy-terminal-chrome` and `pipboy-character-sheet`; this requirement fixes only that the `◄ DOSSIER`/`ESCI` cluster lives in the status bar and that the editor toggle no longer sits among them.

Changing campaign SHALL remain reachable from the dossier screen (not the sheet), keeping the sheet's status bar to these reference controls.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − +`), never bracketed ASCII labels such as `[ Personaggi ]`. The `ESCI` control's existing permanent critical-red glyph styling is unchanged by the addition of the confirmation step — it remains the visual cue that the control is destructive; the confirmation dialog's own confirm button SHALL NOT additionally be styled as danger/critical.

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

#### Scenario: Logout requires confirmation
- **WHEN** a user activates `ESCI`
- **THEN** a confirmation dialog opens and no session/JWT clearing occurs yet

#### Scenario: Confirming logout clears the session
- **GIVEN** the logout confirmation dialog is open
- **WHEN** the user confirms
- **THEN** the local session/JWT is cleared and the app returns to the login screen

#### Scenario: Cancelling logout keeps the session
- **GIVEN** the logout confirmation dialog is open
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** the session/JWT is left intact and the sheet remains open

#### Scenario: Changing campaign is reachable from the dossier
- **GIVEN** a user with access to two campaigns
- **WHEN** they are on the dossier screen
- **THEN** a control returning to campaign selection is available
