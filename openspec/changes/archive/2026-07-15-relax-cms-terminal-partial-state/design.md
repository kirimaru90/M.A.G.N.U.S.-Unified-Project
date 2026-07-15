## Context

Two validators guard a terminal on its way into storage:

- **CMS (client-side, Zod)** — `apps/cms/src/app/domain/terminal-schema.ts`, run before the
  request is sent (and in the import dialog's "Controlla JSON").
- **API (server-side, class-validator DTO + global `ValidationPipe`)** —
  `apps/api/api/src/terminals/dto/terminal-content.dto.ts`.

For the `state` block they disagree on the **inner** fields:

```
CMS  StateDeclarationSchema           API  StateDeclarationDto
┌────────────────────────┐            ┌────────────────────────┐
│ local:  required        │  stricter │ local?:  @IsOptional() │
│ global: required        │ ────────▶ │ global?: @IsOptional() │
└────────────────────────┘  than      └────────────────────────┘
```

The prior alignment change added `state: StateDeclarationSchema.default({ local: {}, global: {} })`
at the **top level**. Zod `.default(v)` only substitutes when the key is `undefined`, so it
fixes an entirely-absent `state` but does nothing for a present `state` object missing one
side — which then hits the required inner fields and fails with
`state.global: expected record, received undefined`. The API, by contrast, reads both sides
null-safely (`dto.state?.local ?? {}`; `dto.state?.global && …` in `TerminalsService`), so it
accepts partial `state` today.

## Goals / Non-Goals

**Goals:**
- A present `state` object with only `local`, only `global`, both, or neither (`{}`) parses.
- Each missing side normalizes to `{}` so downstream code always sees defined maps.
- CMS is same-or-looser than the API for the whole `state` block.

**Non-Goals:**
- No API changes (already accepts partial/omitted `state`).
- No change to inner variable-shape rules (typing, enum membership, defaults).
- No change to the top-level `state` optionality, `login`, `meta`, or node rules.

## Decisions

**Per-field `.default({})`, not `.optional()`.**
`.default({})` makes each side omissible *and* fills an empty map on parse, preserving the
invariant that downstream editor code relies on — e.g. `terminal-state-panel.ts` reads
`envelope.content.state.local` and spreads `{ ...content.state.local }` with no `?? {}` guard.
`.optional()` alone would leak `undefined` into those spots and could crash them.

```ts
export const StateDeclarationSchema = z.object({
  local:  z.record(z.string(), StateVariableSchema).default({}),
  global: z.record(z.string(), StateVariableSchema).default({}),
});
```

The empty-map default matches the API's own normalization, so CMS-normalized output stays
byte-equivalent to a hand-written explicit file.

**Leave the top-level default in place.**
`state: StateDeclarationSchema.default({ local: {}, global: {} })` becomes redundant once the
inner fields default to `{}` (an absent `state` would now parse via `{}` → both sides fill),
but it is harmless and keeps the entirely-absent-`state` path explicit. Removing it is optional
cleanup, not required; keeping it avoids touching a line the prior change just set and keeps its
scenario assertions stable.

Alternatives considered:
- *`.optional()` on each side* — leaks `undefined` into editor code that assumes defined maps.
  Rejected.
- *A top-level `.transform` filling missing sides* — more code than per-field defaults and less
  local to where the shape is declared. Rejected.

## Risks / Trade-offs

- **[Editor code assuming both sides are always objects]** → Mitigated by `.default({})` (never
  `undefined`); the existing `?? {}` guards in `terminal-form.ts` remain correct too.
- **[Masking a genuine typo, e.g. author meant `global` but the key is absent]** → `state`
  sides are independently optional by contract; an absent side is a valid "no variables of that
  scope" declaration, matching the API. No author-facing meaning is lost.

## Migration Plan

No data migration. Behavior-only, additive loosening:
- Existing files declaring both sides parse and write identically (defaults never override
  provided values).
- Previously-rejected partial-`state` files now succeed.
- Rollback = revert the two `.default({})` edits; nothing persisted depends on this.

## Open Questions

None.
