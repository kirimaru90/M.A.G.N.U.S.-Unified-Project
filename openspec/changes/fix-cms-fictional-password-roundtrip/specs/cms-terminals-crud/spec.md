## MODIFIED Requirements

### Requirement: Terminal detail page shows metadata and editor
The route `/terminals/:id` SHALL fetch the terminal via a **single** `GET /terminals/:id` and render a metadata panel showing: title, public flag, the parent campaign name, and a last-updated label if the API includes one. The parent campaign name SHALL be resolved **synchronously** from `CurrentCampaignService.currentCampaign()` (mirroring the page's back-link); the page SHALL NOT issue a second `GET /terminals/:id` (or any extra request) solely to derive the campaign name. The page SHALL mount the full content editor (owned by the `cms-terminal-editor-shell` capability) in place of the terminal body; it SHALL NOT render a "Slice 5" placeholder. The page SHALL expose an "Esporta" action button (see `cms-terminals-import-export` capability).

The detail page SHALL obtain the terminal via `TerminalsApiService.getEnvelope` (the single `GET /terminals/:id`) so it has access to both the unwrapped `content` and the sibling `fictionalUsers` array, and SHALL pass both into the mounted editor. It SHALL read metadata as `content.meta.title`, `content.meta.public`, and `content.meta.hiddenId`. The page MUST NOT crash with `Cannot read properties of undefined` when handling the envelope, and MUST NOT source fictional-user passwords from `content.login.users` (which is password-free by API contract).

#### Scenario: Detail page renders metadata
- **WHEN** the admin navigates to `/terminals/t1`
- **THEN** the page renders the terminal's title, public flag badge, parent campaign label, and the mounted content editor

#### Scenario: Single terminal fetch
- **WHEN** the detail page loads `/terminals/t1`
- **THEN** exactly one `GET /terminals/t1` request is issued, and the campaign name is taken from `CurrentCampaignService.currentCampaign()` without an additional terminal or campaign fetch

#### Scenario: Fictional passwords reach the editor
- **WHEN** `GET /terminals/t1` returns an envelope with `fictionalUsers: [{ username: "tecnico", password: "robco123" }]` and `content.login.users: [{ username: "tecnico" }]`
- **THEN** the mounted editor's fictional-users section shows the password `"robco123"` for "tecnico" (sourced from `fictionalUsers`, not from `content.login.users`)

#### Scenario: Detail page renders without crashing on the envelope response
- **WHEN** `GET /terminals/t1` returns the wrapper envelope `{ id, campaignId, title, content: { meta: { title: "guida", public: true } }, fictionalUsers: [], ... }`
- **THEN** the detail header renders the title and public badge with no runtime error (no `Cannot read properties of undefined` on `meta`)

#### Scenario: Editor is mounted, no placeholder
- **WHEN** the detail page is rendered
- **THEN** the content editor is present and no "Editor del contenuto disponibile nello Slice 5" placeholder element exists

#### Scenario: Not-found state
- **WHEN** `GET /terminals/:id` returns 404
- **THEN** the page renders an empty-state message and a back-link to `/campaigns`

### Requirement: Terminals API service wraps HttpClient
A `TerminalsApiService` (`src/app/core/terminal/terminals-api.service.ts`) SHALL expose methods: `listByCampaign(campaignId): Observable<TerminalDto[]>`, `create(campaignId, content): Observable<TerminalDto>`, `import(campaignId, content): Observable<TerminalDto>`, `get(id): Observable<TerminalContent & Meta>`, `getEnvelope(id): Observable<TerminalDetailEnvelope>`, `update(id, content): Observable<TerminalDetailEnvelope>`, `delete(id): Observable<void>`, `export(id): Observable<TerminalContent>`. Components SHALL NOT call `HttpClient` directly for terminal endpoints.

`listByCampaign` SHALL accept the flat list response shape (`{ id, campaignId, title, isPublic, viewCount, createdAt, updatedAt }`) and map each item into a nested `TerminalDto` (`meta.title` from `title`, `meta.public` from `isPublic`, `views` from `viewCount`) before emitting, so consumers receive the `meta`-nested shape consistent with the terminal detail page.

`get(id)` SHALL accept the wrapper envelope returned by `GET /terminals/:id` (`{ id, campaignId, title, content: TerminalContent, state, fictionalUsers, createdAt, updatedAt }`) and unwrap it at the service boundary, emitting only the inner `content` so consumers receive a plain `TerminalContent` they can dereference (`meta.title`, `meta.public`, `meta.hiddenId`) without crashing.

`getEnvelope(id)` SHALL return the full `TerminalDetailEnvelope` without stripping, giving consumers access to `content` (the terminal document including `state.local` schema), `state` (the flat runtime values map), and `fictionalUsers` (the admin credential array including plaintext passwords). This method SHALL NOT apply any Zod parsing — callers are responsible for consuming the data they need.

`update(id, content)` SHALL issue `PUT /terminals/:id` and emit the full `TerminalDetailEnvelope` (content + `fictionalUsers`), matching the response shape now returned by the API, so the editor can both re-baseline its `content` and re-hydrate fictional-user passwords from `fictionalUsers` after a save. `update` SHALL NOT assume the response is a list-summary object.

#### Scenario: Service is the only consumer of terminal endpoints
- **WHEN** the project is searched for direct `HttpClient` calls to `/terminals` or `/campaigns/:id/terminals` paths
- **THEN** the only matches are inside `TerminalsApiService`

#### Scenario: listByCampaign maps the flat response into TerminalDto
- **WHEN** `GET /campaigns/c1/terminals` returns `[{ id, campaignId, title: "guida", isPublic: true, viewCount: 9, createdAt, updatedAt }]`
- **THEN** `listByCampaign` emits a `TerminalDto` whose `meta.title` is `"guida"`, `meta.public` is `true`, and `views` is `9`

#### Scenario: get unwraps the detail envelope into TerminalContent
- **WHEN** `GET /terminals/t1` returns `{ id, campaignId, title: "guida", content: { meta: { title: "guida", public: true, hiddenId: "guida" }, state, nodes, login }, state: {}, fictionalUsers: [], createdAt, updatedAt }`
- **THEN** `get('t1')` emits the inner `content` object, so the subscriber can read `result.meta.title === "guida"` and `result.meta.public === true` directly with no envelope nesting

#### Scenario: getEnvelope returns the full envelope with runtime state and fictional users
- **WHEN** `GET /terminals/t1` returns `{ id, content: { state: { local: { flag: { type: "boolean", default: false } } } }, state: { flag: true }, fictionalUsers: [{ username: "tecnico", password: "robco123" }], ... }`
- **THEN** `getEnvelope('t1')` emits the full envelope so the caller can read `envelope.content.state.local` (schema), `envelope.state` (current values), and `envelope.fictionalUsers` (credentials)

#### Scenario: update emits the envelope for re-baseline and password re-hydration
- **WHEN** `PUT /terminals/t1` responds 200 with `{ id, campaignId, title, content: { meta, state, nodes, login }, state: {}, fictionalUsers: [{ username: "tecnico", password: "robco123" }], createdAt, updatedAt }`
- **THEN** `update('t1', content)` emits the envelope so the editor can set its baseline from `content` and re-hydrate the "tecnico" password from `fictionalUsers`
