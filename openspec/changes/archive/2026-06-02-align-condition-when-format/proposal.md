## Why

`reference/terminal-authoring-guide.md` was updated to **v1.2 (2026-06-02)** and is now the authoritative authoring source. It changed the canonical **condition** (`when`) leaf shape and added a `not` combinator:

```
OLD (current code):  { "key": "local.x", "gte": 3 }            ← operator is the property name
NEW (guide v1.2):    { "var": "local.x", "op": "gte", "value": 3 }
```

The guide's §6.1 now explicitly distinguishes **READ via `var`** (conditions) from **WRITE via `key`** (mutations) and marks the old `{ key, <op>: value }` condition shape as wrong. The CMS Zod schema, the condition builder form/serializer, the recursive-editor UI, two active specs, and the `robco-terminal-architecture.md` reference all still emit and document the old shape — so authored terminals no longer match the contract, and hand-written JSON using the documented `{ var, op, value }` shape fails `ConditionSchema` validation in the editor.

## What Changes

- **Condition leaf format → `{ var, op, value }`.** The condition builder serializes leaves to `{ var, op, value }` (operator as the value of `op`, never a property name). `in` produces an array `value`; other operators produce a single primitive. `and`/`or` are unchanged in structure.
- **New `not` combinator.** `ConditionSchema` accepts `{ not: <condition> }` (true iff the child is false). It is modeled in the form as a combinator with **exactly one** child, fully round-tripped and displayed; **authoring a `not` from a blank builder is explicitly deferred** to a later change.
- **Backward-compatible read (migrate-on-write).** Because `TerminalContentSchema.safeParse` gates both import and save, the Zod leaf becomes a union that **accepts both** the new `{ var, op, value }` and the legacy `{ key, <op>: value }` shapes on read; the loader normalizes both into one internal model; the serializer **always writes** the new shape. Existing terminals import cleanly and upgrade on first save — no data migration.
- **Mutations unchanged.** `on_enter` and choice `set` keep `{ key, op, value }` / `{ key, op: 'increment', by }`. Conditions read via `var`; mutations write via `key`.
- **Realign specs and reference docs** that still show the legacy condition shape.

Out of scope: a "Converti in NOT" authoring control in the builder; any change to the mutation shape, the state-schema flows, or the terminal player runtime.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `terminal-recursive-editors`: the recursive condition builder renders/serializes leaves as `{ var, op, value }` (was `{ key, <op>: value }`), accepts the legacy leaf shape on load while always writing the new shape, and gains a display/round-trip-only `not` combinator (one child). Mutation serialization is unchanged.
- `terminal-nodes-editor`: the input-component branch `when` example is realigned to the `{ var, op, value }` condition shape (no behavioral change to the editor beyond the shared condition serializer).

## Impact

- **Modified code:**
  - `src/app/domain/terminal-schema.ts` — `LeafPredicateSchema` becomes a union of the new `{ var, op, value }` shape and the legacy `{ key, <op>: value }` shape; add `z.object({ not: ConditionSchema }).strict()` to `ConditionSchema`; extend the `Condition` type with `{ not: Condition }`.
  - `src/app/features/terminals/editor/terminal-form.ts` — `loadConditionGroup` reads both shapes and the `not` combinator; `serializeCondition` emits `{ var, op, value }` and `{ not: ... }`; `ConditionKind` gains `'not'`; `makeComboGroup` accepts `'not'`. Internal leaf field renamed `key` → `var` (or mapped at the boundary).
  - `src/app/features/terminals/editor/condition-builder.ts` — bind `var` instead of `key`; render a `not` node (its single `children[0]`, add-child buttons hidden); fix `wrapInCombo` typing.
- **Specs realigned:** `openspec/specs/terminal-recursive-editors/spec.md`, `openspec/specs/terminal-nodes-editor/spec.md`.
- **Reference doc realigned:** `reference/robco-terminal-architecture.md` (condition examples ~L433–L481), which the guide cites as the authoritative condition-syntax source.
- **Unaffected:** mutation shape and the mutation editor; `on_enter`/choice `set`; state-schema endpoints; the terminal player runtime; `openspec/changes/archive/**` (frozen).
