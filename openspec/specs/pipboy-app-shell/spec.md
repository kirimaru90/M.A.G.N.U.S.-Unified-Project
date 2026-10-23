# pipboy-app-shell Specification

## Purpose

The `apps/pip-boy` static PWA shell: real-user login reusing `api-auth`, campaign selection, a new character-selection screen, defaulting to the server-synced last-used campaign/character, persisting selections, and navigation/logout.
## Requirements
### Requirement: Real-user login only

The app SHALL authenticate exclusively against the existing `api-auth` real-user login endpoint (username/password → JWT), storing the session client-side the same way `apps/terminal` does: the login form SHALL offer a "Ricordami" checkbox (unchecked by default) styled in the Pip-Boy aesthetic; the request SHALL send `rememberMe` equal to its state; the token SHALL be stored in `localStorage` when checked and in `sessionStorage` otherwise, with the key removed from the other store; reads SHALL prefer `localStorage` and fall back to `sessionStorage`; logout and any session clearing (including a `401` on rehydrate or resume re-verification) SHALL remove the key from both stores. The app SHALL NOT implement or expose any fictional/local-account login (that concept belongs to terminal content, not to character management).

#### Scenario: Successful login
- **WHEN** a user submits a valid username/password
- **THEN** the app stores the returned JWT and proceeds to campaign selection (or the last-used defaults, per below)

#### Scenario: Remembered login survives closing the installed app
- **WHEN** a user logs in with "Ricordami" checked, closes the app, and reopens it
- **THEN** the token is read from `localStorage`, `GET /auth/me` succeeds, and the user lands past the login screen without re-entering credentials

#### Scenario: Non-remembered login is forgotten on close
- **WHEN** a user logs in with "Ricordami" unchecked
- **THEN** the token is stored only in `sessionStorage` and `localStorage` holds no token

#### Scenario: Ricordami is sent with the login request
- **WHEN** a user checks "Ricordami" and submits the form
- **THEN** the `POST /auth/login` body contains `rememberMe: true`

#### Scenario: Logout clears both stores
- **WHEN** an authenticated user logs out
- **THEN** `POST /auth/logout` is called and the token key is absent from both `localStorage` and `sessionStorage`

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

The app SHALL present navigation and logout through two paths, and SHALL NOT render back or exit controls on the case itself (`pipboy-terminal-chrome`'s status bar holds no controls):

1. **The settings popup's navigation section** (`pipboy-settings`): `CAMBIA PERSONAGGIO`, `CAMBIA CAMPAGNA`, and `ESCI`, depending on the current screen.
2. **The system back action**: the Android back gesture or button, and the browser's back navigation, as defined in `System back action`, below.

Going **up one level** SHALL be defined per screen, and SHALL be the same destination for both paths:

- On **login** there is nothing above, and no session.
- On **campaign selection** there is nothing above.
- On **character selection** (the DOSSIER screen), up one level is campaign selection, **unless** the user has access to only one campaign, in which case there is nothing above (campaign selection would auto-select that campaign straight back).
- On the **sheet**, up one level is character selection for the current campaign.

Going up one level SHALL never log the user out. Logout SHALL only ever be reached through `ESCI`, and only after the existing confirmation dialog: only confirming SHALL clear the local session and return to the login screen; cancelling (via its cancel action or its backdrop) SHALL leave the current session and screen unchanged.

For a user who may write the character (its owner, or an admin), the app SHALL additionally present the `✎` editor-mode toggle in the **bottom-right of the case bezel**. For any other viewer the `✎` toggle SHALL NOT be rendered. The toggle's placement, its lit state, and its behaviour are specified by `pipboy-terminal-chrome` and `pipboy-character-sheet`.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − + ⏻`), never bracketed ASCII labels such as `[ Personaggi ]`. The confirmation dialog's own confirm button SHALL NOT be styled as danger/critical.

#### Scenario: The case carries no back or exit control

- **WHEN** the login, campaign-selection, character-selection, or sheet screen is mounted
- **THEN** neither the status bar nor the bezel contains a back or exit control

#### Scenario: Up one level from the dossier returns to campaign selection

- **GIVEN** the character-selection screen is mounted and the user has access to more than one campaign
- **WHEN** the user goes up one level (via `CAMBIA CAMPAGNA` or the system back action)
- **THEN** the app returns to campaign selection without logging out

#### Scenario: Up one level from the sheet returns to the dossier

- **GIVEN** a character sheet is open
- **WHEN** the user goes up one level (via `CAMBIA PERSONAGGIO` or the system back action)
- **THEN** the app returns to character selection for the current campaign without logging out

#### Scenario: Logout opens a confirmation dialog

- **GIVEN** any logged-in screen
- **WHEN** the user activates `ESCI`
- **THEN** a confirmation dialog opens and no session/JWT clearing occurs yet

#### Scenario: Confirming logout clears the session

- **GIVEN** the logout confirmation dialog is open
- **WHEN** the user confirms
- **THEN** the local session/JWT is cleared and the app returns to the login screen

#### Scenario: Cancelling logout keeps the session

- **GIVEN** the logout confirmation dialog is open
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** the session/JWT is left intact and the current screen remains unchanged

#### Scenario: Owner sees the editor toggle in the bezel

- **WHEN** the owning player (or an admin) opens a character sheet
- **THEN** the `✎` editor-mode toggle is rendered in the bottom-right of the case bezel

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

### Requirement: Dossier card species shows the catalog name

The species shown in each DOSSIER card's species/PA/tappi meta line SHALL be the species' display `name`, resolved by looking up the character's stored `species` slug in the species catalog the app already loads at startup. When no catalog entry matches, or the catalog failed to load, it SHALL fall back to the raw slug. Resolution SHALL be the same as the sheet header's species chip (`pipboy-character-sheet`), so a character's species reads identically on its dossier card and on its sheet.

#### Scenario: Dossier meta line uses the catalog name
- **GIVEN** a character with `species: "super_mutant"` and a catalog entry `{ slug: "super_mutant", name: "Supermutante" }`
- **WHEN** the dossier lists that character
- **THEN** its meta line begins with `Supermutante`, not `super_mutant`

#### Scenario: Dossier meta line falls back to the slug
- **GIVEN** a character whose `species` slug has no catalog entry
- **WHEN** the dossier lists that character
- **THEN** its meta line shows the raw slug

### Requirement: System back action

The app SHALL handle the platform's back action (the Android back gesture or button in the installed app, and the browser's back navigation) inside the app, using the History API, by performing the **first** applicable step of this ordered list:

1. **A popup or dialog is open** (any `.pb-popup-overlay`, the catalog picker, or the confirmation dialog): close the topmost one through its own dismissal path (the same path as its `✕`/cancel/backdrop), so any guard it already applies on dismissal still applies. Only that one overlay closes.
2. **The map tab is in immersive mode**: leave immersive mode, exactly as its toggle or `Escape` would (`pipboy-map-tab`).
3. **The current screen has a level above it** (per the navigation requirement, above): go up one level.
4. **Otherwise** (login, campaign selection, or a single-campaign dossier, with nothing open): when the app is **installed** (fullscreen/standalone display mode), the back action SHALL be consumed and do nothing — the app SHALL NOT close or go to the background because of it, and SHALL stay on the current screen, **provided the user has interacted with the page (a tap, click or key press) since the previous back action or since launch**. The app is otherwise left through the platform's own home/recents gestures. In a normal **browser tab**, the app SHALL NOT intercept the action, so the browser's default applies (the tab leaves the page), because trapping a browser tab's back button is hostile.

To make step 4 hold, the installed app SHALL always keep a history entry of its own on top of the launch entry, re-adding it after every handled back action.

**Platform limit.** Browsers deliberately skip history entries a page added without user activation, and a back action is not user activation. So a back action made with no interaction since the previous one (or since launch) MAY reach the platform and close the installed app, and the app cannot prevent it. This is the only case in which back may close the installed app; one interaction between back actions restores the guarantee.

The system back action SHALL never log the user out, never open the logout confirmation, and never discard a character's unsaved edits beyond what that popup's own dismissal path already does.

Forward navigation through history SHALL NOT re-open popups or re-enter screens; the app MAY treat it as a no-op.

#### Scenario: Back closes an open popup first

- **GIVEN** a character sheet is open in immersive map mode and the settings popup is open
- **WHEN** the user performs the back action
- **THEN** only the settings popup closes; the map stays immersive and the sheet stays mounted

#### Scenario: Back closes only the topmost of stacked overlays

- **GIVEN** the add-item popup is open with the catalog picker open above it
- **WHEN** the user performs the back action
- **THEN** the catalog picker closes and the add-item popup remains open

#### Scenario: Back leaves immersive map mode

- **GIVEN** the map tab is in immersive mode with no popup open
- **WHEN** the user performs the back action
- **THEN** immersive mode ends, the sheet's normal chrome is restored, and the sheet stays mounted

#### Scenario: Back goes up from the sheet

- **GIVEN** a character sheet is open in normal mode with no popup open
- **WHEN** the user performs the back action
- **THEN** character selection for the current campaign is shown and the session is intact

#### Scenario: Back goes up from the dossier

- **GIVEN** character selection is mounted, the user has more than one campaign, and no popup is open
- **WHEN** the user performs the back action
- **THEN** campaign selection is shown and the session is intact

#### Scenario: Back at the top does not close the installed app

- **GIVEN** the app is installed, campaign selection is mounted with no popup open, and the user has interacted with the page
- **WHEN** the user performs the back action, interacting with the page again before each further back action
- **THEN** the app stays open on campaign selection each time, opens no dialog, and does not clear the session

#### Scenario: Repeated back without interaction may close the installed app

- **GIVEN** the app is installed and a back action has just been handled
- **WHEN** the user performs another back action without interacting with the page in between
- **THEN** the platform may close the app (platform limit); if it does, the session is not cleared and no logout confirmation opens

#### Scenario: Back on the login screen does not close the installed app

- **GIVEN** the app is installed, the login screen is mounted, and the user has interacted with the page
- **WHEN** the user performs the back action
- **THEN** the app stays open on the login screen

#### Scenario: Back at the top is left to the browser in a tab

- **GIVEN** the app is open in a normal browser tab on campaign selection with no popup open
- **WHEN** the user performs the back action
- **THEN** the app does not intercept it, so the browser's default back navigation applies

#### Scenario: Back never logs out

- **GIVEN** any logged-in screen
- **WHEN** the user performs the back action any number of times
- **THEN** the logout confirmation never opens and the session is never cleared by it

