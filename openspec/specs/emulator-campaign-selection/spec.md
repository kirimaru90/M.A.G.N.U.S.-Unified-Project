# emulator-campaign-selection Specification

## Purpose

Campaign-selection entry screen fetching anonymous GET /campaigns, with single-campaign auto-enter, multi-campaign CRT chooser, empty/error retry states, and back-navigation from the terminal list.

## Requirements

### Requirement: Campaign-selection is the application entry screen
On load, the Terminal SHALL show the campaign-selection screen as its first screen, EXCEPT when the session-landing capability redirects an authenticated user with a resolvable `lastCampaignId` directly into a campaign's terminal-list screen. When session-landing does not fire (anonymous session, absent/unresolvable `lastCampaignId`, or a failed landing fetch), no other screen (boot, terminal-list, login, terminal) SHALL render before the campaign-selection screen has determined how to proceed.

#### Scenario: Fresh load shows campaign selection
- **WHEN** the user loads `index.html`, the DOM is ready, and session-landing does not fire
- **THEN** the campaign-selection screen SHALL mount and call `GET /campaigns`
- **THEN** the terminal-list, login, and terminal screens SHALL remain hidden until the campaign-selection screen advances the flow

#### Scenario: Authenticated landing bypasses the entry screen
- **WHEN** an authenticated user with a resolvable `lastCampaignId` loads the app or logs in from campaign selection
- **THEN** the client MAY mount that campaign's terminal-list screen directly, without first presenting the campaign-selection chooser (see the session-landing capability)

### Requirement: Fetch active public campaigns from GET /campaigns
The campaign-selection screen SHALL fetch the list of accessible campaigns via `GET /campaigns` through the API client wrapper. In this phase the request is issued in anonymous mode (no Authorization header), so the server SHALL return only active public campaigns; the client SHALL render whatever the server returns without additional filtering.

#### Scenario: Anonymous request issued on mount
- **WHEN** the campaign-selection screen mounts
- **THEN** it SHALL issue `GET /campaigns` via the API client wrapper

#### Scenario: Client renders server's list as-is
- **WHEN** the server returns a list of campaigns
- **THEN** the client SHALL NOT apply any additional `active` / `public` filtering on top of the server response

### Requirement: Single-campaign auto-enter
When `GET /campaigns` returns exactly one campaign, the campaign-selection screen SHALL enter that campaign directly without rendering a chooser UI. The user SHALL NOT see an intermediate "select your campaign" step in this case.

#### Scenario: Sole campaign is entered immediately
- **WHEN** `GET /campaigns` returns a list of length 1
- **THEN** the campaign-selection screen SHALL mount the terminal-list screen for that campaign
- **THEN** no campaign chooser button SHALL be rendered or briefly displayed

### Requirement: Multi-campaign chooser
When `GET /campaigns` returns more than one campaign, the campaign-selection screen SHALL render one CRT-styled choice button per campaign. Each button SHALL display the campaign's display name in the established `[ ACCEDI: <nome> ]` button format. Selecting a button SHALL enter that campaign (mount the terminal-list screen scoped to its id).

#### Scenario: Two campaigns render two buttons
- **WHEN** `GET /campaigns` returns two campaigns named "Vault 76" and "Capital Wasteland"
- **THEN** the screen SHALL render two buttons with text `[ ACCEDI: Vault 76 ]` and `[ ACCEDI: Capital Wasteland ]`

#### Scenario: Clicking a campaign button enters it
- **WHEN** the user activates a campaign button (click or Enter)
- **THEN** the terminal-list screen SHALL mount, scoped to that campaign's id

#### Scenario: Keyboard navigation works across buttons
- **WHEN** the chooser is displayed with multiple campaigns
- **THEN** the existing keyboard navigation behavior (arrow keys, Enter to activate) SHALL apply to the campaign buttons in declaration order

#### Scenario: Pointer hover plays selection sound
- **WHEN** the user moves the pointer over a campaign button
- **THEN** the selection sound SHALL play, identical to the behavior in the terminal screen's choice buttons (`mouseenter` → `selectionSound`)

### Requirement: Empty-state message
When `GET /campaigns` returns an empty list, the campaign-selection screen SHALL render the message `Nessuna campagna disponibile` using the CRT aesthetic. The screen SHALL also render an affordance for the user to retry the request (e.g. a `[ Riprova ]` button that re-issues `GET /campaigns`).

#### Scenario: Empty list shows the message
- **WHEN** `GET /campaigns` returns an empty list `[]`
- **THEN** the screen SHALL display the text `Nessuna campagna disponibile`
- **THEN** the screen SHALL display a retry affordance

#### Scenario: Retry re-issues the request
- **WHEN** the user activates the retry affordance on the empty state
- **THEN** the screen SHALL re-issue `GET /campaigns` and re-render based on the new response

### Requirement: Error-state on fetch failure
If `GET /campaigns` fails (any `kind` other than a successful response), the campaign-selection screen SHALL render an error message in the CRT aesthetic, consistent with the existing `ERRORE DI RETE` style used elsewhere in the Terminal, and SHALL render a retry affordance.

#### Scenario: Network failure shows error and retry
- **WHEN** `GET /campaigns` throws an error with `kind === 'network'`
- **THEN** the screen SHALL display a CRT-styled error message
- **THEN** the screen SHALL display a `[ Riprova ]` button that re-issues the request

#### Scenario: HTTP error shows error and retry
- **WHEN** `GET /campaigns` throws an error with `kind === 'http'`
- **THEN** the screen SHALL display a CRT-styled error message
- **THEN** the screen SHALL display a `[ Riprova ]` button that re-issues the request

### Requirement: Return to campaign selection from terminal-list
The terminal-list screen, when mounted from the campaign-selection screen, SHALL expose a "back" affordance that returns the user to the campaign-selection screen. Returning SHALL re-issue `GET /campaigns` (so a campaign added or removed server-side between visits is reflected).

#### Scenario: Back from terminal-list returns to campaign selection
- **WHEN** the user activates the back affordance on the terminal-list screen
- **THEN** the campaign-selection screen SHALL mount and re-issue `GET /campaigns`
