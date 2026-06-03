## Context

The condition (`when`) format lives in three layers that must move together:

- **`src/app/domain/terminal-schema.ts`** — `LeafPredicateSchema` currently validates `{ key, <op>: value }` (operator as the JSON key); `ConditionSchema` is a `z.lazy` union of leaf / `{ and }` / `{ or }` / `{ default: true }`.
- **`src/app/features/terminals/editor/terminal-form.ts`** — the form's *internal* raw model already stores `op` and `value` as **separate** controls (`ConditionLeafRaw = { kind, key, op, value, children }`). `loadConditionGroup` deserializes from `{ key, <op>: value }`; `serializeCondition` re-flattens to `{ key, [op]: val }`.
- **`src/app/features/terminals/editor/condition-builder.ts`** — recursive component; leaf branch binds `formControlName="key"` + an op `<select>` + value input. Non-leaf nodes render a `children` `FormArray` with add-leaf / add-AND / add-OR buttons.

`ConditionSchema` is enforced by `TerminalContentSchema.safeParse` at **both** `import-terminal-dialog.ts:146` (import) and `terminal-editor.ts:182` (save). The authoritative shape is `reference/terminal-authoring-guide.md` v1.2 §6 / §6.1.

The key enabling fact: because the internal form model already separates `op` and `value`, moving to `{ var, op, value }` makes the serializer **simpler** (near pass-through), not harder. The work is the wire-format boundary plus propagating `var` and `not`.

## Goals / Non-Goals

**Goals:**
- Serialize/deserialize conditions in the canonical `{ var, op, value }` shape from guide v1.2.
- Round-trip and display the `not` combinator faithfully.
- Import legacy `{ key, <op>: value }` terminals without error; upgrade them to the new shape on first save.

**Non-Goals:**
- A "Converti in NOT" authoring control (create a `not` from a blank builder). Deferred.
- Any change to the **mutation** shape (`on_enter`, choice `set`) — stays `{ key, op, value/by }`.
- Changes to the state-schema endpoints, the state viewer, or the terminal player runtime.

## Decisions

**D1 — Leaf shape `{ var, op, value }`, with legacy accepted on read.**
`LeafPredicateSchema` becomes a union:

```ts
// new canonical
z.object({ var: z.string(), op: z.enum(['eq','neq','gt','lt','gte','lte']), value: PrimitiveValue }).strict(),
z.object({ var: z.string(), op: z.literal('in'), value: z.array(PrimitiveValue) }).strict(),
// legacy, READ-only tolerance (one per operator, as today)
z.object({ key: z.string(), eq: PrimitiveValue }).strict(), /* …neq, gt, lt, gte, lte… */
z.object({ key: z.string(), in: z.array(PrimitiveValue) }).strict(),
```

`loadConditionGroup` normalizes **both** shapes into the single internal `{ kind:'leaf', var, op, value }` model; `serializeCondition` **only** ever emits `{ var, op, value }`. Effect: legacy content validates on import and is rewritten to the new shape on the next save (migrate-on-write). No migration script.
- *Alternative considered:* strict new-only schema + a pre-`safeParse` transform that rewrites legacy JSON. Rejected — it splits the format knowledge across a transform and the schema, and the union is local and self-documenting.

**D2 — `not` as a one-child combo.**
Model `not` as a combinator node reusing the existing `children: FormArray`, constrained to **exactly one** entry — no new form-group type, so the recursive builder, `resolveControlByPath`, and the FormArray plumbing are reused unchanged.
- Schema: add `z.object({ not: ConditionSchema }).strict()` to the `ConditionSchema` union; type gains `{ not: Condition }`.
- `ConditionKind` gains `'not'`; `makeComboGroup(kind: 'and' | 'or' | 'not')`.
- `loadConditionGroup`: `if ('not' in cond)` → `makeComboGroup('not')`, push the single `loadConditionGroup(cond.not)` child.
- `serializeCondition`: `if (raw.kind === 'not') return { not: serializeCondition(raw.children[0]) }`.
- Builder template: a `not` branch renders `children[0]` recursively under a "NOT" header with the add-leaf/AND/OR buttons **hidden**, enforcing the one-child invariant by construction.
- *Alternative considered:* a dedicated `child` control instead of `children[0]`. Rejected — it duplicates plumbing the recursive renderer and path resolver already key off `children`.

**D3 — Scope of `not`: round-trip + display only.**
An imported terminal containing `{ not: <cond> }` loads, displays as a NOT node, and re-serializes unchanged on save. Creating a `not` from scratch in the builder (a convert button) is **deferred**; until then a `not` only enters the form via import. This keeps the change reviewable and avoids new builder UX in this slice.

**D4 — Internal field rename `key` → `var` for conditions.**
`ConditionLeafRaw`/`ConditionComboRaw` and the builder bind `var` (matching the wire field and the guide's READ-vs-WRITE distinction). The mutation editor keeps `key`. This keeps the two shapes visibly distinct in the codebase, mirroring guide §6.1.

**D5 — Mutations untouched.**
`serializeMutations` / `makeMutationGroup` and the mutation editor continue to emit `{ key, op, value }` / `{ key, op:'increment', by }`. No change.

## Risks / Trade-offs

- **Legacy `value` typing on read** → the legacy union keeps `PrimitiveValue` (and array for `in`), so coercion is identical to today; the loader joins arrays to the comma-string the builder expects, exactly as the current `loadConditionGroup` does.
- **`not` rendered by the recursive component** → without the `not` template branch, a `not` node would fall into the generic combinator branch and expose add-child buttons (violating the one-child invariant). The dedicated branch (D2) is required, not optional.
- **Spec/doc drift** → `robco-terminal-architecture.md` is cited by the guide as authoritative for condition syntax; leaving it on the old shape would re-introduce the contradiction. It is in scope for this change.
- **`wrapInCombo` typing** in `condition-builder.ts` reads `raw.key` — must follow the `key`→`var` rename or it silently drops the variable when converting a leaf to AND/OR.

## Migration Plan

No data migration. Legacy terminals validate on import (D1) and are rewritten to `{ var, op, value }` on their next save. Rollback is reverting the schema + form + builder files; because the schema still accepts the legacy shape, a rollback after some terminals were re-saved in the new shape would **reject** those — so roll back the schema tolerance last, or not at all (the new shape is the target contract).
