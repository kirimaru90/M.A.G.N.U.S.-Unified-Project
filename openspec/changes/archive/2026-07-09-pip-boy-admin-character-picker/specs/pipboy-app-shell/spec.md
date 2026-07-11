## MODIFIED Requirements

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
