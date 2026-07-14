## MODIFIED Requirements

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
The top-level `state` field SHALL be **optional**; when omitted it SHALL default to `{ local: {}, global: {} }`, matching the API, which treats an absent `state` as no declared variables. When present, `TerminalContentSchema` SHALL include `state.local` and `state.global` as maps keyed by variable name. Each variable SHALL declare a `type` of `"boolean"`, `"number"`, `"enum"`, or `"string"`, plus a `default` value whose runtime type matches the declared `type`. Enum variables SHALL additionally declare a `values` array of strings, and the `default` SHALL be one of those values.

#### Scenario: Omitted state defaults to empty local and global
- **WHEN** parsing content that omits the top-level `state` key
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
