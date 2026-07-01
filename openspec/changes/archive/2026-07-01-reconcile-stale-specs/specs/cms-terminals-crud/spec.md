## MODIFIED Requirements

### Requirement: Terminal detail page shows metadata and editor
The route `/terminals/:id` SHALL fetch the terminal via a **single** `GET /terminals/:id` and render a metadata panel showing: title, public flag, the parent campaign name, and a last-updated label if the API includes one. The parent campaign name SHALL be resolved **synchronously** from `CurrentCampaignService.currentCampaign()` (mirroring the page's back-link); the page SHALL NOT issue a second `GET /terminals/:id` (or any extra request) solely to derive the campaign name. The page SHALL mount the full content editor (owned by the `cms-terminal-editor-shell` capability) in place of the terminal body; it SHALL NOT render a "Slice 5" placeholder. The page SHALL expose an "Esporta" action button (see `cms-terminals-import-export` capability).

The detail page SHALL consume the unwrapped `TerminalContent` emitted by `TerminalsApiService.get`, reading metadata as `t.meta.title`, `t.meta.public`, and `t.meta.hiddenId`. The page MUST NOT crash with `Cannot read properties of undefined` when the underlying `GET /terminals/:id` response is the wrapper envelope, because the service has already unwrapped it.

#### Scenario: Detail page renders metadata
- **WHEN** the admin navigates to `/terminals/t1`
- **THEN** the page renders the terminal's title, public flag badge, parent campaign label, and the mounted content editor

#### Scenario: Single terminal fetch
- **WHEN** the detail page loads `/terminals/t1`
- **THEN** exactly one `GET /terminals/t1` request is issued, and the campaign name is taken from `CurrentCampaignService.currentCampaign()` without an additional terminal or campaign fetch

#### Scenario: Detail page renders without crashing on the envelope response
- **WHEN** `GET /terminals/t1` returns the wrapper envelope `{ id, campaignId, title, content: { meta: { title: "guida", public: true } }, ... }`
- **THEN** the detail header renders the title and public badge with no runtime error (no `Cannot read properties of undefined` on `meta`)

#### Scenario: Editor is mounted, no placeholder
- **WHEN** the detail page is rendered
- **THEN** the content editor is present and no "Editor del contenuto disponibile nello Slice 5" placeholder element exists

#### Scenario: Not-found state
- **WHEN** `GET /terminals/:id` returns 404
- **THEN** the page renders an empty-state message and a back-link to `/campaigns`
