## 1. Dialog state & template

- [x] 1.1 Add a `jsonText` `signal<string>('')` and an `importing` `signal<boolean>(false)` to `ImportTerminalDialogComponent`; keep the existing `parseError` / `zodErrors` / `apiError` signals.
- [x] 1.2 Import the PrimeNG `InputTextarea` module (`pInputTextarea`, as used in `node-content-editor.ts`) and add it to the component `imports`.
- [x] 1.3 Add a `pInputTextarea` textarea to the template bound two-way to `jsonText` (e.g. `[(ngModel)]` or value + input handler), styled consistently with the backoffice; place it below the `p-fileupload`.
- [x] 1.4 Add "Controlla JSON" and "Importa" buttons using `bo-btn` classes in the dialog footer alongside "Chiudi"; bind `[disabled]` on "Importa" to a trimmed-empty check on `jsonText()` (and to `importing()`).

## 2. File-to-textarea population

- [x] 2.1 Rewrite `onFileSelect` to read the file via `FileReader.readAsText` and write into `jsonText` only: pretty-print (`JSON.stringify(parsed, null, 2)`) when `JSON.parse` succeeds, otherwise write the raw text verbatim.
- [x] 2.2 Ensure `onFileSelect` makes no API call and surfaces no validation errors; clear stale error signals on file select.

## 3. Shared validation + actions

- [x] 3.1 Add a private `validate()` that clears the error signals, runs `JSON.parse` then `TerminalContentSchema.safeParse` on `jsonText()`, sets `parseError` / `zodErrors` on failure, and returns the parsed data or `null`.
- [x] 3.2 Implement "Controlla JSON" handler: call `validate()`; on success rewrite `jsonText` with the 2-space-indented serialization and show a "JSON valido" confirmation; on failure leave errors rendered. No API call.
- [x] 3.3 Implement "Importa" handler: call `validate()`; abort if it returns `null`; otherwise set `importing` and call `api.import(campaignId, data)`, reusing the existing success (toast, `imported.emit`, `closed.emit`) and error (`apiError`) handling, resetting `importing` on completion.

## 4. Verification

- [ ] 4.1 Manually verify the four spec scenarios: pretty-print on valid file, raw text on unparseable file, empty-disabled import, and check-without-import for invalid and valid content.
- [x] 4.2 Run the project lint/build and any existing import-dialog tests; confirm `terminals-list.ts` still works unchanged against the `imported` / `closed` outputs.
