## MODIFIED Requirements

### Requirement: CurrentCampaignService exposes currentCampaign signal, setCurrent, and clear
`CurrentCampaignService` SHALL be a root-level `Injectable` exposing:
- `currentCampaign: Signal<CampaignDto | null>` — the currently selected campaign or `null` when none is selected. When non-null, the DTO SHALL be the **full** campaign document including its `state` map (populated via `GET /campaigns/:id`).
- `campaigns: Signal<CampaignDto[]>` — a cached list of all campaigns (lean shape, without per-campaign `state`), hydrated from a **single** shared `GET /campaigns` source so that multiple readers (the workspace switcher, the campaigns list page) do not each trigger their own list request.
- `setCurrent(campaign: CampaignDto): void` — sets the current campaign and persists its `id` to `localStorage` under the key `'magnus.currentCampaignId'`. When given a lean campaign (no `state`), the service SHALL upgrade it to the full DTO via `GET /campaigns/:id` so that `currentCampaign().state` is available to consumers (e.g. the terminal editor).
- `refresh(): void` — invalidates the cache: re-fetches the lean `campaigns` list and, when a campaign is current, re-fetches its full `GET /campaigns/:id` snapshot. Intended to be called after campaign mutations (create, edit, delete, activate, global-schema patch).
- `clear(): void` — sets `currentCampaign` to `null` and removes `'magnus.currentCampaignId'` from `localStorage`.

The `CampaignDto` type SHALL be `{ id: string; name: string; isActive: boolean; isPublic: boolean; state?: Record<string, StateMapEntry> }`, where `state` is present on the current (full) campaign DTO and absent on lean list items.

#### Scenario: Default state is null
- **WHEN** the service is first injected with no prior localStorage entry
- **THEN** `currentCampaign()` returns `null`

#### Scenario: setCurrent updates the signal and localStorage
- **WHEN** `setCurrent(campaign)` is called
- **THEN** `currentCampaign()` returns the campaign object AND `localStorage.getItem('magnus.currentCampaignId')` equals `campaign.id`

#### Scenario: Current campaign carries its state map
- **WHEN** a campaign is selected or rehydrated
- **THEN** `currentCampaign()?.state` is populated from `GET /campaigns/:id`, so consumers can read the global-variable schema without issuing their own campaign fetch

#### Scenario: Cached list is shared across readers
- **WHEN** both the workspace switcher and the campaigns list page read `campaigns()` on the same page load
- **THEN** only one `GET /campaigns` request is issued and both consume the same cached result

#### Scenario: refresh invalidates the cache after a mutation
- **WHEN** `refresh()` is called after a campaign is created, edited, deleted, or activated
- **THEN** `campaigns()` reflects the post-mutation list and, if a campaign is current, `currentCampaign()` reflects its latest `GET /campaigns/:id` snapshot

#### Scenario: clear resets signal and removes localStorage
- **WHEN** `clear()` is called after a campaign was set
- **THEN** `currentCampaign()` returns `null` AND `localStorage.getItem('magnus.currentCampaignId')` returns `null`

### Requirement: CurrentCampaignService rehydrates from localStorage on app start
On service construction, if `localStorage` contains `'magnus.currentCampaignId'`, the service SHALL call `GET /campaigns/:id` (via `CampaignsApiService.get`) for the stored id and, on success, call `setCurrent(campaign)` with the returned **full** DTO (including `state`). If the request returns `404` (campaign was deleted or access was revoked), `clear()` SHALL be called. The service SHALL NOT fetch the entire campaign list and `.find()` the match for rehydration. The rehydration SHALL complete before the workspace switcher renders to avoid a flash of "no selection".

#### Scenario: Stored id matches a campaign
- **WHEN** the app starts with `localStorage['magnus.currentCampaignId']` set to a campaign id that exists
- **THEN** `GET /campaigns/:id` is issued for that id and `currentCampaign()` is set to the returned full DTO (with `state`)

#### Scenario: Stored id does not match any campaign
- **WHEN** the app starts with `localStorage['magnus.currentCampaignId']` set to an id whose `GET /campaigns/:id` returns 404
- **THEN** `currentCampaign()` remains `null` and the localStorage entry is removed

#### Scenario: Rehydrate does not list-and-find
- **WHEN** the app rehydrates a stored campaign id
- **THEN** it issues a single `GET /campaigns/:id` for that id and does not fetch `GET /campaigns` to locate the campaign

#### Scenario: No stored id on app start
- **WHEN** the app starts with no `'magnus.currentCampaignId'` in localStorage
- **THEN** no campaign rehydration request is made and `currentCampaign()` is `null`
