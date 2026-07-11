## MODIFIED Requirements

### Requirement: Campaign selection

After login (when no valid last-used default applies), the app SHALL determine the campaigns accessible to the authenticated user (via the existing campaigns list endpoint).

- When **exactly one** campaign is accessible, the app SHALL select it automatically and proceed directly to character selection, without rendering a campaign picker.
- When **two or more** campaigns are accessible, the app SHALL list them and let the user pick one, proceeding to character selection for that campaign.
- When **no** campaign is accessible, the app SHALL show an Italian, terminal-voiced empty state rather than an empty picker.

Auto-selection SHALL be indistinguishable from an explicit pick for everything downstream: the chosen campaign is still persisted as last-used, and the sheet's "change campaign" navigation SHALL still be reachable (it returns to the picker, which may then show a single entry).

#### Scenario: Sole campaign is auto-selected
- **GIVEN** an authenticated user with access to exactly one campaign
- **WHEN** they reach campaign selection
- **THEN** no campaign picker is rendered and the app proceeds straight to character selection for that campaign

#### Scenario: Campaign list renders for multiple campaigns
- **WHEN** an authenticated user with access to two campaigns reaches campaign selection
- **THEN** both campaigns are listed and selecting one proceeds to character selection scoped to that campaign

#### Scenario: No accessible campaign shows an empty state
- **GIVEN** an authenticated user with access to no campaigns
- **WHEN** they reach campaign selection
- **THEN** an Italian terminal-voiced empty state is shown, not an empty list

### Requirement: Character selection

For the selected campaign, the app SHALL present the **DOSSIER** screen: the authenticated user's own characters in that campaign (via the existing characters list endpoint), rendered per the reference design as cards showing the character name, a species/PA/tappi meta line, a 7-column S.P.E.C.I.A.L. mini-stat row, an optional trained-skills line, and a bordered amber `✕` delete control that does not open the card. Selecting a card opens that character's sheet. An admin user SHALL see every character in the campaign, consistent with the existing list endpoint's admin behavior.

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

#### Scenario: Delete control does not open the card
- **WHEN** the user activates a card's `✕` delete control
- **THEN** the character is soft-deleted and the sheet for that character is NOT opened

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

From an open character sheet, the app SHALL present the navigation controls in the **case status bar** (not the sheet header), per the reference layout: a status dot and label on the left, `[◄ DOSSIER]` and `[ESCI]` controls on the right of the sheet screen only, and an OS label. `◄ DOSSIER` returns to character selection for the current campaign; `ESCI` clears the local session and returns to login. These two controls SHALL appear only while the sheet screen is mounted.

Changing campaign SHALL remain reachable from the dossier screen (not the sheet), keeping the sheet's status bar to the two reference controls.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − +`), never bracketed ASCII labels such as `[ Personaggi ]`.

#### Scenario: Sheet status bar carries the two reference controls
- **WHEN** a character sheet is open
- **THEN** the case status bar shows a status dot and label, a `◄ DOSSIER` control, an `ESCI` control, and an OS label

#### Scenario: Nav controls absent outside the sheet
- **WHEN** the login, campaign-selection, or dossier screen is mounted
- **THEN** neither `◄ DOSSIER` nor `ESCI` is rendered in the status bar

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
