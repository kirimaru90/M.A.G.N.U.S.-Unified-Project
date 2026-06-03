## ADDED Requirements

### Requirement: Editor sources the campaign global schema from the cached current campaign
The terminal editor SHALL build its campaign global-variable schema (`campaignGlobalSchema` — the set of declarable global variables offered to the author) from `CurrentCampaignService.currentCampaign()?.state`, NOT by issuing its own `GET /campaigns/:id` on mount. When `currentCampaign()` is `null` (e.g. a deep link before rehydration completes), the editor SHALL render with an empty global schema and SHALL recompute once the signal is populated. After a global-schema write (`PATCH /campaigns/:id/state/schema`, which returns the updated `{ state }`), the cached `currentCampaign().state` SHALL be updated when the patched campaign is current, so the editor reflects the new declarations without a page reload.

#### Scenario: Editor reads schema from cache without fetching
- **WHEN** the admin opens `/terminals/:id` for a terminal in the current workspace campaign
- **THEN** the editor populates its global-variable schema from `currentCampaign().state` and issues no `GET /campaigns/:id` request

#### Scenario: Empty schema before rehydration, then recompute
- **WHEN** the editor mounts while `currentCampaign()` is still `null`
- **THEN** it renders with an empty global schema and recomputes the schema once `currentCampaign()` is populated

#### Scenario: Schema edit reflected without reload
- **WHEN** the admin adds or renames a global variable in the campaign panel (a `PATCH /campaigns/:id/state/schema`) and then opens a terminal in that campaign
- **THEN** the editor's available global variables reflect the updated schema, sourced from the refreshed cached `currentCampaign().state`
