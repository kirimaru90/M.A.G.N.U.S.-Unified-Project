## ADDED Requirements

### Requirement: Boot-gate flag (`login.gateOnBoot`) round-trips through persistence and playback
The terminal content DTO SHALL accept an optional boolean `login.gateOnBoot`. The API SHALL preserve this flag through the login strip-and-serve path — independently of the fictional-password stripping — so it survives create, import, and update and is delivered to the player on `load` and terminal-detail reads. A non-boolean `gateOnBoot` SHALL be rejected with HTTP 400 by DTO validation. `gateOnBoot` SHALL NOT be materialised with a default: when the input omits it, stored and served `content.login` SHALL NOT contain a `gateOnBoot` key.

Because the API rebuilds `content.login` from the incoming DTO (passwords are moved to the `fictionalUsers` collection), the rebuild SHALL emit `content.login` when the incoming `login` has **either** a non-empty `users` array **or** a defined `gateOnBoot`, carrying `gateOnBoot` through when defined. The read-time strip SHALL continue to drop `content.login` whenever no fictional users exist for the terminal — even if a `gateOnBoot` was supplied — so a credential-less boot gate is never delivered.

#### Scenario: gateOnBoot persists with users and is served without passwords
- **WHEN** an admin creates/imports a terminal whose content is `login: { gateOnBoot: false, users: [{ username: "u", password: "p" }] }`
- **THEN** the persisted `content.login` SHALL be `{ gateOnBoot: false, users: [{ username: "u" }] }`
- **AND** the `fictionalUsers` collection SHALL contain a row `{ terminalId, username: "u", password: "p" }`
- **AND** the `GET /terminals/:id/load` and `GET /terminals/:id` responses SHALL include `content.login.gateOnBoot === false` and SHALL NOT include any `password`

#### Scenario: gateOnBoot true persists
- **WHEN** the content is `login: { gateOnBoot: true, users: [{ username: "u", password: "p" }] }`
- **THEN** the persisted and served `content.login.gateOnBoot` SHALL be `true`

#### Scenario: Omitted gateOnBoot is not materialised
- **WHEN** the content is `login: { users: [{ username: "u", password: "p" }] }`
- **THEN** the persisted and served `content.login` SHALL contain `users` but SHALL NOT contain a `gateOnBoot` key

#### Scenario: gateOnBoot without users does not resurrect a login block
- **WHEN** the content is `login: { gateOnBoot: false, users: [] }` (or a `login` with `gateOnBoot` and no `users`)
- **THEN** the terminal SHALL have no fictional users
- **AND** the served `content` SHALL have no `login` key (identical to the no-fictional-users rule), and the request SHALL NOT emit HTTP 500

#### Scenario: Non-boolean gateOnBoot is rejected
- **WHEN** an admin posts content whose `login.gateOnBoot` is not a boolean (e.g. the string `"yes"`)
- **THEN** the API SHALL respond HTTP 400 from DTO validation

#### Scenario: Update round-trips gateOnBoot
- **WHEN** an admin `PUT`s a terminal changing `login.gateOnBoot` from unset/`true` to `false` while leaving `users` passwords blank
- **THEN** the password-preserving reconcile SHALL keep existing stored passwords
- **AND** the persisted and served `content.login.gateOnBoot` SHALL be `false`
