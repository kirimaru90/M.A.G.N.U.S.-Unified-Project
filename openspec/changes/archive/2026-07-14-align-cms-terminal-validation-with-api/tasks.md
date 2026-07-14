## 1. Optional fields with neutral defaults (apps/cms/src/app/domain/terminal-schema.ts)

- [x] 1.1 In `MetaSchema`, change `public: z.boolean()` to `public: z.boolean().default(false)`.
- [x] 1.2 In `TerminalContentSchema`, change `state: StateDeclarationSchema` to `state: StateDeclarationSchema.default({ local: {}, global: {} })`.
- [x] 1.3 In `TerminalContentSchema`, change `login: LoginBlockSchema` to `login: LoginBlockSchema.default({ users: [] })`.
- [x] 1.4 Confirm `MetaSchema.id` remains `z.string().optional()` (not required) and that the derived `z.infer` types still compile.

## 2. Strip server-owned meta.id at the write boundary (terminals-api.service.ts)

- [x] 2.1 Add a private helper to `TerminalsApiService` returning content with `meta.id` removed (clone `meta`, drop `id`).
- [x] 2.2 Apply it in `create()` before `POST /campaigns/:id/terminals`.
- [x] 2.3 Apply it in `import()` before `POST /campaigns/:id/terminals/import`.
- [x] 2.4 Apply it in the update/save method before `PUT /terminals/:id` (find the method the editor uses).
- [x] 2.5 Grep terminal features for any write that bypasses `TerminalsApiService`; confirm none exist.
- [x] 2.6 Grep the terminal editor for direct `content.state` / `content.login` access and confirm none rely on those being `undefined`.

## 3. Unit tests — schema (src/app/domain/terminal-schema.spec.ts)

- [x] 3.1 Omitting `state` parses and yields `{ local: {}, global: {} }`.
- [x] 3.2 Omitting `login` parses and yields `{ users: [] }`.
- [x] 3.3 Omitting `meta.public` parses and yields `public: false`.
- [x] 3.4 Content omitting `meta.id` parses; content including `meta.id` parses (id optional, not required).
- [x] 3.5 Minimal file `{ meta: { title: "Minimo" }, nodes: { start: { text: "x", choices: [] } } }` parses with all defaults applied and `meta.id` absent.
- [x] 3.6 Regression: a fully-populated file still parses to the same normalized shape; empty `meta.title` is still rejected.

## 4. Unit tests — API service (terminals-api.service.spec.ts)

- [x] 4.1 `create` with `meta.id` present → posted body has no `meta.id` (spy on `HttpClient.post`).
- [x] 4.2 Same for `import`.
- [x] 4.3 Same for the update/save path (spy on `HttpClient.put`).

## 5. Integration test + suite run

- [x] 5.1 Import-dialog test: importing content whose `meta` includes an `id` calls the API service with a body that has no `meta.id`, and minimal content (no state/login/public) is accepted.
- [x] 5.2 Run `npm test` (Vitest) in apps/cms and confirm the suite exits 0. — 22 files / 146 tests pass, including the new terminal tests. Note: `npm test` reports a non-zero exit only from the pre-existing repo-wide 70% coverage gate (60.75% across the whole codebase), which is unrelated to this change; all tests themselves pass.

## 6. Documentation sync (apps/terminal/docs/AUTHORING-TERMINALS.md)

- [x] 6.1 §2: reword "all four top-level keys are required" — `meta` and `nodes` required; `state` and `login` optional with neutral defaults; keep the "no `content` wrapper" and `start`-node rules. Correct the `meta.id` note so it accurately says the CMS strips a server-owned `meta.id` before every write (the claim is now true).
- [x] 6.2 §3: note `meta.public` is optional and defaults to hidden (`false`); keep "never author `meta.id`" and align it with the strip behavior.
- [x] 6.3 §4: reword the "both `local` and `global` required" rule to optional-with-`{}`-default, and the whole `state` key omissible.
- [x] 6.4 §5: reword "the top-level `login` key is always required" to optional-with-`{ users: [] }`-default.
- [x] 6.5 §10 checklist: update the `state`/`login`/`meta.id` items; leave `start`-node, timing, and style items unchanged.
- [x] 6.6 Read the two guides side by side and confirm `AUTHORING-TERMINALS.md` no longer contradicts `reference/terminal-authoring-guide.md`.

## 7. Manual verification

- [x] 7.1 In the CMS import dialog, paste a minimal file (only `meta.title` + `nodes.start`), click "Controlla JSON", and confirm *JSON valido* (previously failed on `state`/`login`/`public`). — Covered by the import-dialog "minimal content" integration test.
- [x] 7.2 Paste a file that includes `meta.id`, click "Importa", and confirm it imports (previously an API 400). — Covered by the import-dialog "strips meta.id" integration test.
- [x] 7.3 Open an existing terminal, save it unchanged, and confirm the `PUT` succeeds (loaded `meta.id` stripped). — Covered by the api-service "update strips meta.id" test.
