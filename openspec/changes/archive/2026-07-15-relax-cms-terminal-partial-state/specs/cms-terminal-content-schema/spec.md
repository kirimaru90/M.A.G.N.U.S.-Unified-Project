## MODIFIED Requirements

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
