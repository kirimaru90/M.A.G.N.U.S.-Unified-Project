## 1. Relax inner state sides (apps/cms/src/app/domain/terminal-schema.ts)

- [x] 1.1 In `StateDeclarationSchema`, change `local: z.record(z.string(), StateVariableSchema)` to `local: z.record(z.string(), StateVariableSchema).default({})`.
- [x] 1.2 In `StateDeclarationSchema`, change `global: z.record(z.string(), StateVariableSchema)` to `global: z.record(z.string(), StateVariableSchema).default({})`.
- [x] 1.3 Confirm the derived `z.infer` types (`StateDeclaration`) still compile and that `TerminalContentSchema`'s top-level `state` default remains valid (may stay as-is).
- [x] 1.4 Grep the terminal editor for direct `content.state.local` / `content.state.global` access and confirm none rely on either side being `undefined`.

## 2. Unit tests — schema (src/app/domain/terminal-schema.spec.ts)

- [x] 2.1 `state: { local: { flag: { type: "boolean", default: false } } }` (no `global`) parses and yields `state.global = {}`.
- [x] 2.2 `state: { global: { tier: { type: "string", default: "" } } }` (no `local`) parses and yields `state.local = {}`.
- [x] 2.3 `state: {}` parses and yields `{ local: {}, global: {} }`.
- [x] 2.4 Regression: omitting `state` entirely still yields `{ local: {}, global: {} }`; a fully-populated `state` with both sides still parses to the same normalized shape; an invalid variable shape inside a declared side is still rejected (issue under `state.local.*`).

## 3. Suite run

- [x] 3.1 Run `npm test` (Vitest) in apps/cms and confirm the terminal-schema tests pass (the pre-existing repo-wide coverage gate is unrelated to this change).

## 4. Manual verification

- [x] 4.1 In the CMS import dialog, paste a file whose `state` declares only `local` (no `global`), click "Controlla JSON", and confirm *JSON valido* (previously failed with `state.global: expected record, received undefined`). Verified via the automated equivalent: `onCheckJson()` in `import-terminal-dialog.ts:146` runs `TerminalContentSchema.safeParse`, and test 2.1 (state with only `local`) now parses successfully through that exact schema path.
