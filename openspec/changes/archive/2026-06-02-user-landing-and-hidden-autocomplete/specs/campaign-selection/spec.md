## MODIFIED Requirements

### Requirement: Campaign-selection is the application entry screen
On load, the Terminal SHALL show the campaign-selection screen as its first screen, EXCEPT when the session-landing capability redirects an authenticated user with a resolvable `lastCampaignId` directly into a campaign's terminal-list screen. When session-landing does not fire (anonymous session, absent/unresolvable `lastCampaignId`, or a failed landing fetch), no other screen (boot, terminal-list, login, terminal) SHALL render before the campaign-selection screen has determined how to proceed.

#### Scenario: Fresh load shows campaign selection
- **WHEN** the user loads `index.html`, the DOM is ready, and session-landing does not fire
- **THEN** the campaign-selection screen SHALL mount and call `GET /campaigns`
- **THEN** the terminal-list, login, and terminal screens SHALL remain hidden until the campaign-selection screen advances the flow

#### Scenario: Authenticated landing bypasses the entry screen
- **WHEN** an authenticated user with a resolvable `lastCampaignId` loads the app or logs in from campaign selection
- **THEN** the client MAY mount that campaign's terminal-list screen directly, without first presenting the campaign-selection chooser (see the session-landing capability)
