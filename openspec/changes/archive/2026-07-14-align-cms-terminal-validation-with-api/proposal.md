## Why

The CMS terminal validator (Zod, `apps/cms/src/app/domain/terminal-schema.ts`) is out of sync
with the API it feeds, in two ways that both bite content authors:

1. **Over-strict optional fields.** The CMS requires `state`, `login`, and `meta.public` on
   every terminal, while the API (`terminal-content.dto.ts` + global `ValidationPipe`) treats
   `state`/`login` as optional and `meta.public` as optional-defaulting-to-`false`. A terminal
   the API would accept is rejected client-side with errors like
   `login: Invalid input: expected object, received undefined`.
2. **`meta.id` handled inconsistently across four surfaces.** The spec calls `meta.id`
   *required*; the CMS schema declares it *optional* and forwards it unchanged; the API
   *rejects* any non-empty `meta.id` on input with **HTTP 400** (`MetaDto.id` is `@IsEmpty`);
   and `AUTHORING-TERMINALS.md` claims the importer "strips/ignores `meta.id`" — which is
   currently false. So a pasted file (or a re-saved existing terminal) that carries `meta.id`
   passes CMS validation and then 400s at the API.

`reference/terminal-authoring-guide.md` already documents the intended end-state (only
`meta.title` + `nodes` required; `meta.id` server-owned, never authored). This change makes
the CMS match it.

## What Changes

- **Optional fields with neutral defaults** in the CMS Zod schema:
  - `state` → defaults to `{ "local": {}, "global": {} }`
  - `login` → defaults to `{ "users": [] }`
  - `meta.public` → defaults to `false`
- **`meta.id` becomes server-owned end to end:** the spec no longer calls it required, and the
  CMS **strips a server-owned `meta.id` on every write path** (create, import, update) before
  the request, so an authored/leftover `meta.id` is removed instead of causing a 400.
- After this change, only `meta.title` and `nodes` (with a `start` node) are required to write
  a terminal end-to-end; `state`, `login`, `meta.public` are optional with neutral defaults;
  and `meta.id` is never sent by the client.
- **Docs sync:** update `apps/terminal/docs/AUTHORING-TERMINALS.md` (§2/§3/§4/§5/§10) so the
  "all four keys required" and `meta.id` rules match the new behavior and stop contradicting
  `reference/terminal-authoring-guide.md`.
- Not a breaking change: files that already specify these fields (and omit `meta.id`) parse
  and write identically; only previously-rejected minimal files and files carrying `meta.id`
  now succeed.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cms-terminal-content-schema`: the "Meta block covers id, title, and public flag"
  requirement changes so only `title` is required — `id` is optional/server-owned and
  `public` is optional-defaulting-to-`false`; the `state` and `login` blocks become optional
  with neutral defaults.
- `cms-terminals-import-export`: the importer, and every terminal write request, SHALL strip a
  server-owned `meta.id` before calling the API, so content carrying `meta.id` writes
  successfully instead of 400ing.

## Impact

- **Code:**
  - `apps/cms/src/app/domain/terminal-schema.ts` — add `.default(...)` to `MetaSchema.public`
    and to the top-level `state` and `login` fields of `TerminalContentSchema`. `MetaSchema.id`
    stays `optional` (loaded content carries the server id; the type must keep it).
  - `apps/cms/src/app/core/terminal/terminals-api.service.ts` — strip `meta.id` from the body
    of the terminal write methods (`create`, `import`, update/save) at a single choke point.
- **Behavior:** `apps/cms/src/app/features/terminals/import-terminal-dialog.ts` — "Controlla
  JSON" / "Importa" now accept minimal files and files with a stray `meta.id`; the normalized
  object sent to the API is unchanged in shape (defaults fill gaps; `meta.id` removed).
- **Docs:** `apps/terminal/docs/AUTHORING-TERMINALS.md` updated for consistency.
- **Out of scope:** No API changes (the API already permits omission and correctly rejects a
  sent `meta.id`). `reference/terminal-authoring-guide.md` (already at the target).
- **Dependencies:** none new. Vitest (`cms-testing`) already wired — no testing-enablement
  dependency required.

## Testing

- **Unit (Vitest, `src/app/domain/terminal-schema.spec.ts`):**
  - Omitting `state` / `login` / `meta.public` parses to `{ local:{}, global:{} }` /
    `{ users:[] }` / `public:false`.
  - Minimal file `{ meta: { title: "X" }, nodes: { start: { text: "x", choices: [] } } }`
    parses.
  - Content with `meta.id` parses (id optional); content without `meta.id` parses (id not
    required).
  - Regression: a fully-populated file still parses to the same normalized shape; empty
    `meta.title` is still rejected.
- **Unit (Vitest, `terminals-api.service.spec.ts`):** `create` / `import` / update strip
  `meta.id` — given content with `meta.id`, the posted/put body has no `meta.id` (spy on
  `HttpClient`).
- **Integration (component, Vitest):** the import dialog forwards content with defaults
  applied and `meta.id` stripped.
- **No e2e / API test required:** the API contract is unchanged and already enforces the
  correct rules.
