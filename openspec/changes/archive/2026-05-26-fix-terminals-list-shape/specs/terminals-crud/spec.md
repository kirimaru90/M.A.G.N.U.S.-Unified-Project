## MODIFIED Requirements

### Requirement: Terminals list page is scoped to a campaign
The route `/campaigns/:campaignId/terminals` SHALL render a PrimeNG `<p-table>` listing every terminal returned by `GET /campaigns/:campaignId/terminals`. The table SHALL include the following columns, in this order:

1. **Titolo** — terminal title (links to the detail page)
2. **Pubblico** — public flag badge
3. **Visualizzazioni** — the `views` count (times viewed); when `views` is `undefined` the cell SHALL render a placeholder (`—`) rather than an empty or `undefined` value
4. **Creato il** — the `createdAt` timestamp, formatted for display
5. **Aggiornato il** — the `updatedAt` timestamp, formatted for display (placeholder `—` when absent)
6. **Azioni** — row action buttons for open detail, export, delete

The list SHALL NOT render a "Codename" (`hiddenId`) column, because the `GET /campaigns/:campaignId/terminals` response does not include `hiddenId`.

Every data column (Titolo, Pubblico, Visualizzazioni, Creato il, Aggiornato il) SHALL be sortable by clicking its header; **Azioni** SHALL NOT be sortable. The page SHALL display a loading state while the request is in flight and an empty-state message ("Nessun terminale in questa campagna") when the list is empty.

#### Scenario: List loads terminals for the campaign
- **WHEN** an authenticated admin navigates to `/campaigns/c1/terminals`
- **THEN** the table renders one row per terminal returned by `GET /campaigns/c1/terminals`, showing the title, public badge, views, created/updated timestamps, and action buttons

#### Scenario: List renders without crashing on the flat API response
- **WHEN** `GET /campaigns/c1/terminals` returns flat terminal objects (`title`, `isPublic`, `viewCount`)
- **THEN** the table renders the title and public badge for each row with no runtime error (no `Cannot read properties of undefined` on `meta`)

#### Scenario: No Codename column is present
- **WHEN** the table header is rendered
- **THEN** there is no "Codename" column and no `hiddenId` sortable header

#### Scenario: Undefined views renders a placeholder
- **WHEN** a terminal row has no `views` value
- **THEN** the Visualizzazioni cell shows the placeholder `—` instead of `undefined`

#### Scenario: Columns are sortable
- **WHEN** the admin clicks the header of any data column (e.g. Creato il)
- **THEN** the rows reorder by that column's value, toggling ascending/descending on repeated clicks

#### Scenario: Empty state when no terminals exist
- **WHEN** `GET /campaigns/c1/terminals` returns an empty array
- **THEN** the table shows an empty-state message ("Nessun terminale in questa campagna") instead of rows

#### Scenario: Loading state during fetch
- **WHEN** the request to `GET /campaigns/c1/terminals` is in flight
- **THEN** the table renders a loading indicator (PrimeNG table skeleton or spinner)

### Requirement: Terminals API service wraps HttpClient
A `TerminalsApiService` (`src/app/core/terminal/terminals-api.service.ts`) SHALL expose methods: `listByCampaign(campaignId): Observable<TerminalDto[]>`, `create(campaignId, content): Observable<TerminalDto>`, `import(campaignId, content): Observable<TerminalDto>`, `get(id): Observable<TerminalContent & Meta>`, `delete(id): Observable<void>`, `export(id): Observable<TerminalContent>`. Components SHALL NOT call `HttpClient` directly for terminal endpoints.

`listByCampaign` SHALL accept the flat list response shape (`{ id, campaignId, title, isPublic, viewCount, createdAt, updatedAt }`) and map each item into a nested `TerminalDto` (`meta.title` from `title`, `meta.public` from `isPublic`, `views` from `viewCount`) before emitting, so consumers receive the `meta`-nested shape consistent with the terminal detail page.

#### Scenario: Service is the only consumer of terminal endpoints
- **WHEN** the project is searched for direct `HttpClient` calls to `/terminals` or `/campaigns/:id/terminals` paths
- **THEN** the only matches are inside `TerminalsApiService`

#### Scenario: listByCampaign maps the flat response into TerminalDto
- **WHEN** `GET /campaigns/c1/terminals` returns `[{ id, campaignId, title: "guida", isPublic: true, viewCount: 9, createdAt, updatedAt }]`
- **THEN** `listByCampaign` emits a `TerminalDto` whose `meta.title` is `"guida"`, `meta.public` is `true`, and `views` is `9`
