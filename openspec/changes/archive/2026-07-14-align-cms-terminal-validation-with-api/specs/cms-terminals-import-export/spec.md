## MODIFIED Requirements

### Requirement: Imported JSON is validated against TerminalContentSchema before upload
Validation and import SHALL operate on the textarea content, triggered by dedicated buttons rather than on file selection. The dialog SHALL parse the textarea content with `JSON.parse` and validate the parsed value against `TerminalContentSchema` from `src/app/domain/terminal-schema.ts`. The dialog SHALL NOT call the import API until validation succeeds. The "Importa" button SHALL be disabled while the textarea is empty, and on activation SHALL validate first and abort the import if any parse or schema error is found. Before the request body is sent, a server-owned `meta.id` SHALL be stripped from the content so that a file containing `meta.id` imports successfully instead of being rejected by the API.

#### Scenario: Malformed JSON is reported with a generic message
- **WHEN** the textarea content is not valid JSON (`JSON.parse` throws) and the admin activates validation or import
- **THEN** the dialog renders a single error "Il file non è un JSON valido." and no API call is made

#### Scenario: Valid JSON that fails Zod validation surfaces path-level errors
- **WHEN** the textarea content parses as JSON but `TerminalContentSchema.safeParse` returns `success: false` and the admin activates validation or import
- **THEN** the dialog renders a list (one `<li>` per issue) with each entry containing the issue's joined path and message
- **AND** no API call is made

#### Scenario: Import button is disabled when the textarea is empty
- **WHEN** the textarea is empty
- **THEN** the "Importa" button is disabled and cannot trigger an import

#### Scenario: Valid content is forwarded to the API on import
- **WHEN** the admin activates "Importa" and `TerminalContentSchema.safeParse` succeeds on the textarea content
- **THEN** `POST /campaigns/:campaignId/terminals/import` is called with the parsed object as the request body

#### Scenario: A server-owned meta.id is stripped before upload
- **WHEN** the admin imports content whose `meta` includes an `id` (e.g. `meta: { id: "leftover-1", title: "Demo" }`) and validation succeeds
- **THEN** the request body sent to `POST /campaigns/:campaignId/terminals/import` has no `meta.id`
- **AND** the import succeeds instead of failing with an API 400

## ADDED Requirements

### Requirement: Terminal write requests strip server-owned meta.id
Every CMS call that writes terminal content — create (`POST /campaigns/:id/terminals`), import (`POST /campaigns/:id/terminals/import`), and update (`PUT /terminals/:id`) — SHALL remove a server-owned `meta.id` from the request body before sending. `meta.id` is injected by the API on read; the client SHALL never send it back, because the API rejects a non-empty `meta.id` with HTTP 400.

#### Scenario: Create strips meta.id
- **WHEN** the CMS creates a terminal from content that carries a `meta.id`
- **THEN** the posted body has no `meta.id`

#### Scenario: Update strips a loaded meta.id
- **WHEN** the CMS saves an edited terminal whose loaded content still carries the server-injected `meta.id`
- **THEN** the `PUT` body has no `meta.id` and the save does not fail with an API 400
