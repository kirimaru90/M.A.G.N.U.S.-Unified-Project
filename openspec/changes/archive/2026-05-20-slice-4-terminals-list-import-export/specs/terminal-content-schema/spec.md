## ADDED Requirements

### Requirement: Canonical Terminal Content schema is defined in a single domain module
A single module SHALL export the canonical Terminal Content schema as paired TypeScript types and a Zod schema. The module SHALL live at `src/app/domain/terminal-schema.ts`. The TypeScript types SHALL be derived from the Zod schema via `z.infer` so the two cannot drift. The module SHALL be importable by any feature module (notably Slice 5's terminal editor) without depending on HTTP, routing, or feature-specific code.

#### Scenario: Module exports both schema and types
- **WHEN** another file imports from `src/app/domain/terminal-schema.ts`
- **THEN** it can import the runtime Zod schema `TerminalContentSchema` and the inferred TypeScript type `TerminalContent`, and the type is `z.infer<typeof TerminalContentSchema>`

#### Scenario: Module has no app-layer dependencies
- **WHEN** the module is imported in isolation in a test
- **THEN** it does not transitively pull in Angular, HttpClient, Router, or PrimeNG modules

### Requirement: Meta block covers id, title, and public flag
`TerminalContentSchema` SHALL include a `meta` block with required fields: `id` (string), `title` (string, min length 1), `public` (boolean). No other fields SHALL be required in `meta`.

#### Scenario: Valid meta passes
- **WHEN** parsing `{ meta: { id: "demo-1", title: "Demo", public: true }, state: { local: {}, global: {} }, login: { users: [] }, nodes: { start: { text: "x", choices: [] } } }`
- **THEN** the parse succeeds

#### Scenario: Empty title is rejected
- **WHEN** parsing the same content but with `meta.title` set to an empty string
- **THEN** the parse fails with an issue at path `meta.title`

#### Scenario: Missing public flag is rejected
- **WHEN** parsing content with `meta` missing the `public` key
- **THEN** the parse fails with an issue at path `meta.public`

### Requirement: State declarations support boolean, number, enum, and string types
`TerminalContentSchema` SHALL include `state.local` and `state.global` as maps keyed by variable name. Each variable SHALL declare a `type` of `"boolean"`, `"number"`, `"enum"`, or `"string"`, plus a `default` value whose runtime type matches the declared `type`. Enum variables SHALL additionally declare a `values` array of strings, and the `default` SHALL be one of those values.

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
`TerminalContentSchema` SHALL include `login.users` as an array of `{ username: string, password: string }`. Both fields SHALL be required strings; `password` SHALL NOT be enforced to look hashed. A doc-comment in the schema module SHALL note that fictional passwords are cleartext at rest in terminal content and are stripped by the API on delivery to the Terminal player app.

#### Scenario: Login block with cleartext password validates
- **WHEN** parsing `login.users = [{ username: "alice", password: "wonderland" }]`
- **THEN** the parse succeeds

#### Scenario: Empty users array validates
- **WHEN** parsing `login.users = []`
- **THEN** the parse succeeds

#### Scenario: Missing password is rejected
- **WHEN** parsing `login.users = [{ username: "alice" }]`
- **THEN** the parse fails with an issue at path `login.users.0.password`

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
