## Context

Two validators guard a terminal on its way into storage:

- **CMS (client-side, Zod)** — `apps/cms/src/app/domain/terminal-schema.ts`, run before the
  request is sent.
- **API (server-side, class-validator DTO + global `ValidationPipe`)** —
  `apps/api/api/src/terminals/dto/terminal-content.dto.ts`.

They disagree in two independent ways:

1. **Optionality.** The API marks `state`/`login` `@IsOptional()` and defaults an absent
   `meta.public` to `false` (`meta?.public ?? false`); the Zod schema makes all three
   **required**, rejecting minimal files with `... Invalid input: expected object, received
   undefined`.
2. **`meta.id`.** It is server-owned — the API injects it on read and rejects any non-empty
   `meta.id` on input (`MetaDto.id` is `@IsEmpty`). But the CMS declares `meta.id` optional and
   forwards content verbatim (`TerminalsApiService.import`/`create` `POST` as-is; the editor
   save `PUT`s loaded content, which carries the server id), so content containing `meta.id`
   400s. The spec meanwhile calls `meta.id` *required*, and `AUTHORING-TERMINALS.md` claims the
   importer strips it (it does not).

This change makes the CMS the same-or-looser than the API on optionality, and makes `meta.id`
genuinely server-owned end to end.

## Goals / Non-Goals

**Goals:**
- Omitting `state` / `login` / `meta.public` parses and normalizes to fixed neutral values.
- Content carrying `meta.id` (authored or loaded) writes successfully — no 400.
- Spec, code, API, and both authoring docs all agree: only `meta.title` + `nodes` required;
  `state`/`login`/`public` optional with neutral defaults; `meta.id` server-owned, stripped by
  the client on write.

**Non-Goals:**
- No API changes (the API already permits omission and correctly rejects a sent `meta.id`).
- No change to `reference/terminal-authoring-guide.md` (already at the target).
- No change to inner shape rules (variable typing, enum membership, choice/branch targets,
  mutation grammar) — only top-level optionality and `meta.id` handling.

## Decisions

**Optionality: Zod `.default(...)`, not `.optional()`.**
`.default(v)` makes a key omissible *and* fills a deterministic value on parse, so downstream
code always sees the fully-normalized shape it sees today; `.optional()` alone would leak
`undefined` into code that assumes `state.local` exists.

```ts
// MetaSchema
public: z.boolean().default(false),
// TerminalContentSchema
state: StateDeclarationSchema.default({ local: {}, global: {} }),
login: LoginBlockSchema.default({ users: [] }),
```

Defaults match the API's own normalization (`false`, empty maps, empty users) so
CMS-normalized output is byte-equivalent to a hand-written explicit file.

**`meta.id`: strip at the API-service write boundary, keep the schema type.**
`TerminalsApiService` is the single choke point for create/import/update. Stripping there
(clone `meta`, drop `id`) fixes every write path — including the editor save, which the schema
never re-validates — in one place:

```ts
private stripServerOwned(content: TerminalContent): TerminalContent {
  const { id: _drop, ...meta } = content.meta;
  return { ...content, meta };
}
// used by create(), import(), and the update/save method before post/put
```

`MetaSchema.id` stays `z.string().optional()` so the `TerminalContent` type still exposes
`meta.id` for read models (loaded content legitimately carries the server id). The API remains
the enforcer that a *sent* id is rejected — now unreachable because the client strips first.

Alternatives considered:
- *Strip in the import dialog only* — misses the editor `PUT` path, which has the same bug.
- *Remove `id` from `MetaSchema`* — drops `id` from the `TerminalContent` type that loaded
  content and list/detail views rely on; higher blast radius. Rejected.
- *A `.transform` on `MetaSchema` deleting id* — runs only on parsed (imported) content, not on
  loaded content sent to `PUT`. Same gap as the dialog-only option.

**Docs edit is scoped to the optionality + `meta.id` rules.** In `AUTHORING-TERMINALS.md`, §2
("all four keys required"), §3 (`meta.id` note; `public`), §4 (`local`/`global` required), §5
(`login` required), and the §10 checklist are reworded; the `start`-node playback rule, timing
rules, and style guidance stay untouched.

## Risks / Trade-offs

- **[Editor code assuming `state`/`login` are always objects]** → Mitigated by `.default(...)`
  (never `undefined`). Grep the terminal editor for direct `content.state`/`content.login`
  access during the task to confirm no reliance on absence.
- **[A write path bypassing `TerminalsApiService`]** → Mitigated by centralizing the strip in
  the service plus a unit test per write method; a grep during the task confirms all terminal
  writes go through it.
- **[Silently dropping a meaningful `meta.id`]** → `meta.id` has no author-facing meaning (the
  author identifier is `hiddenId`); dropping the server id is the intended behavior.
- **[Node validation weakened]** → No: the `≥1 node` rule and the play-time `start` requirement
  are untouched.

## Migration Plan

No data migration. Behavior-only, additive loosening:
- Existing correct files parse and write identically (defaults never override provided values;
  they omit `meta.id`).
- Previously-rejected minimal files, and files carrying `meta.id`, now succeed.
- Rollback = revert the `.default(...)` edits, the strip helper, and the doc wording; nothing
  persisted depends on this.

## Open Questions

None outstanding. (This change supersedes the earlier split pair
`relax-cms-terminal-import-validation` + `fix-terminal-meta-id-drift`, which both edited the
same `meta` requirement and therefore carried an archive-ordering constraint; merging removes
that constraint.)
