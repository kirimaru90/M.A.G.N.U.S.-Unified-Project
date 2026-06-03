### Requirement: Import dialog accepts a .json file via PrimeNG file upload
The terminals list page SHALL expose an "Importa terminale" button that opens a dialog containing a JSON textarea and a PrimeNG `<p-fileupload mode="basic">` restricted to `accept=".json,application/json"` with a 1 MB size limit. The textarea SHALL be the single source of truth for the content that gets imported. Selecting a file SHALL populate the textarea rather than triggering an import: when the file's contents parse as JSON the textarea SHALL be filled with the value re-serialized with a 2-space indent, and when they do not parse the textarea SHALL be filled with the raw file text unchanged. File selection SHALL NOT call the import API and SHALL NOT surface validation errors. The dialog SHALL show no destination-campaign picker — the upload target is always the campaign in the current route (`/campaigns/:campaignId/terminals`). The textarea SHALL use PrimeNG `pInputTextarea` and the dialog actions SHALL use the backoffice `bo-btn` button classes, consistent with the rest of the backoffice.

#### Scenario: File picker is restricted to JSON
- **WHEN** the import dialog renders
- **THEN** the file input attribute restricts the file picker to `.json` and `application/json` MIME types
- **AND** a JSON textarea is rendered alongside the file upload

#### Scenario: Oversized file is rejected client-side
- **WHEN** the admin selects a file larger than 1 MB
- **THEN** the upload widget rejects the file with a size-limit error and the textarea is not populated

#### Scenario: Selecting a valid JSON file pretty-prints it into the textarea
- **WHEN** the admin selects a file whose contents parse as JSON
- **THEN** the textarea is populated with the parsed value re-serialized using a 2-space indent
- **AND** no import API call is made

#### Scenario: Selecting an unparseable file loads raw text for correction
- **WHEN** the admin selects a file whose contents are not valid JSON
- **THEN** the textarea is populated with the raw file text unchanged
- **AND** no error is shown and no import API call is made

### Requirement: Imported JSON is validated against TerminalContentSchema before upload
Validation and import SHALL operate on the textarea content, triggered by dedicated buttons rather than on file selection. The dialog SHALL parse the textarea content with `JSON.parse` and validate the parsed value against `TerminalContentSchema` from `src/app/domain/terminal-schema.ts`. The dialog SHALL NOT call the import API until validation succeeds. The "Importa" button SHALL be disabled while the textarea is empty, and on activation SHALL validate first and abort the import if any parse or schema error is found.

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

### Requirement: Dialog provides a validate-only "Controlla JSON" action
The import dialog SHALL expose a "Controlla JSON" button that parses and validates the textarea content against `TerminalContentSchema` without calling the import API. When validation fails it SHALL surface the same parse/Zod errors as the import path. When validation succeeds it SHALL reformat the textarea by re-serializing the parsed value with a 2-space indent and SHALL indicate the content is valid.

#### Scenario: Checking invalid content shows errors without importing
- **WHEN** the admin activates "Controlla JSON" and the textarea content fails `JSON.parse` or `TerminalContentSchema.safeParse`
- **THEN** the corresponding parse or path-level Zod errors are rendered
- **AND** no import API call is made

#### Scenario: Checking valid content reformats and confirms
- **WHEN** the admin activates "Controlla JSON" and the textarea content passes `TerminalContentSchema.safeParse`
- **THEN** the textarea is rewritten with the parsed value serialized using a 2-space indent
- **AND** a "JSON valido" confirmation is shown and no import API call is made

### Requirement: Successful import refreshes the list and closes the dialog
On a 2xx response from `POST /campaigns/:campaignId/terminals/import`, the dialog SHALL close, the terminals list SHALL be re-fetched, and a PrimeNG toast SHALL indicate "Terminale importato" with severity `success`.

#### Scenario: Successful import closes the dialog and refreshes
- **WHEN** the API responds 2xx to the import request
- **THEN** the import dialog closes, the table re-runs `GET /campaigns/:campaignId/terminals`, and a success toast appears

#### Scenario: API error keeps the dialog open
- **WHEN** the API responds with a non-2xx status to the import request
- **THEN** the dialog stays open and renders a non-blocking error message including the API error body when present

### Requirement: Export button on the detail page downloads a JSON file
The terminal detail page SHALL expose an "Esporta" button. Clicking it SHALL call `POST /terminals/:id/export` and trigger a browser download of the returned JSON, pretty-printed with a 2-space indent. The download filename SHALL be `<terminal.meta.id>.json`.

#### Scenario: Export triggers a download
- **WHEN** the admin clicks "Esporta" on `/terminals/t1`
- **THEN** `POST /terminals/t1/export` is called and the browser downloads a file named `<meta.id>.json` whose contents are the API response serialized as JSON with 2-space indent

#### Scenario: Export error surfaces a toast
- **WHEN** the export API responds with a non-2xx status
- **THEN** a PrimeNG error toast appears with severity `error` and no download is triggered

### Requirement: Export then import round-trips through the same canonical schema
A terminal JSON file produced by the export endpoint SHALL parse successfully against `TerminalContentSchema` when re-imported. The backoffice SHALL NOT modify the JSON between download and upload.

#### Scenario: Round-trip validation
- **WHEN** an admin exports terminal T to a file F, then immediately imports F into the same campaign
- **THEN** the import passes Zod validation and the API responds 2xx, producing a new terminal in the campaign
