## ADDED Requirements

### Requirement: Topbar workspace switcher renders a PrimeNG dropdown listing all campaigns
The topbar SHALL contain a `CampaignWorkspaceSwitcherComponent` rendered between the `.bo-crumbs` and the `.bo-topbar-right` group. The component SHALL display a PrimeNG `<p-select>` dropdown populated with all campaigns returned by `GET /campaigns`. The dropdown SHALL show campaign names as option labels. When `CurrentCampaignService.currentCampaign()` is non-null, the matching campaign SHALL be pre-selected. When null, the placeholder text "Seleziona campagna" SHALL be shown.

#### Scenario: Dropdown lists all campaigns
- **WHEN** an authenticated admin is on any shell route
- **THEN** the topbar workspace switcher dropdown lists all campaigns returned by `GET /campaigns`

#### Scenario: Currently selected campaign is pre-selected
- **WHEN** `CurrentCampaignService.currentCampaign()` is non-null
- **THEN** the dropdown shows the matching campaign's name as the selected value

#### Scenario: Placeholder shown when no campaign is selected
- **WHEN** `CurrentCampaignService.currentCampaign()` is null
- **THEN** the dropdown shows the placeholder text "Seleziona campagna"

### Requirement: Selecting a campaign in the switcher updates CurrentCampaignService
When the admin selects a campaign from the dropdown, `CurrentCampaignService.setCurrent(campaign)` SHALL be called with the full `CampaignDto` of the selected option. The selection SHALL persist immediately to `localStorage` (delegated to `setCurrent`). No page navigation occurs — the switcher sets the workspace context for the current session.

#### Scenario: Selecting a campaign updates the service
- **WHEN** the admin selects a campaign from the dropdown
- **THEN** `CurrentCampaignService.currentCampaign()` returns the selected campaign and `localStorage['magnus.currentCampaignId']` holds its id

### Requirement: Page reload restores the previously selected campaign
On app reload, the workspace switcher SHALL show the previously selected campaign (rehydrated via `CurrentCampaignService` startup logic) without requiring the admin to re-select it.

#### Scenario: Reload restores selection
- **WHEN** the admin selects a campaign and then reloads the page
- **THEN** the topbar switcher shows the same campaign as selected after reload
