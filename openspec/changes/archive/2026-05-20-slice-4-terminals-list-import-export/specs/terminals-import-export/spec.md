## ADDED Requirements

### Requirement: Import dialog accepts a .json file via PrimeNG file upload
The terminals list page SHALL expose an "Importa terminale" button that opens a dialog with a PrimeNG `<p-fileupload mode="basic">` restricted to `accept=".json,application/json"` and a 1 MB size limit. The dialog SHALL show no destination-campaign picker — the upload target is always the campaign in the current route (`/campaigns/:campaignId/terminals`).

#### Scenario: File picker is restricted to JSON
- **WHEN** the import dialog renders
- **THEN** the file input attribute restricts the file picker to `.json` and `application/json` MIME types

#### Scenario: Oversized file is rejected client-side
- **WHEN** the admin selects a file larger than 1 MB
- **THEN** the upload widget rejects the file with a size-limit error and no parsing is attempted

### Requirement: Imported JSON is validated against TerminalContentSchema before upload
After the file is selected, the dialog SHALL read it via `FileReader.readAsText`, parse it with `JSON.parse`, and then validate the parsed value against `TerminalContentSchema` from `src/app/domain/terminal-schema.ts`. The dialog SHALL NOT call the import API until validation succeeds.

#### Scenario: Malformed JSON is reported with a generic message
- **WHEN** the selected file's contents are not valid JSON (`JSON.parse` throws)
- **THEN** the dialog renders a single error "Il file non è un JSON valido." and no API call is made

#### Scenario: Valid JSON that fails Zod validation surfaces path-level errors
- **WHEN** the file parses as JSON but `TerminalContentSchema.safeParse` returns `success: false`
- **THEN** the dialog renders a list (one `<li>` per issue) with each entry containing the issue's joined path and message
- **AND** no API call is made

#### Scenario: Valid file is forwarded to the API
- **WHEN** `TerminalContentSchema.safeParse` succeeds
- **THEN** `POST /campaigns/:campaignId/terminals/import` is called with the parsed object as the request body

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
