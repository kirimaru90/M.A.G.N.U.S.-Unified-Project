## MODIFIED Requirements

### Requirement: Terminals API service wraps HttpClient
A `TerminalsApiService` (`src/app/core/terminal/terminals-api.service.ts`) SHALL expose methods: `listByCampaign(campaignId): Observable<TerminalDto[]>`, `create(campaignId, content): Observable<TerminalDto>`, `import(campaignId, content): Observable<TerminalDto>`, `get(id): Observable<TerminalContent & Meta>`, `delete(id): Observable<void>`, `export(id): Observable<TerminalContent>`. Components SHALL NOT call `HttpClient` directly for terminal endpoints.

`listByCampaign` SHALL accept the flat list response shape (`{ id, campaignId, title, isPublic, viewCount, createdAt, updatedAt }`) and map each item into a nested `TerminalDto` (`meta.title` from `title`, `meta.public` from `isPublic`, `views` from `viewCount`) before emitting, so consumers receive the `meta`-nested shape consistent with the terminal detail page.

`get(id)` SHALL accept the wrapper envelope returned by `GET /terminals/:id` (`{ id, campaignId, title, content: TerminalContent, state, fictionalUsers, createdAt, updatedAt }`) and unwrap it at the service boundary, emitting only the inner `content` so consumers receive a plain `TerminalContent` they can dereference (`meta.title`, `meta.public`, `meta.hiddenId`) without crashing.

#### Scenario: Service is the only consumer of terminal endpoints
- **WHEN** the project is searched for direct `HttpClient` calls to `/terminals` or `/campaigns/:id/terminals` paths
- **THEN** the only matches are inside `TerminalsApiService`

#### Scenario: listByCampaign maps the flat response into TerminalDto
- **WHEN** `GET /campaigns/c1/terminals` returns `[{ id, campaignId, title: "guida", isPublic: true, viewCount: 9, createdAt, updatedAt }]`
- **THEN** `listByCampaign` emits a `TerminalDto` whose `meta.title` is `"guida"`, `meta.public` is `true`, and `views` is `9`

#### Scenario: get unwraps the detail envelope into TerminalContent
- **WHEN** `GET /terminals/t1` returns `{ id, campaignId, title: "guida", content: { meta: { title: "guida", public: true, hiddenId: "guida" }, state, nodes, login }, state: {}, fictionalUsers: [], createdAt, updatedAt }`
- **THEN** `get('t1')` emits the inner `content` object, so the subscriber can read `result.meta.title === "guida"` and `result.meta.public === true` directly with no envelope nesting

### Requirement: Terminal detail page shows metadata and editor placeholder
The route `/terminals/:id` SHALL fetch the terminal via `GET /terminals/:id` and render a metadata panel showing: title, public flag, the parent campaign name (resolved via `CurrentCampaignService` or `CampaignsApiService` if the id is unknown locally), and a last-updated label if the API includes one. The page SHALL display a non-interactive placeholder element where the editor will live, labelled "Editor del contenuto disponibile nello Slice 5". The page SHALL expose an "Esporta" action button (see `terminals-import-export` capability).

The detail page SHALL consume the unwrapped `TerminalContent` emitted by `TerminalsApiService.get`, reading metadata as `t.meta.title`, `t.meta.public`, and `t.meta.hiddenId`. The page MUST NOT crash with `Cannot read properties of undefined` when the underlying `GET /terminals/:id` response is the wrapper envelope, because the service has already unwrapped it.

#### Scenario: Detail page renders metadata
- **WHEN** the admin navigates to `/terminals/t1`
- **THEN** the page renders the terminal's title, public flag badge, parent campaign label, and the editor placeholder

#### Scenario: Detail page renders without crashing on the envelope response
- **WHEN** `GET /terminals/t1` returns the wrapper envelope `{ id, campaignId, title, content: { meta: { title: "guida", public: true } }, ... }`
- **THEN** the detail header renders the title and public badge with no runtime error (no `Cannot read properties of undefined` on `meta`)

#### Scenario: Editor placeholder visible
- **WHEN** the detail page is rendered
- **THEN** an element with the text "Editor del contenuto disponibile nello Slice 5" is present where the editor will be added in Slice 5

#### Scenario: Not-found state
- **WHEN** `GET /terminals/:id` returns 404
- **THEN** the page renders an empty-state message and a back-link to `/campaigns`
