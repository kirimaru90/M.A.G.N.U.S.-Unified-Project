## MODIFIED Requirements

### Requirement: Export button on the detail page downloads a JSON file
The terminal detail page SHALL expose an "Esporta" button. Clicking it SHALL call `POST /terminals/:id/export` and trigger a browser download of the returned JSON, pretty-printed with a 2-space indent. Because `meta.id` is deliberately stripped from exported terminals and is not available client-side, the download filename SHALL be derived from a stable client-side identifier: `<hiddenId>.json` when the terminal has a `hiddenId`, otherwise a slug of the terminal title (e.g. `<title-slug>.json`).

#### Scenario: Export triggers a download
- **WHEN** the admin clicks "Esporta" on `/terminals/t1`
- **THEN** `POST /terminals/t1/export` is called and the browser downloads a file whose name is the terminal's `hiddenId` slug (or a title slug when no `hiddenId` exists), with contents equal to the API response serialized as JSON with 2-space indent

#### Scenario: Export error surfaces a toast
- **WHEN** the export API responds with a non-2xx status
- **THEN** a PrimeNG error toast appears with severity `error` and no download is triggered
