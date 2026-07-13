## RENAMED Requirements

- FROM: `### Requirement: Topbar workspace switcher renders a PrimeNG dropdown listing all campaigns`
- TO: `### Requirement: In-page workspace selector renders a PrimeNG dropdown listing all campaigns`

## MODIFIED Requirements

### Requirement: In-page workspace selector renders a PrimeNG dropdown listing all campaigns
Campaign selection SHALL be presented by a `CampaignWorkspaceSwitcherComponent` rendered **inside campaign-dependent pages** (at the top of the page content), NOT in the global topbar. Any main-menu page whose data is scoped to a campaign SHALL host this selector; today that is the terminals list. The component SHALL display a PrimeNG `<p-select>` dropdown populated with all campaigns from `CurrentCampaignService.campaigns()` (the shared cached list), NOT from its own `GET /campaigns` request. The dropdown SHALL show campaign names as option labels. On render the selector SHALL default to the previously-selected campaign: when `CurrentCampaignService.currentCampaign()` is non-null, the matching campaign SHALL be pre-selected; when null, the placeholder text "Seleziona campagna" SHALL be shown.

#### Scenario: Dropdown lists all campaigns
- **WHEN** an authenticated admin is on a campaign-dependent page
- **THEN** the in-page workspace selector dropdown lists all campaigns from `CurrentCampaignService.campaigns()`

#### Scenario: Switcher does not issue its own list request
- **WHEN** the selector renders on a page where `CurrentCampaignService.campaigns()` is already hydrated
- **THEN** the selector consumes the cached list and does not trigger an additional `GET /campaigns`

#### Scenario: Selector defaults to the previously-selected campaign
- **WHEN** `CurrentCampaignService.currentCampaign()` is non-null (restored from a prior session)
- **THEN** the dropdown shows the matching campaign's name as the selected value

#### Scenario: Placeholder shown when no campaign is selected
- **WHEN** `CurrentCampaignService.currentCampaign()` is null
- **THEN** the dropdown shows the placeholder text "Seleziona campagna"

#### Scenario: Selector is not in the topbar
- **WHEN** the app shell renders
- **THEN** the global topbar contains no campaign switcher; the selector appears only within campaign-dependent pages

### Requirement: Page reload restores the previously selected campaign
On app reload, the in-page workspace selector SHALL show the previously selected campaign (rehydrated via `CurrentCampaignService` startup logic) without requiring the admin to re-select it.

#### Scenario: Reload restores selection
- **WHEN** the admin selects a campaign and then reloads the page
- **THEN** the in-page selector shows the same campaign as selected after reload
