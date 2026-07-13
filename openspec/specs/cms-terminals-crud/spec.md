# cms-terminals-crud Specification

## Purpose

Campaign-agnostic `/terminals` list (campaign resolved from the in-page selector / CurrentCampaignService) with sortable columns, dialog create producing a valid schema stub, confirm-gated delete, a title-header-and-editor detail page, and a TerminalsApiService that maps/unwraps API shapes.

## Requirements

### Requirement: Terminals list page is campaign-agnostic in the route and reads the current campaign
The route `/terminals` SHALL render the terminals list. It SHALL NOT carry the campaign id in the URL (the previous `/campaigns/:campaignId/terminals` route is superseded). The page SHALL host the in-page campaign selector (see `cms-campaign-workspace-switcher`) at the top and SHALL resolve the active campaign from `CurrentCampaignService.currentCampaign()`. When a campaign is selected, the page SHALL render a PrimeNG `<p-table>` listing every terminal returned by `GET /campaigns/:campaignId/terminals` for that campaign's id. When **no** campaign is selected, the page SHALL render an empty state prompting the admin to select a campaign first, and SHALL NOT render the table.

The table SHALL include the following columns, in this order:

1. **Titolo** — terminal title (links to the detail page)
2. **Pubblico** — public flag badge
3. **Visualizzazioni** — the `views` count (times viewed); when `views` is `undefined` the cell SHALL render a placeholder (`—`) rather than an empty or `undefined` value
4. **Creato il** — the `createdAt` timestamp, formatted for display
5. **Aggiornato il** — the `updatedAt` timestamp, formatted for display (placeholder `—` when absent)
6. **Azioni** — row action buttons for open detail, export, delete

The list SHALL NOT render a "Codename" (`hiddenId`) column, because the `GET /campaigns/:campaignId/terminals` response does not include `hiddenId`.

Every data column (Titolo, Pubblico, Visualizzazioni, Creato il, Aggiornato il) SHALL be sortable by clicking its header; **Azioni** SHALL NOT be sortable. The page SHALL display a loading state while the request is in flight and an empty-state message ("Nessun terminale in questa campagna") when a campaign is selected but its list is empty. The page's primary actions ("Nuovo terminale", "Importa terminale") SHALL appear in the page-head row aligned right (see `cms-backoffice-table-conventions`).

#### Scenario: List loads terminals for the selected campaign
- **WHEN** a campaign `c1` is selected and the admin is on `/terminals`
- **THEN** the table renders one row per terminal returned by `GET /campaigns/c1/terminals`, showing the title, public badge, views, created/updated timestamps, and action buttons

#### Scenario: Empty state prompts to select a campaign
- **WHEN** the admin is on `/terminals` and `CurrentCampaignService.currentCampaign()` is null
- **THEN** the page shows an empty state prompting the admin to select a campaign first, and no terminals table is rendered

#### Scenario: Selecting a campaign loads its terminals without navigation
- **WHEN** the admin picks a campaign in the in-page selector while on `/terminals`
- **THEN** the list loads that campaign's terminals in place, with no change to the `/terminals` URL

#### Scenario: No Codename column is present
- **WHEN** the table header is rendered
- **THEN** there is no "Codename" column and no `hiddenId` sortable header

#### Scenario: Undefined views renders a placeholder
- **WHEN** a terminal row has no `views` value
- **THEN** the Visualizzazioni cell shows the placeholder `—` instead of `undefined`

#### Scenario: Columns are sortable
- **WHEN** the admin clicks the header of any data column (e.g. Creato il)
- **THEN** the rows reorder by that column's value, toggling ascending/descending on repeated clicks

#### Scenario: Empty state when the selected campaign has no terminals
- **WHEN** `GET /campaigns/c1/terminals` returns an empty array for the selected campaign
- **THEN** the table shows an empty-state message ("Nessun terminale in questa campagna") instead of rows

#### Scenario: Loading state during fetch
- **WHEN** the request to `GET /campaigns/c1/terminals` is in flight
- **THEN** the table renders a loading indicator (PrimeNG table skeleton or spinner)

### Requirement: Sidebar exposes an always-enabled Terminali entry
The app sidebar SHALL include a "Terminali" navigation entry that is **always enabled** and links to the campaign-agnostic `/terminals` route. It SHALL NOT be disabled based on whether a campaign is selected, because campaign selection now happens inside the terminals page. When no campaign is selected, following the link lands on the terminals page's select-a-campaign empty state.

#### Scenario: Sidebar link is always enabled
- **WHEN** the shell renders, whether or not a campaign is selected
- **THEN** the sidebar "Terminali" entry is enabled and routes to `/terminals` on click

#### Scenario: Following the link with no campaign shows the empty state
- **WHEN** no campaign is selected and the admin clicks "Terminali"
- **THEN** the router navigates to `/terminals` and the page shows the select-a-campaign empty state

### Requirement: Create/import terminal source the campaign from the current-campaign service
The terminals list page SHALL expose "Nuovo terminale" and "Importa terminale" actions. Because the route no longer carries the campaign id, the create and import flows SHALL source the target `campaignId` from `CurrentCampaignService.currentCampaign()` rather than from a route parameter. On submit, the backoffice SHALL construct a minimal valid terminal stub conforming to `TerminalContentSchema` — `meta = { id, title, public }`, `state = { local: {}, global: {} }`, `login = { users: [] }`, `nodes = { start: { text: <placeholder>, choices: [] } }` — and call `POST /campaigns/:campaignId/terminals` with that body for the current campaign. On success the dialog closes and the list refreshes.

#### Scenario: Create uses the current campaign id
- **WHEN** a campaign `c1` is selected and the admin submits a valid title in the create dialog
- **THEN** `POST /campaigns/c1/terminals` is called with a body that satisfies `TerminalContentSchema` and the new terminal appears in the list after refresh

#### Scenario: Empty title is rejected by Zod
- **WHEN** the admin submits the create form with an empty title
- **THEN** a `.bo-field-error` appears below the title field reading "Il titolo è obbligatorio" and no API call is made

#### Scenario: Stub round-trips through the schema
- **WHEN** the dialog constructs the stub for a given title and public flag
- **THEN** `TerminalContentSchema.safeParse` succeeds against the generated stub before any network call

### Requirement: Terminal detail page shows the title header, actions, and editor
The route `/terminals/:id` SHALL fetch the terminal via a **single** `GET /terminals/:id` and render a page head containing the terminal title, a back-link to the terminals list, and the page actions (Esporta, plus the editor's Annulla modifiche / Salva — see `cms-terminal-editor-shell`) aligned to the right of the title row. The page SHALL NOT render a separate non-editable summary panel duplicating the public flag, campaign name, and hidden id; those values are presented and edited within the editor's metadata section. The page SHALL mount the full content editor (owned by the `cms-terminal-editor-shell` capability) in place of the terminal body; it SHALL NOT render a "Slice 5" placeholder.

The detail page SHALL obtain the terminal via `TerminalsApiService.getEnvelope` (the single `GET /terminals/:id`) so it has access to both the unwrapped `content` and the sibling `fictionalUsers` array, and SHALL pass both into the mounted editor. It SHALL read metadata as `content.meta.title`, `content.meta.public`, and `content.meta.hiddenId`. The page MUST NOT crash with `Cannot read properties of undefined` when handling the envelope, and MUST NOT source fictional-user passwords from `content.login.users` (which is password-free by API contract).

#### Scenario: Detail page renders the title header and editor
- **WHEN** the admin navigates to `/terminals/t1`
- **THEN** the page head shows the terminal's title with the back-link and right-aligned actions, and the mounted content editor is rendered below

#### Scenario: No non-editable summary panel
- **WHEN** the detail page is rendered
- **THEN** there is no separate read-only summary card listing Visibilità / Campagna / ID nascosto; those fields appear only in the editor's metadata section

#### Scenario: Single terminal fetch
- **WHEN** the detail page loads `/terminals/t1`
- **THEN** exactly one `GET /terminals/t1` request is issued, and no additional terminal or campaign fetch is made solely to render the header

#### Scenario: Fictional passwords reach the editor
- **WHEN** `GET /terminals/t1` returns an envelope with `fictionalUsers: [{ username: "tecnico", password: "robco123" }]` and `content.login.users: [{ username: "tecnico" }]`
- **THEN** the mounted editor's fictional-users section shows the password `"robco123"` for "tecnico" (sourced from `fictionalUsers`, not from `content.login.users`)

#### Scenario: Detail page renders without crashing on the envelope response
- **WHEN** `GET /terminals/t1` returns the wrapper envelope `{ id, campaignId, title, content: { meta: { title: "guida", public: true } }, fictionalUsers: [], ... }`
- **THEN** the detail header renders the title with no runtime error (no `Cannot read properties of undefined` on `meta`)

#### Scenario: Editor is mounted, no placeholder
- **WHEN** the detail page is rendered
- **THEN** the content editor is present and no "Editor del contenuto disponibile nello Slice 5" placeholder element exists

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
