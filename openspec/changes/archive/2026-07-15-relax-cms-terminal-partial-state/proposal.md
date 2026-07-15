## Why

The CMS terminal validator (Zod, `apps/cms/src/app/domain/terminal-schema.ts`) rejects a
terminal that declares only one side of `state`. Authors importing a file with, e.g., only
local variables see:

```
state.global: Invalid input: expected record, received undefined
```

This is a **CMS-only over-strictness**, not an API constraint. The API DTO
(`terminal-content.dto.ts`) marks both `state.local` and `state.global` `@IsOptional()`, and
`TerminalsService.projectState` reads them null-safely (`dto.state?.local ?? {}`,
`dto.state?.global && …`). The server accepts a partial `state`, an empty `state: {}`, or no
`state` at all — the CMS gate is stricter than the contract it feeds.

The prior change `2026-07-14-align-cms-terminal-validation-with-api` made the **top-level**
`state` key optional (its `.default({ local: {}, global: {} })` fires only when `state` is
entirely absent). But the inner `StateDeclarationSchema` still requires **both** `local` and
`global`, so a present-but-partial `state` bypasses the top-level default and fails. This
change closes that residual gap.

## What Changes

- **`state.local` and `state.global` each become optional with a `{}` default** in the CMS Zod
  schema. A `state` object may now declare only `local`, only `global`, both, or be empty
  (`{}`) — each missing side normalizes to an empty map. Content that omits `state` entirely
  continues to work via the existing top-level default.
- Defaults (`{}`) match the API's own normalization, so CMS-normalized output stays
  byte-equivalent to a hand-written explicit file and downstream editor code keeps seeing
  `state.local` / `state.global` as defined objects.
- Not a breaking change: files that already declare both sides parse and write identically;
  only previously-rejected partial-`state` files now succeed.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cms-terminal-content-schema`: the "State declarations" requirement changes so that, when
  `state` is present, `local` and `global` are each optional and default to `{}` — a partial or
  empty `state` object validates instead of failing with `expected record, received undefined`.

## Impact

- **Code:** `apps/cms/src/app/domain/terminal-schema.ts` — add `.default({})` to the `local` and
  `global` fields of `StateDeclarationSchema`. The existing top-level
  `state: StateDeclarationSchema.default({ local: {}, global: {} })` may stay as-is (now
  redundant but harmless) — no other line changes.
- **Behavior:** `apps/cms/src/app/features/terminals/import-terminal-dialog.ts` — "Controlla
  JSON" / "Importa" now accept partial-`state` files; the normalized object sent to the API is
  unchanged in shape (the missing side fills to `{}`).
- **Out of scope:** No API changes (the API already permits partial/omitted `state`). No change
  to inner variable-shape rules (typing, enum membership).
- **Dependencies:** none new. Vitest (`cms-testing`) already wired.

## Testing

- **Unit (Vitest, `src/app/domain/terminal-schema.spec.ts`):**
  - `state: { local: { flag: { type: "boolean", default: false } } }` (no `global`) parses and
    yields `state.global = {}`.
  - `state: { global: { … } }` (no `local`) parses and yields `state.local = {}`.
  - `state: {}` parses and yields `{ local: {}, global: {} }`.
  - Regression: omitting `state` entirely still yields `{ local: {}, global: {} }`; a fully
    populated `state` with both sides still parses to the same normalized shape; an invalid
    variable shape inside a declared side is still rejected.
- **No API / e2e test required:** the API contract is unchanged and already accepts partial
  `state`.
