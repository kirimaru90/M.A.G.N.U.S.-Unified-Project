## MODIFIED Requirements

### Requirement: Login block holds fictional users with cleartext passwords
`TerminalContentSchema` SHALL include `login.users` as an array of `{ username: string, password: string }`. Both fields SHALL be required strings; `password` SHALL NOT be enforced to look hashed. A doc-comment in the schema module SHALL note that fictional passwords are cleartext at rest in terminal content and are stripped by the API on delivery to the Terminal player app.

The `login` block SHALL additionally accept an **optional** `gateOnBoot: boolean`. When present it SHALL parse as a boolean; when omitted it SHALL default to unset (the API/emulator treat absence as `true`). A non-boolean `gateOnBoot` SHALL fail parsing with an issue at path `login.gateOnBoot`. `gateOnBoot` SHALL be independent of `users`: a login block MAY carry `gateOnBoot` alongside any (including empty) `users` array.

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
