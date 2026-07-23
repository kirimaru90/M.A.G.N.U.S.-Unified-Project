# pipboy-app-shell Specification

## Purpose

The `apps/pip-boy` static PWA shell: real-user login reusing `api-auth`, campaign selection, a new character-selection screen, defaulting to the server-synced last-used campaign/character, persisting selections, and navigation/logout.

## Requirements

### Requirement: Real-user login only

The app SHALL authenticate exclusively against the existing `api-auth` real-user login endpoint (username/password → JWT), storing the session client-side the same way `apps/terminal` does. The app SHALL NOT implement or expose any fictional/local-account login (that concept belongs to terminal content, not to character management).

#### Scenario: Successful login
- **WHEN** a user submits a valid username/password
- **THEN** the app stores the returned JWT and proceeds to campaign selection (or the last-used defaults, per below)

#### Scenario: Invalid credentials
- **WHEN** a user submits an incorrect username/password
- **THEN** the app displays an Italian, terminal-voiced error and does not proceed

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

### Requirement: Defaulting to the last-used campaign and character

On launch, an authenticated user's session SHALL be inspected (via the existing session-inspection endpoint, extended to return `lastCharacterId`) for a non-null `lastCampaignId`/`lastCharacterId` pair. When both are present, the app SHALL skip campaign and character selection and open that character's sheet directly. The app SHALL trust a non-null `lastCharacterId` returned by that endpoint as already-valid (owned or admin-visible, non-deleted, belonging to `lastCampaignId`) and SHALL NOT perform its own additional existence/ownership re-validation before loading it.

When `lastCampaignId` or `lastCharacterId` is `null`, the app SHALL fall back to campaign selection (and then character selection) as normal.

#### Scenario: Returning user skips straight to their sheet
- **GIVEN** a user's session reports `lastCampaignId: "C1"` and `lastCharacterId: "char-1"`
- **WHEN** the user launches the app
- **THEN** the app opens `char-1`'s sheet directly, without showing campaign or character selection

#### Scenario: First-time user sees campaign selection
- **GIVEN** a user's session reports `lastCampaignId: null` and `lastCharacterId: null`
- **WHEN** the user launches the app
- **THEN** the app shows campaign selection

### Requirement: Selecting a character persists it as last-used

Whenever the user opens a character's sheet via campaign+character selection (i.e., not already via the last-used default), the app SHALL call the existing self-service last-selection endpoint with the chosen `campaignId`/`characterId` so the choice is durable across devices.

#### Scenario: Selection is persisted
- **WHEN** a user picks campaign C1 and character `char-1` from selection screens
- **THEN** the app calls the last-selection endpoint with `{ campaignId: "C1", characterId: "char-1" }` before or immediately after opening the sheet

### Requirement: Navigation between sheet, character selection, campaign selection, and logout

The app SHALL present navigation and logout through two permanent physical case controls in the **case status bar** — a **back nub** and an **exit nub** — rendered per `pipboy-terminal-chrome`, present in the DOM on **every** screen (login, campaign selection, character selection/dossier, and the sheet), never only some of them. Both nubs SHALL be fixed-size regardless of whether they currently render a glyph.

The back nub's glyph, accessible name, and activation target SHALL be contextual to the current screen, never a single fixed destination:

- On **login** and **campaign selection**, the back nub SHALL render with no glyph and SHALL be disabled — there is nothing above either screen to return to.
- On **character selection** (the DOSSIER screen), the back nub SHALL render `◄`, carry the accessible name `CAMPAGNA`, and activating it SHALL return to campaign selection.
- On the **sheet**, the back nub SHALL render `◄`, carry the accessible name `DOSSIER`, and activating it SHALL return to character selection for the current campaign.

The exit nub SHALL log the user out and return to login wherever it is functional, but only after confirmation:

- On **login**, the exit nub SHALL render with no glyph and SHALL be disabled — there is no session to exit.
- On **campaign selection**, **character selection**, and the **sheet**, the exit nub SHALL render its glyph, carry the accessible name `ESCI`, and activating it SHALL open a confirmation dialog before any session change; only confirming SHALL clear the local session and return to the login screen. Cancelling the confirmation (via its cancel action or its backdrop) SHALL leave the current session and screen unchanged.

Neither nub SHALL ever carry a persistent lit ("on") state: both are one-shot navigation actions that immediately leave the current screen (once confirmed, for the exit nub), unlike the `✎` editor toggle's persistent mode indicator (`pipboy-terminal-chrome`). Ordinary press feedback (e.g. `:active`) MAY apply, but no class equivalent to the editor toggle's `.on` SHALL be added to either nub.

For a user who may write the character (its owner, or an admin), the app SHALL additionally present the `✎` editor-mode toggle in the **bottom-right of the case bezel** (not in the status-bar control cluster, and not one of the two nubs above). For any other viewer the `✎` toggle SHALL NOT be rendered. The toggle's placement, its lit state, and its behaviour are specified by `pipboy-terminal-chrome` and `pipboy-character-sheet`; this requirement fixes only that the back/exit nubs live in the status bar, are present on every screen, and that the editor toggle is a separate, unrelated bezel control.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − + ⏻`), never bracketed ASCII labels such as `[ Personaggi ]`, and never on-screen text buttons for back/exit navigation. The exit nub's permanent critical-red glyph styling (`pipboy-terminal-chrome`) is unchanged by the confirmation step — it remains the visual cue that the control is destructive; the confirmation dialog's own confirm button SHALL NOT additionally be styled as danger/critical.

#### Scenario: Both case nubs are present on every screen

- **WHEN** the login, campaign-selection, character-selection, or sheet screen is mounted
- **THEN** the case status bar renders both the back nub and the exit nub, each at their fixed size, regardless of whether either currently shows a glyph

#### Scenario: Back and exit are inert with no glyph on login

- **WHEN** the login screen is mounted
- **THEN** both the back nub and the exit nub render with no glyph and are disabled

#### Scenario: Campaign selection offers only exit

- **WHEN** the campaign-selection screen is mounted
- **THEN** the back nub renders with no glyph and is disabled, and the exit nub renders its glyph, is enabled, and carries the accessible name `ESCI`

#### Scenario: Character selection (DOSSIER) offers back-to-campaign and exit

- **WHEN** the character-selection screen is mounted
- **THEN** the back nub renders `◄`, carries the accessible name `CAMPAGNA`, and is enabled; the exit nub renders its glyph, is enabled, and carries the accessible name `ESCI`

#### Scenario: Sheet offers back-to-dossier and exit

- **WHEN** a character sheet is open
- **THEN** the back nub renders `◄`, carries the accessible name `DOSSIER`, and is enabled; the exit nub renders its glyph, is enabled, and carries the accessible name `ESCI`

#### Scenario: Back-nub activation returns to the correct screen

- **GIVEN** the character-selection screen is mounted
- **WHEN** the user activates the back nub
- **THEN** the app returns to campaign selection without logging out

#### Scenario: Back-nub activation from the sheet returns to the dossier

- **GIVEN** a character sheet is open
- **WHEN** the user activates the back nub
- **THEN** the app returns to character selection for the current campaign without logging out

#### Scenario: Exit-nub activation opens a confirmation dialog

- **GIVEN** the exit nub is enabled on any screen
- **WHEN** the user activates it
- **THEN** a confirmation dialog opens and no session/JWT clearing occurs yet

#### Scenario: Confirming exit-nub logout clears the session

- **GIVEN** the exit-nub confirmation dialog is open
- **WHEN** the user confirms
- **THEN** the local session/JWT is cleared and the app returns to the login screen

#### Scenario: Cancelling exit-nub logout keeps the session

- **GIVEN** the exit-nub confirmation dialog is open
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** the session/JWT is left intact and the current screen remains unchanged

#### Scenario: Neither nub ever carries a persistent lit state

- **WHEN** the back nub or the exit nub is activated, on any screen where it is enabled
- **THEN** neither control gains a persistent "on"/lit class as a result of the activation

#### Scenario: Owner sees the editor toggle in the bezel, unrelated to the two nubs

- **WHEN** the owning player (or an admin) opens a character sheet
- **THEN** the `✎` editor-mode toggle is rendered in the bottom-right of the case bezel, separately from the back and exit nubs in the status bar

#### Scenario: Non-writer does not see the editor toggle

- **WHEN** a viewer who may not write the character opens the sheet
- **THEN** no `✎` toggle is rendered anywhere on the sheet

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
