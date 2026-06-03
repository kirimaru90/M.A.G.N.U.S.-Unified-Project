## MODIFIED Requirements

### Requirement: Terminal detail page shows metadata and editor placeholder
The route `/terminals/:id` SHALL fetch the terminal via a **single** `GET /terminals/:id` and render a metadata panel showing: title, public flag, the parent campaign name, and a last-updated label if the API includes one. The parent campaign name SHALL be resolved **synchronously** from `CurrentCampaignService.currentCampaign()` (mirroring the page's back-link); the page SHALL NOT issue a second `GET /terminals/:id` (or any extra request) solely to derive the campaign name. The page SHALL display a non-interactive placeholder element where the editor will live, labelled "Editor del contenuto disponibile nello Slice 5". The page SHALL expose an "Esporta" action button (see `terminals-import-export` capability).

The detail page SHALL consume the unwrapped `TerminalContent` emitted by `TerminalsApiService.get`, reading metadata as `t.meta.title`, `t.meta.public`, and `t.meta.hiddenId`. The page MUST NOT crash with `Cannot read properties of undefined` when the underlying `GET /terminals/:id` response is the wrapper envelope, because the service has already unwrapped it.

#### Scenario: Detail page renders metadata
- **WHEN** the admin navigates to `/terminals/t1`
- **THEN** the page renders the terminal's title, public flag badge, parent campaign label, and the editor placeholder

#### Scenario: Single terminal fetch
- **WHEN** the detail page loads `/terminals/t1`
- **THEN** exactly one `GET /terminals/t1` request is issued, and the campaign name is taken from `CurrentCampaignService.currentCampaign()` without an additional terminal or campaign fetch

#### Scenario: Detail page renders without crashing on the envelope response
- **WHEN** `GET /terminals/t1` returns the wrapper envelope `{ id, campaignId, title, content: { meta: { title: "guida", public: true } }, ... }`
- **THEN** the detail header renders the title and public badge with no runtime error (no `Cannot read properties of undefined` on `meta`)

#### Scenario: Editor placeholder visible
- **WHEN** the detail page is rendered
- **THEN** an element with the text "Editor del contenuto disponibile nello Slice 5" is present where the editor will be added in Slice 5

#### Scenario: Not-found state
- **WHEN** `GET /terminals/:id` returns 404
- **THEN** the page renders an empty-state message and a back-link to `/campaigns`

## ADDED Requirements

### Requirement: Terminals list campaign-existence check uses the cached campaign list
The terminals list page (`/campaigns/:campaignId/terminals`) SHALL determine whether the route's `campaignId` exists by consulting `CurrentCampaignService` (its cached `campaigns()` list or `currentCampaign()`), NOT by issuing a dedicated `GET /campaigns/:campaignId` solely as an existence guard. When the id is not found among the known campaigns, the page SHALL render its not-found state. The terminals themselves SHALL continue to load via `GET /campaigns/:campaignId/terminals`.

#### Scenario: No dedicated campaign fetch on list load
- **WHEN** the admin opens `/campaigns/c1/terminals`
- **THEN** the page issues `GET /campaigns/c1/terminals` for the list but does NOT issue a separate `GET /campaigns/c1` as an existence guard

#### Scenario: Unknown campaign id shows not-found
- **WHEN** the admin opens `/campaigns/:campaignId/terminals` for a `campaignId` not present in `CurrentCampaignService.campaigns()`
- **THEN** the page renders the campaign not-found state
