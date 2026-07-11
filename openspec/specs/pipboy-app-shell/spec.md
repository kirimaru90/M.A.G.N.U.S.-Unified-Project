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

After login (when no valid last-used default applies), the app SHALL list the campaigns accessible to the authenticated user (via the existing campaigns list endpoint) and let the user pick one, proceeding to character selection for that campaign.

#### Scenario: Campaign list renders
- **WHEN** an authenticated user with access to two campaigns reaches campaign selection
- **THEN** both campaigns are listed and selecting one proceeds to character selection scoped to that campaign

### Requirement: Character selection

For the selected campaign, the app SHALL list the authenticated user's own characters in that campaign (via the existing characters list endpoint) and let the user pick one to open its sheet. An admin user SHALL see every character in the campaign, consistent with the existing list endpoint's admin behavior.

If the user has no characters in the selected campaign, the app SHALL offer to create one (via the existing character-create endpoint) rather than presenting an empty, dead-end list. For a non-admin player, submitting this action SHALL prompt for a character name and create a character owned by that player. For an admin, submitting this action SHALL first list the campaign's players (via the existing admin-only campaign players endpoint) and require the admin to pick one before prompting for a character name; the created character SHALL be owned by the selected player.

#### Scenario: Player sees only their own characters
- **WHEN** a player who owns one character in campaign C reaches character selection for C
- **THEN** only that character is listed, even if other players have characters in C

#### Scenario: Admin sees every character in the campaign
- **WHEN** an admin reaches character selection for campaign C, which contains characters owned by several different players
- **THEN** every non-deleted character in C is listed

#### Scenario: Empty character list offers creation to a player
- **WHEN** a player with no characters in campaign C reaches character selection for C
- **THEN** the app offers a "create character" action instead of an empty list
- **AND** submitting it prompts only for a name and creates a character owned by that player via the existing create endpoint, then opens its sheet

#### Scenario: Empty character list offers creation to an admin, with a player picker
- **WHEN** an admin reaches character selection for campaign C and C has no characters yet
- **THEN** the app offers a "create character" action
- **AND** submitting it first lists campaign C's players and requires the admin to select one
- **AND** after a player is selected, the app prompts for a character name and creates a character owned by the selected player via the existing create endpoint, then opens its sheet

#### Scenario: Admin creation blocked when campaign has no players
- **WHEN** an admin submits the "create character" action for a campaign with no assigned players
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

From an open character sheet, the app SHALL offer navigation back to character selection (same campaign) and to campaign selection (change campaign), plus a logout action that clears the local session. Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing).

#### Scenario: Back to character selection
- **WHEN** a user activates the "back to characters" control from an open sheet
- **THEN** the app returns to character selection for the current campaign without logging out

#### Scenario: Logout clears session
- **WHEN** a user activates logout
- **THEN** the local session/JWT is cleared and the app returns to the login screen
