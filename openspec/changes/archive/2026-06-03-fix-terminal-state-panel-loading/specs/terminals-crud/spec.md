## MODIFIED Requirements

### Requirement: Terminals API service wraps HttpClient
A `TerminalsApiService` (`src/app/core/terminal/terminals-api.service.ts`) SHALL expose methods: `listByCampaign(campaignId): Observable<TerminalDto[]>`, `create(campaignId, content): Observable<TerminalDto>`, `import(campaignId, content): Observable<TerminalDto>`, `get(id): Observable<TerminalContent & Meta>`, `getEnvelope(id): Observable<TerminalDetailEnvelope>`, `delete(id): Observable<void>`, `export(id): Observable<TerminalContent>`. Components SHALL NOT call `HttpClient` directly for terminal endpoints.

`listByCampaign` SHALL accept the flat list response shape (`{ id, campaignId, title, isPublic, viewCount, createdAt, updatedAt }`) and map each item into a nested `TerminalDto` (`meta.title` from `title`, `meta.public` from `isPublic`, `views` from `viewCount`) before emitting, so consumers receive the `meta`-nested shape consistent with the terminal detail page.

`get(id)` SHALL accept the wrapper envelope returned by `GET /terminals/:id` (`{ id, campaignId, title, content: TerminalContent, state, fictionalUsers, createdAt, updatedAt }`) and unwrap it at the service boundary, emitting only the inner `content` so consumers receive a plain `TerminalContent` they can dereference (`meta.title`, `meta.public`, `meta.hiddenId`) without crashing.

`getEnvelope(id)` SHALL return the full `TerminalDetailEnvelope` without stripping, giving consumers access to both `content` (the terminal document including `state.local` schema) and `state` (the flat runtime values map). This method SHALL NOT apply any Zod parsing — callers are responsible for consuming the data they need.

#### Scenario: Service is the only consumer of terminal endpoints
- **WHEN** the project is searched for direct `HttpClient` calls to `/terminals` or `/campaigns/:id/terminals` paths
- **THEN** the only matches are inside `TerminalsApiService`

#### Scenario: listByCampaign maps the flat response into TerminalDto
- **WHEN** `GET /campaigns/c1/terminals` returns `[{ id, campaignId, title: "guida", isPublic: true, viewCount: 9, createdAt, updatedAt }]`
- **THEN** `listByCampaign` emits a `TerminalDto` whose `meta.title` is `"guida"`, `meta.public` is `true`, and `views` is `9`

#### Scenario: get unwraps the detail envelope into TerminalContent
- **WHEN** `GET /terminals/t1` returns `{ id, campaignId, title: "guida", content: { meta: { title: "guida", public: true, hiddenId: "guida" }, state, nodes, login }, state: {}, fictionalUsers: [], createdAt, updatedAt }`
- **THEN** `get('t1')` emits the inner `content` object, so the subscriber can read `result.meta.title === "guida"` and `result.meta.public === true` directly with no envelope nesting

#### Scenario: getEnvelope returns the full envelope with runtime state
- **WHEN** `GET /terminals/t1` returns `{ id, content: { state: { local: { flag: { type: "boolean", default: false } } } }, state: { flag: true }, ... }`
- **THEN** `getEnvelope('t1')` emits the full envelope so the caller can read both `envelope.content.state.local` (schema) and `envelope.state` (current values)
