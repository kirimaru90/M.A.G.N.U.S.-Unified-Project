## ADDED Requirements

### Requirement: Authenticated last-campaign landing
When an authenticated user is present with a resolvable `lastCampaignId`, the client SHALL route the user directly into that campaign's terminal-list screen, skipping the campaign-selection screen. `lastCampaignId` is read from the in-memory `/auth/me` user object (`getUser()`); the client SHALL NOT write `lastCampaignId` or issue any new endpoint to record it. Resolution SHALL be performed against the user's `GET /campaigns` list: the client finds the campaign whose `id` equals `lastCampaignId`, and uses that full campaign object (`id`, `name`, `isPublic`) to mount the terminal list through the same path a manual campaign selection uses (`onCampaignSelected`).

#### Scenario: Resolvable last campaign lands directly
- **WHEN** an authenticated user has `lastCampaignId` set to a campaign that appears in their `GET /campaigns` list
- **THEN** the client SHALL mount the terminal-list screen for that campaign
- **THEN** the campaign-selection chooser SHALL NOT be rendered or briefly displayed

#### Scenario: Landing reuses the manual-selection path
- **WHEN** the client resolves a `lastCampaignId` to a campaign object
- **THEN** it SHALL enter that campaign via the same `onCampaignSelected(campaign)` flow used when a user clicks a campaign button (applying per-campaign config and then showing the terminal list)

#### Scenario: Client never records last campaign
- **WHEN** the landing redirect runs
- **THEN** the client SHALL only read `lastCampaignId` from `getUser()` and SHALL NOT issue any write/record request for it

### Requirement: Landing fires on both boot rehydrate and interactive login from campaign select
The landing redirect SHALL be attempted at two entry points: (1) boot-time session `rehydrate()`, after any user-config load; and (2) successful interactive login when the user logged in from the campaign-selection screen. When the user logs in while already inside a terminal list (already within a campaign), the client SHALL NOT jump to a different campaign; it SHALL preserve the in-place re-render behavior.

#### Scenario: Landing on boot rehydrate
- **WHEN** the app boots, `rehydrate()` returns an authenticated user, and that user has a resolvable `lastCampaignId`
- **THEN** the client SHALL land on that campaign's terminal list instead of calling `showCampaignSelect()`

#### Scenario: Landing after interactive login from campaign select
- **WHEN** an anonymous user on the campaign-selection screen logs in and the now-authenticated user has a resolvable `lastCampaignId`
- **THEN** the client SHALL land on that campaign's terminal list instead of re-rendering the campaign-selection chooser

#### Scenario: Login from inside a terminal list does not jump
- **WHEN** a user logs in from within a terminal-list screen (already inside a campaign)
- **THEN** the client SHALL NOT redirect to a different campaign
- **THEN** the terminal list SHALL re-render in place in the now-authenticated mode

### Requirement: Fallback to campaign selection when landing is not possible
When landing cannot be performed, the client SHALL fall back to today's `showCampaignSelect()` behavior. The fallback SHALL apply for every case that is not an authenticated user with a resolvable, accessible `lastCampaignId`.

#### Scenario: No last campaign id
- **WHEN** the authenticated user has `lastCampaignId` absent, null, or empty
- **THEN** the client SHALL show the campaign-selection screen

#### Scenario: Last campaign not in the accessible list
- **WHEN** the authenticated user's `lastCampaignId` is set but no campaign with that id appears in their `GET /campaigns` list (missing, deleted, or unauthorized/stale)
- **THEN** the client SHALL show the campaign-selection screen (treating "not in list" identically to "no access")

#### Scenario: Campaign list fetch fails during landing
- **WHEN** the landing attempt's `GET /campaigns` request fails
- **THEN** the client SHALL fall back to the campaign-selection screen (which surfaces its own retry/error state)

#### Scenario: Anonymous session
- **WHEN** there is no authenticated user (anonymous boot or after logout)
- **THEN** the client SHALL show the campaign-selection screen and SHALL NOT attempt landing

#### Scenario: Single-campaign auto-enter is unaffected
- **WHEN** landing does not fire and the user's `GET /campaigns` returns exactly one campaign
- **THEN** the existing campaign-selection single-campaign auto-enter SHALL apply unchanged
