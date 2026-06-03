## Why

Today the import dialog imports a terminal the instant a `.json` file is picked: there is no chance to inspect, correct, or hand-author the payload before it hits the API. Admins who want to paste JSON from elsewhere, tweak an exported file, or simply verify what they're about to upload have no way to do so.

## What Changes

- Add a JSON textarea to the import dialog as the single source of truth for what gets imported.
- The file upload no longer imports directly — it **populates the textarea** (pretty-printed when the file is valid JSON, raw text when it is unparseable so the admin can fix it).
- Add a **"Controlla JSON"** button that parses + validates the textarea against `TerminalContentSchema` without calling the API, and reformats (pretty-prints) the textarea when the content is valid.
- The **"Importa"** button validates first and only calls the import API when the content is clean; it is disabled while the textarea is empty.
- Validation errors (malformed JSON, Zod path errors) surface on button press, not on file select.

## Capabilities

### New Capabilities
<!-- None. This change modifies existing import behavior only. -->

### Modified Capabilities
- `terminals-import-export`: the import dialog's input mechanism and the timing of parse/validation/API call change — file select now fills a textarea instead of importing, and import/validation move behind dedicated buttons. Export and round-trip requirements are unaffected.

## Impact

- **Code**: `src/app/features/terminals/import-terminal-dialog.ts` only (template + handler split into populate / validate / import). UI styling reuses existing `bo-btn` classes and PrimeNG `pInputTextarea` (as in `node-content-editor.ts`).
- **Unchanged**: `TerminalsApiService`, `TerminalContentSchema`, MSW handlers, and `terminals-list.ts` — the dialog keeps the same `imported` / `closed` output contract.
