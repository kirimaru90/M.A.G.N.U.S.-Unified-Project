## 1. Schema (`terminal-schema.ts`)

- [x] 1.1 Rewrite `LeafPredicateSchema` as a union: new canonical `{ var, op, value }` (op enum `eq|neq|gt|lt|gte|lte` with `PrimitiveValue`; a separate `{ var, op:'in', value: PrimitiveValue[] }` member), **plus** the existing legacy `{ key, <op>: value }` members kept for read tolerance
- [x] 1.2 Add `z.object({ not: ConditionSchema }).strict()` to the `ConditionSchema` `z.lazy` union
- [x] 1.3 Extend the `Condition` type union with `{ not: Condition }`
- [x] 1.4 Confirm `MutationSchema` is untouched (mutations stay `{ key, op, value/by }`)

## 2. Form serialize/deserialize (`terminal-form.ts`)

- [x] 2.1 Rename the condition leaf field `key` → `var` in `ConditionLeafRaw` and `ConditionComboRaw`; add `'not'` to `ConditionKind`
- [x] 2.2 `makeLeafGroup` builds a `var` control (not `key`); `makeComboGroup` accepts `'and' | 'or' | 'not'`
- [x] 2.3 `loadConditionGroup`: handle `'not' in cond` → `makeComboGroup('not')` + push the single `loadConditionGroup(cond.not)` child
- [x] 2.4 `loadConditionGroup` leaf branch: accept **both** the new `{ var, op, value }` shape and the legacy `{ key, <op>: value }` shape, normalizing both to `{ kind:'leaf', var, op, value }` (join `in` arrays to the comma-string the builder uses, as today)
- [x] 2.5 `serializeCondition`: leaf → `{ var, op, value }` (operator as the value of `op`; `in` emits an array `value`); add `if (raw.kind === 'not') return { not: serializeCondition(raw.children[0]) }`
- [x] 2.6 Verify `serializeMutations` / `makeMutationGroup` and `resolveControlByPath` are unaffected

## 3. Builder UI (`condition-builder.ts`)

- [x] 3.1 Leaf branch: bind `formControlName="var"` (placeholder unchanged); operator `<select>` and value input unchanged
- [x] 3.2 Add a `not` template branch: render `children.controls[0]` via the recursive `<app-condition-builder>` under a "NOT" header, with the add-leaf/AND/OR buttons **hidden** (one-child invariant); do not add a "Converti in NOT" control (deferred)
- [x] 3.3 Fix `wrapInCombo` to read `raw.var` (was `raw.key`) so converting a leaf to AND/OR preserves the variable

## 4. Specs & reference docs

- [x] 4.1 Update `openspec/specs/terminal-recursive-editors/spec.md`: condition builder renders `var` + op selector; serialization to `{ var, op, value }`; legacy-read tolerance + always-write-new; `not` round-trip/display; fix the leaf/`in`/load scenarios
- [x] 4.2 Update `openspec/specs/terminal-nodes-editor/spec.md` L127 input-component scenario to `{ "when": { "var": "local.entered_code", "op": "eq", "value": "58874645" }, ... }`
- [x] 4.3 Update `reference/robco-terminal-architecture.md` condition examples (~L433–L481) to the `{ var, op, value }` shape and mention the `not` combinator; leave mutation examples as `key`
- [x] 4.4 Leave `openspec/changes/archive/**` untouched

## 5. Verify

- [x] 5.1 Build/lint/typecheck passes
- [ ] 5.2 A condition authored in the builder (leaf) serializes to `{ "var", "op", "value" }`; an `in` condition serializes to `{ "var", "op":"in", "value":[...] }`
- [ ] 5.3 Importing a legacy `{ "key":"local.x", "gte":3 }` terminal validates, loads into the builder, and on save re-serializes as `{ "var":"local.x", "op":"gte", "value":3 }`
- [ ] 5.4 A terminal containing `{ "not": <cond> }` imports, displays as a NOT node, and round-trips load→save unchanged
- [ ] 5.5 Mutations (`on_enter` / choice `set`) still serialize with `key` and are unchanged
- [x] 5.6 No remaining `{ key, <op>: value }` condition examples in active specs or `reference/robco-terminal-architecture.md`
