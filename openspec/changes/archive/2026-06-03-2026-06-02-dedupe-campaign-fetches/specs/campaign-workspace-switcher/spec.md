## MODIFIED Requirements

### Requirement: Topbar workspace switcher renders a PrimeNG dropdown listing all campaigns
The topbar SHALL contain a `CampaignWorkspaceSwitcherComponent` rendered between the `.bo-crumbs` and the `.bo-topbar-right` group. The component SHALL display a PrimeNG `<p-select>` dropdown populated with all campaigns from `CurrentCampaignService.campaigns()` (the shared cached list), NOT from its own `GET /campaigns` request. The dropdown SHALL show campaign names as option labels. When `CurrentCampaignService.currentCampaign()` is non-null, the matching campaign SHALL be pre-selected. When null, the placeholder text "Seleziona campagna" SHALL be shown.

#### Scenario: Dropdown lists all campaigns
- **WHEN** an authenticated admin is on any shell route
- **THEN** the topbar workspace switcher dropdown lists all campaigns from `CurrentCampaignService.campaigns()`

#### Scenario: Switcher does not issue its own list request
- **WHEN** the switcher renders on a page where `CurrentCampaignService.campaigns()` is already hydrated
- **THEN** the switcher consumes the cached list and does not trigger an additional `GET /campaigns`

#### Scenario: Currently selected campaign is pre-selected
- **WHEN** `CurrentCampaignService.currentCampaign()` is non-null
- **THEN** the dropdown shows the matching campaign's name as the selected value

#### Scenario: Placeholder shown when no campaign is selected
- **WHEN** `CurrentCampaignService.currentCampaign()` is null
- **THEN** the dropdown shows the placeholder text "Seleziona campagna"

### Requirement: Selecting a campaign in the switcher updates CurrentCampaignService
When the admin selects a campaign from the dropdown, `CurrentCampaignService.setCurrent(campaign)` SHALL be called with the selected option. Because the dropdown options are lean (no `state`), the service SHALL upgrade the selection to the full campaign DTO (with `state`) via a single `GET /campaigns/:id`, so that downstream consumers (notably the terminal editor) read the global-variable schema from `currentCampaign().state` without their own fetch. The selection SHALL persist immediately to `localStorage` (delegated to `setCurrent`). No page navigation occurs — the switcher sets the workspace context for the current session.

#### Scenario: Selecting a campaign updates the service
- **WHEN** the admin selects a campaign from the dropdown
- **THEN** `CurrentCampaignService.currentCampaign()` returns the selected campaign and `localStorage['magnus.currentCampaignId']` holds its id

#### Scenario: Selection populates the full DTO with state
- **WHEN** the admin selects a campaign whose dropdown option carries no `state`
- **THEN** the service fetches `GET /campaigns/:id` once and `currentCampaign()?.state` is populated for downstream consumers

### Requirement: Page reload restores the previously selected campaign
On app reload, the workspace switcher SHALL show the previously selected campaign (rehydrated via `CurrentCampaignService` startup logic) without requiring the admin to re-select it.

#### Scenario: Reload restores selection
- **WHEN** the admin selects a campaign and then reloads the page
- **THEN** the topbar switcher shows the same campaign as selected after reload
