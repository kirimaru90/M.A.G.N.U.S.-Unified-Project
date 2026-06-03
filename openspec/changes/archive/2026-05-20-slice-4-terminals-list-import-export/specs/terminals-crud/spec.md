## ADDED Requirements

### Requirement: Terminals list page is scoped to a campaign
The route `/campaigns/:campaignId/terminals` SHALL render a PrimeNG `<p-table>` listing every terminal returned by `GET /campaigns/:campaignId/terminals`. The table SHALL include the following columns, in this order:

1. **Codename** — the terminal's `hiddenId`
2. **Titolo** — terminal title (links to the detail page)
3. **Pubblico** — public flag badge
4. **Visualizzazioni** — the `views` count (times viewed); when `views` is `undefined` the cell SHALL render a placeholder (`—`) rather than an empty or `undefined` value
5. **Creato il** — the `createdAt` timestamp, formatted for display
6. **Aggiornato il** — the `updatedAt` timestamp, formatted for display (placeholder `—` when absent)
7. **Azioni** — row action buttons for open detail, export, delete

Every data column (Codename, Titolo, Pubblico, Visualizzazioni, Creato il, Aggiornato il) SHALL be sortable by clicking its header; **Azioni** SHALL NOT be sortable. The page SHALL display a loading state while the request is in flight and an empty-state message ("Nessun terminale in questa campagna") when the list is empty.

#### Scenario: List loads terminals for the campaign
- **WHEN** an authenticated admin navigates to `/campaigns/c1/terminals`
- **THEN** the table renders one row per terminal returned by `GET /campaigns/c1/terminals`, showing the codename, title, public badge, views, created/updated timestamps, and action buttons

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

### Requirement: Sidebar exposes Terminali entry when a campaign is selected
The app sidebar SHALL include a "Terminali" navigation entry. The entry SHALL be enabled and linkable to `/campaigns/:campaignId/terminals` (using `CurrentCampaignService.currentCampaign()?.id`) when a campaign is selected. The entry SHALL be visibly disabled (or otherwise non-clickable) when no campaign is selected.

#### Scenario: Sidebar link active with a current campaign
- **WHEN** a campaign is selected in the workspace switcher
- **THEN** the sidebar "Terminali" entry routes to `/campaigns/<current-id>/terminals` on click

#### Scenario: Sidebar link disabled without a current campaign
- **WHEN** no campaign is selected
- **THEN** the "Terminali" entry is rendered in a disabled state and does not navigate on click

### Requirement: Create terminal via dialog produces a minimal valid stub
The terminals list page SHALL expose a "Nuovo terminale" button. Clicking it SHALL open a PrimeNG `<p-dialog>` containing a Reactive Form with **Titolo** (text input, required) and **Pubblico** (checkbox, default unchecked). On submit, the backoffice SHALL construct a minimal valid terminal stub conforming to `TerminalContentSchema` — `meta = { id, title, public }`, `state = { local: {}, global: {} }`, `login = { users: [] }`, `nodes = { start: { text: <placeholder>, choices: [] } }` — and call `POST /campaigns/:campaignId/terminals` with that body. On success the dialog closes and the list refreshes.

#### Scenario: Form submits valid data
- **WHEN** the admin enters a valid title and submits
- **THEN** `POST /campaigns/:campaignId/terminals` is called with a body that satisfies `TerminalContentSchema` and the new terminal appears in the list after refresh

#### Scenario: Empty title is rejected by Zod
- **WHEN** the admin submits the form with an empty title
- **THEN** a `.bo-field-error` appears below the title field reading "Il titolo è obbligatorio" and no API call is made

#### Scenario: Stub round-trips through the schema
- **WHEN** the dialog constructs the stub for a given title and public flag
- **THEN** `TerminalContentSchema.safeParse` succeeds against the generated stub before any network call

### Requirement: Terminal detail page shows metadata and editor placeholder
The route `/terminals/:id` SHALL fetch the terminal via `GET /terminals/:id` and render a metadata panel showing: title, public flag, the parent campaign name (resolved via `CurrentCampaignService` or `CampaignsApiService` if the id is unknown locally), and a last-updated label if the API includes one. The page SHALL display a non-interactive placeholder element where the editor will live, labelled "Editor del contenuto disponibile nello Slice 5". The page SHALL expose an "Esporta" action button (see `terminals-import-export` capability).

#### Scenario: Detail page renders metadata
- **WHEN** the admin navigates to `/terminals/t1`
- **THEN** the page renders the terminal's title, public flag badge, parent campaign label, and the editor placeholder

#### Scenario: Editor placeholder visible
- **WHEN** the detail page is rendered
- **THEN** an element with the text "Editor del contenuto disponibile nello Slice 5" is present where the editor will be added in Slice 5

#### Scenario: Not-found state
- **WHEN** `GET /terminals/:id` returns 404
- **THEN** the page renders an empty-state message and a back-link to `/campaigns`

### Requirement: Delete terminal with ConfirmDialog warns about state loss
Each terminals-list row SHALL expose a delete action (icon button). Clicking it SHALL open a PrimeNG `<p-confirmdialog>` with the message "Questa azione eliminerà il terminale e tutto lo stato locale associato. L'operazione non è reversibile." and severity `danger`. If the admin confirms, the backoffice SHALL call `DELETE /terminals/:id`. On success the row SHALL disappear from the list.

#### Scenario: Confirmation dialog appears before delete
- **WHEN** the admin clicks the delete action on a terminal row
- **THEN** a ConfirmDialog appears with the state-loss warning message before any API call is made

#### Scenario: Confirmed delete removes the terminal
- **WHEN** the admin confirms the deletion
- **THEN** `DELETE /terminals/:id` is called and the row disappears from the list

#### Scenario: Cancelled delete takes no action
- **WHEN** the admin clicks Cancel in the ConfirmDialog
- **THEN** no API call is made and the terminal remains in the list

### Requirement: Terminals API service wraps HttpClient
A `TerminalsApiService` (`src/app/core/terminal/terminals-api.service.ts`) SHALL expose methods: `listByCampaign(campaignId): Observable<TerminalDto[]>`, `create(campaignId, content): Observable<TerminalDto>`, `import(campaignId, content): Observable<TerminalDto>`, `get(id): Observable<TerminalContent & Meta>`, `delete(id): Observable<void>`, `export(id): Observable<TerminalContent>`. Components SHALL NOT call `HttpClient` directly for terminal endpoints.

#### Scenario: Service is the only consumer of terminal endpoints
- **WHEN** the project is searched for direct `HttpClient` calls to `/terminals` or `/campaigns/:id/terminals` paths
- **THEN** the only matches are inside `TerminalsApiService`
