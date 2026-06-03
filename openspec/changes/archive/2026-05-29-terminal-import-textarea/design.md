## Context

`ImportTerminalDialogComponent` currently does everything in one `onFileSelect` handler: a selected file is read via `FileReader`, `JSON.parse`d, validated with `TerminalContentSchema.safeParse`, and — on success — immediately POSTed to the import API, which closes the dialog. There is no surface for pasting JSON or for inspecting/editing the payload before upload. The component already owns `parseError`, `zodErrors`, and `apiError` signals and emits `imported` / `closed`; the parent `terminals-list.ts` depends only on those outputs.

## Goals / Non-Goals

**Goals:**
- Make a JSON textarea the single source of truth for what gets imported.
- Let a file picker *populate* that textarea (pretty-printed when valid, raw when not) without importing.
- Provide a validate-only "Controlla JSON" action and a guarded "Importa" action.
- Keep styling consistent with the backoffice (`bo-btn` classes, PrimeNG `pInputTextarea`).

**Non-Goals:**
- No change to the import API, request shape, `TerminalContentSchema`, MSW handlers, export, or the parent list page.
- No live/keystroke validation — validation runs on button press only.
- No schema-aware editor affordances (autocomplete, inline node editing) — plain text editing only.

## Decisions

**1. Single `jsonText` signal as source of truth.**
A `signal<string>('')` backs a two-way-bound textarea. File select writes into it; both buttons read from it. Rationale: decouples "where the JSON came from" (file vs paste) from "what gets imported," which is the core of the request. Alternative considered — keeping the file as a separate path — was rejected because it reintroduces two divergent import sources.

**2. Shared private `validate()` returning parsed data or `null`.**
Both buttons call one method that clears the three error signals, runs `JSON.parse`, then `TerminalContentSchema.safeParse`, populating `parseError` / `zodErrors` on failure and returning `TerminalContentSchema`'s parsed output (or `null`). "Controlla JSON" stops at the result (and pretty-prints on success); "Importa" proceeds to `api.import()` only on a non-null result. Rationale: one validation path, no duplication, identical error UX for both buttons.

**3. File select reuses `validate`-style parsing only to pretty-print.**
`onFileSelect` reads the file text, attempts `JSON.parse`; on success it writes `JSON.stringify(parsed, null, 2)` into `jsonText`, on failure it writes the raw text verbatim. It does **not** run Zod and does **not** surface errors — the admin will trigger that via the buttons. The 1 MB `maxFileSize` and `.json` accept filter stay on `p-fileupload`. Rationale: matches the "load for verification/modification" intent; deferring validation to the buttons keeps a single error-reporting moment.

**4. Pretty-print on successful "Controlla JSON".**
When validation passes, rewrite `jsonText` with the 2-space-indented serialization of the parsed value, so "check" doubles as "tidy" and visibly canonicalizes what will be imported — consistent with the file-load behavior. A success confirmation ("JSON valido") is shown.

**5. "Importa" disabled when textarea is empty.**
`[disabled]` bound to a trimmed-empty check on `jsonText()` (and guarded against double-submit while a request is in flight). On click it validates first and aborts on any error before calling the API. Rationale: the request explicitly asked for empty-disable + validate-before-fire.

## Risks / Trade-offs

- **Pretty-print mutates user input on file load / check** → Acceptable and intended; only reformats when the JSON is valid, never alters semantics. Raw text is preserved when unparseable so nothing is lost.
- **Unbounded paste size** (the 1 MB limit only guards the file widget) → Low risk; the API and Zod validation still gate the payload, and oversized pastes fail validation or the API call rather than corrupting state. Noted as acceptable for this iteration.
- **No live feedback while typing** → Intentional per the chosen design; the "Controlla JSON" button covers on-demand verification.
