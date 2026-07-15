# cms-terminal-content-schema Specification

## Purpose

Canonical Zod/TypeScript Terminal Content schema module covering meta, typed state declarations, cleartext login users, node maps, choices, input components, recursive conditions, and typed mutations.
## Requirements
### Requirement: Canonical Terminal Content schema is defined in a single domain module
A single module SHALL export the canonical Terminal Content schema as paired TypeScript types and a Zod schema. The module SHALL live at `src/app/domain/terminal-schema.ts`. The TypeScript types SHALL be derived from the Zod schema via `z.infer` so the two cannot drift. The module SHALL be importable by any feature module (notably Slice 5's terminal editor) without depending on HTTP, routing, or feature-specific code.

#### Scenario: Module exports both schema and types
- **WHEN** another file imports from `src/app/domain/terminal-schema.ts`
- **THEN** it can import the runtime Zod schema `TerminalContentSchema` and the inferred TypeScript type `TerminalContent`, and the type is `z.infer<typeof TerminalContentSchema>`

#### Scenario: Module has no app-layer dependencies
- **WHEN** the module is imported in isolation in a test
- **THEN** it does not transitively pull in Angular, HttpClient, Router, or PrimeNG modules

### Requirement: Meta block covers id, title, and public flag
`TerminalContentSchema` SHALL include a `meta` block whose only required field is `title` (string, min length 1). `id` (string) SHALL be **optional and server-owned**: the API injects it on read and the CMS strips it before any write (see `cms-terminals-import-export`), so the schema SHALL accept content with or without `meta.id` and SHALL NOT require it. `public` (boolean) SHALL be **optional** and SHALL default to `false` when omitted, matching the API, which treats an absent `public` as a hidden terminal. No other fields SHALL be required in `meta`.

#### Scenario: Valid meta passes
- **WHEN** parsing `{ meta: { id: "demo-1", title: "Demo", public: true }, state: { local: {}, global: {} }, login: { users: [] }, nodes: { start: { text: "x", choices: [] } } }`
- **THEN** the parse succeeds

#### Scenario: Empty title is rejected
- **WHEN** parsing the same content but with `meta.title` set to an empty string
- **THEN** the parse fails with an issue at path `meta.title`

#### Scenario: Omitted id validates
- **WHEN** parsing content whose `meta` omits the `id` key (e.g. `meta: { title: "Demo" }`)
- **THEN** the parse succeeds and `meta.id` is absent (undefined)

#### Scenario: Omitted public defaults to false
- **WHEN** parsing content whose `meta` omits the `public` key
- **THEN** the parse succeeds and the parsed `meta.public` is `false`

### Requirement: State declarations support boolean, number, enum, and string types
The top-level `state` field SHALL be **optional**; when omitted it SHALL default to `{ local: {}, global: {} }`, matching the API, which treats an absent `state` as no declared variables. When `state` is **present**, its `local` and `global` fields SHALL each be **optional** and SHALL default to an empty map (`{}`) when omitted, matching the API, which marks both sides optional and reads them null-safely. A `state` object MAY therefore declare only `local`, only `global`, both, or neither (`{}`); every missing side SHALL normalize to `{}` rather than failing validation. When a side is present, `TerminalContentSchema` SHALL treat `state.local` and `state.global` as maps keyed by variable name. Each variable SHALL declare a `type` of `"boolean"`, `"number"`, `"enum"`, or `"string"`, plus a `default` value whose runtime type matches the declared `type`. Enum variables SHALL additionally declare a `values` array of strings, and the `default` SHALL be one of those values.

#### Scenario: Omitted state defaults to empty local and global
- **WHEN** parsing content that omits the top-level `state` key
- **THEN** the parse succeeds and the parsed `state` equals `{ local: {}, global: {} }`

#### Scenario: State with only local defaults global to empty
- **WHEN** parsing content whose `state` declares `local` but omits `global` (e.g. `state: { local: { flag: { type: "boolean", default: false } } }`)
- **THEN** the parse succeeds and the parsed `state.global` equals `{}`

#### Scenario: State with only global defaults local to empty
- **WHEN** parsing content whose `state` declares `global` but omits `local` (e.g. `state: { global: { tier: { type: "string", default: "" } } }`)
- **THEN** the parse succeeds and the parsed `state.local` equals `{}`

#### Scenario: Empty state object defaults both sides to empty
- **WHEN** parsing content whose `state` is `{}`
- **THEN** the parse succeeds and the parsed `state` equals `{ local: {}, global: {} }`

#### Scenario: Boolean variable validates
- **WHEN** parsing `state.local.flag = { type: "boolean", default: false }`
- **THEN** the parse succeeds

#### Scenario: Number variable validates
- **WHEN** parsing `state.local.counter = { type: "number", default: 0 }`
- **THEN** the parse succeeds

#### Scenario: Enum variable requires values and matching default
- **WHEN** parsing `state.local.mood = { type: "enum", values: ["calm","panicked"], default: "calm" }`
- **THEN** the parse succeeds

#### Scenario: Enum default not in values is rejected
- **WHEN** parsing `state.local.mood = { type: "enum", values: ["calm"], default: "panicked" }`
- **THEN** the parse fails with an issue at path `state.local.mood.default`

#### Scenario: String variable validates
- **WHEN** parsing `state.local.note = { type: "string", default: "" }`
- **THEN** the parse succeeds

#### Scenario: Default type mismatch is rejected
- **WHEN** parsing `state.local.flag = { type: "boolean", default: 0 }`
- **THEN** the parse fails with an issue under `state.local.flag`

### Requirement: Login block holds fictional users with cleartext passwords
The top-level `login` field SHALL be **optional**; when omitted it SHALL default to `{ users: [] }`, matching the API, which treats an absent `login` as no fictional users. When present, `TerminalContentSchema` SHALL include `login.users` as an array of `{ username: string, password: string }`. Both fields SHALL be required strings; `password` SHALL NOT be enforced to look hashed. A doc-comment in the schema module SHALL note that fictional passwords are cleartext at rest in terminal content and are stripped by the API on delivery to the Terminal player app.

The `login` block SHALL additionally accept an **optional** `gateOnBoot: boolean`. When present it SHALL parse as a boolean; when omitted it SHALL default to unset (the API/emulator treat absence as `true`). A non-boolean `gateOnBoot` SHALL fail parsing with an issue at path `login.gateOnBoot`. `gateOnBoot` SHALL be independent of `users`: a login block MAY carry `gateOnBoot` alongside any (including empty) `users` array.

#### Scenario: Omitted login defaults to empty users
- **WHEN** parsing content that omits the top-level `login` key
- **THEN** the parse succeeds and the parsed `login` equals `{ users: [] }`

#### Scenario: Login block with cleartext password validates
- **WHEN** parsing `login.users = [{ username: "alice", password: "wonderland" }]`
- **THEN** the parse succeeds

#### Scenario: Empty users list validates
- **WHEN** parsing `login = { users: [] }`
- **THEN** the parse succeeds

#### Scenario: Missing password fails
- **WHEN** parsing `login.users = [{ username: "alice" }]`
- **THEN** the parse fails with an issue at path `login.users.0.password`

#### Scenario: gateOnBoot false validates alongside users
- **WHEN** parsing `login = { gateOnBoot: false, users: [{ username: "alice", password: "wonderland" }] }`
- **THEN** the parse succeeds and `gateOnBoot` is `false`

#### Scenario: Omitted gateOnBoot validates
- **WHEN** parsing `login = { users: [{ username: "alice", password: "wonderland" }] }`
- **THEN** the parse succeeds and `gateOnBoot` is absent (undefined)

#### Scenario: Non-boolean gateOnBoot fails
- **WHEN** parsing `login = { gateOnBoot: "yes", users: [] }`
- **THEN** the parse fails with an issue at path `login.gateOnBoot`

#### Scenario: Minimal terminal with only title and nodes validates
- **WHEN** parsing `{ meta: { title: "Minimo" }, nodes: { start: { text: "x", choices: [] } } }`
- **THEN** the parse succeeds and yields `state = { local: {}, global: {} }`, `login = { users: [] }`, `meta.public = false`, and `meta.id` absent

### Requirement: Nodes are a map keyed by node id with content fields
`TerminalContentSchema` SHALL require at least one entry in `nodes`. Each node SHALL accept the optional fields: `text` (string), `on_enter` (array of mutations), `choices` (array of `NodeChoice`), `variants` (array of `NodeVariant`), `components` (array of `NodeComponent`). A node SHALL be valid with only `text` and `choices`, with only `variants`, or with only `components` — the schema SHALL NOT require all four to coexist.

#### Scenario: Node with text and empty choices validates
- **WHEN** parsing `nodes.start = { text: "hello", choices: [] }`
- **THEN** the parse succeeds

#### Scenario: Node with only variants validates
- **WHEN** parsing `nodes.porta = { variants: [{ default: true, text: "x", choices: [] }] }`
- **THEN** the parse succeeds

#### Scenario: Empty nodes map is rejected
- **WHEN** parsing content with `nodes: {}`
- **THEN** the parse fails with an issue at path `nodes`

### Requirement: Choices declare label, target, optional when, optional set
`NodeChoice` SHALL require `label` (string, min 1) and `target` (string referencing a node id), and SHALL accept optional `when` (a `Condition`) and optional `set` (an array of `Mutation`).

#### Scenario: Minimal choice validates
- **WHEN** parsing `{ label: "[ Continue ]", target: "next" }`
- **THEN** the parse succeeds

#### Scenario: Choice with when and set validates
- **WHEN** parsing `{ label: "X", target: "y", when: { key: "local.a", eq: true }, set: [{ key: "global.b", op: "set", value: 1 }] }`
- **THEN** the parse succeeds

#### Scenario: Empty label is rejected
- **WHEN** parsing `{ label: "", target: "next" }`
- **THEN** the parse fails with an issue at path `label`

### Requirement: Components support input type with placeholder, set target, and branches
`NodeComponent` SHALL support `type: "input"` with required `placeholder` (string), `set` (string variable key, e.g. `local.entered_code`), and `branches` (array). Each branch SHALL be either a leaf condition `{ when, target }`, or a fallback `{ default: true, target }`.

#### Scenario: Input component with branches validates
- **WHEN** parsing `{ type: "input", placeholder: "...", set: "local.code", branches: [{ when: { key: "local.code", eq: "1234" }, target: "ok" }, { default: true, target: "ko" }] }`
- **THEN** the parse succeeds

#### Scenario: Missing placeholder is rejected
- **WHEN** parsing an input component without a `placeholder` field
- **THEN** the parse fails with an issue at path `placeholder`

#### Scenario: Unknown component type is rejected
- **WHEN** parsing `{ type: "slider", placeholder: "x", set: "local.v", branches: [] }`
- **THEN** the parse fails with an issue at path `type`

### Requirement: Conditions are a recursive union of leaf predicates and combinators
`ConditionSchema` SHALL match one of:
- A leaf predicate `{ key: string, <op>: value }` where `<op>` is exactly one of `eq | neq | gt | lt | gte | lte | in`. For `in`, the value SHALL be an array; for the others, the value SHALL be a primitive (string | number | boolean).
- A combinator `{ and: Condition[] }` or `{ or: Condition[] }`.
- A fallback marker `{ default: true }`.

The schema SHALL support arbitrary nesting depth via `z.lazy`.

#### Scenario: Leaf eq predicate validates
- **WHEN** parsing `{ key: "local.flag", eq: true }`
- **THEN** the parse succeeds

#### Scenario: Leaf in predicate validates with array value
- **WHEN** parsing `{ key: "global.tier", in: ["bronze", "silver"] }`
- **THEN** the parse succeeds

#### Scenario: Nested and/or combinator validates
- **WHEN** parsing `{ and: [{ key: "local.a", eq: 1 }, { or: [{ key: "local.b", gt: 0 }, { key: "local.c", neq: "x" }] }] }`
- **THEN** the parse succeeds

#### Scenario: Default fallback marker validates
- **WHEN** parsing `{ default: true }`
- **THEN** the parse succeeds

#### Scenario: Unknown operator is rejected
- **WHEN** parsing `{ key: "local.a", contains: "x" }`
- **THEN** the parse fails with a Zod issue at the predicate path

### Requirement: Mutations are typed with op set/increment/toggle
`MutationSchema` SHALL match one of:
- `{ key: string, op: "set", value: <any> }`
- `{ key: string, op: "increment", by: number }`
- `{ key: string, op: "toggle" }`

#### Scenario: Set mutation validates
- **WHEN** parsing `{ key: "local.x", op: "set", value: 42 }`
- **THEN** the parse succeeds

#### Scenario: Increment mutation validates
- **WHEN** parsing `{ key: "global.counter", op: "increment", by: 1 }`
- **THEN** the parse succeeds

#### Scenario: Toggle mutation validates without value or by
- **WHEN** parsing `{ key: "local.flag", op: "toggle" }`
- **THEN** the parse succeeds

#### Scenario: Increment without by is rejected
- **WHEN** parsing `{ key: "local.x", op: "increment" }`
- **THEN** the parse fails with an issue at the mutation path

### Requirement: Architecture-doc example round-trips through the schema
The canonical schema SHALL accept the full JSON example shown in `reference/robco-terminal-architecture.md` (section "Terminal Content Schema") without modification.

#### Scenario: Reference example validates
- **WHEN** parsing the literal JSON example from the architecture doc
- **THEN** the parse succeeds with no issues

