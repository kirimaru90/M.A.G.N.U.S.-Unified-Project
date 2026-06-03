## ADDED Requirements

### Requirement: CurrentCampaignService exposes currentCampaign signal, setCurrent, and clear
`CurrentCampaignService` SHALL be a root-level `Injectable` exposing:
- `currentCampaign: Signal<CampaignDto | null>` — the currently selected campaign or `null` when none is selected
- `setCurrent(campaign: CampaignDto): void` — sets the current campaign and persists its `id` to `localStorage` under the key `'magnus.currentCampaignId'`
- `clear(): void` — sets the signal to `null` and removes `'magnus.currentCampaignId'` from `localStorage`

The `CampaignDto` type SHALL be `{ id: string; name: string; isActive: boolean; isPublic: boolean }`.

#### Scenario: Default state is null
- **WHEN** the service is first injected with no prior localStorage entry
- **THEN** `currentCampaign()` returns `null`

#### Scenario: setCurrent updates the signal and localStorage
- **WHEN** `setCurrent(campaign)` is called
- **THEN** `currentCampaign()` returns the campaign object AND `localStorage.getItem('magnus.currentCampaignId')` equals `campaign.id`

#### Scenario: clear resets signal and removes localStorage
- **WHEN** `clear()` is called after a campaign was set
- **THEN** `currentCampaign()` returns `null` AND `localStorage.getItem('magnus.currentCampaignId')` returns `null`

### Requirement: CurrentCampaignService rehydrates from localStorage on app start
On service construction, if `localStorage` contains `'magnus.currentCampaignId'`, the service SHALL call `GET /campaigns` (via `CampaignsApiService`), find the campaign whose `id` matches the stored value, and call `setCurrent(campaign)`. If no match is found (campaign was deleted or access was revoked), `clear()` SHALL be called. The rehydration SHALL complete before the workspace switcher renders to avoid a flash of "no selection".

#### Scenario: Stored id matches a campaign
- **WHEN** the app starts with `localStorage['magnus.currentCampaignId']` set to a campaign id that exists in `GET /campaigns`
- **THEN** `currentCampaign()` is set to that campaign's full DTO

#### Scenario: Stored id does not match any campaign
- **WHEN** the app starts with `localStorage['magnus.currentCampaignId']` set to an id not present in `GET /campaigns`
- **THEN** `currentCampaign()` remains `null` and the localStorage entry is removed

#### Scenario: No stored id on app start
- **WHEN** the app starts with no `'magnus.currentCampaignId'` in localStorage
- **THEN** no API call for rehydration is made and `currentCampaign()` is `null`
