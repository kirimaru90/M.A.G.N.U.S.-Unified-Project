## MODIFIED Requirements

### Requirement: Nodes are a map keyed by node id with content fields
`TerminalContentSchema` SHALL require at least one entry in `nodes`. Each node SHALL accept the optional fields: `text` (string), `on_enter` (array of mutations), `choices` (array of `NodeChoice`), `variants` (array of `NodeVariant`), `components` (array of `NodeComponent`), and `login` (a per-node login block). A node SHALL be valid with only `text` and `choices`, with only `variants`, or with only `components` — the schema SHALL NOT require all four to coexist.

The per-node `login` field SHALL be **optional** and, when present, SHALL be an object `{ users: string[] }` whose `users` is an array of fictional usernames (bare strings, **no passwords** — node-level gates reference credentials declared in the root registry and validated server-side). The schema SHALL preserve `login` on parse rather than stripping it, so the node editor's per-node login selection round-trips through `TerminalContentSchema.parse`/`safeParse`. Passwords SHALL NOT appear on a node-level `login`.

#### Scenario: Node with text and empty choices validates
- **WHEN** parsing `nodes.start = { text: "hello", choices: [] }`
- **THEN** the parse succeeds

#### Scenario: Node with only variants validates
- **WHEN** parsing `nodes.porta = { variants: [{ default: true, text: "x", choices: [] }] }`
- **THEN** the parse succeeds

#### Scenario: Node with per-node login round-trips
- **WHEN** parsing `nodes.deposito = { text: "riservato", login: { users: ["tecnico"] } }`
- **THEN** the parse succeeds and the parsed `nodes.deposito.login.users` equals `["tecnico"]` (it is not stripped)

#### Scenario: Node without login validates unchanged
- **WHEN** parsing `nodes.start = { text: "hi", choices: [] }` with no `login` key
- **THEN** the parse succeeds and the parsed node has no `login` field

#### Scenario: Empty nodes map is rejected
- **WHEN** parsing content with `nodes: {}`
- **THEN** the parse fails with an issue at path `nodes`
