## ADDED Requirements

### Requirement: Editor tolerates content served without a login block

The terminal editor's content→form hydration (`editor/terminal-form.ts`, `toForm`) SHALL initialize without error when the loaded content omits the `login` block entirely, not only when `login.users` is an empty array. The API strips `login` from served content whenever a terminal has no fictional users, so `content.login` MAY be `undefined` on load. In that case the editor SHALL treat it as no fictional users (empty users list) and SHALL apply the default boot-gate behavior (gate at boot), identical to receiving `login: { users: [] }` with no `gateOnBoot`. This extends the shell's existing null-scope tolerance to the login block.

#### Scenario: Login-free terminal hydrates instead of crashing

- **WHEN** the admin opens `/terminals/:id` for a terminal whose served content has no `login` key
- **THEN** the editor initializes and renders its metadata, state, users, and nodes sections (no `ngOnInit` error and no blank page), with the fictional-users list empty

#### Scenario: Absent login block defaults the boot gate on

- **WHEN** `toForm` hydrates content that omits the `login` block
- **THEN** the `loginGateOnBoot` control is `true` (gate at boot), matching the absent/`true` default used when a `login` block is present without `gateOnBoot`

#### Scenario: Login-present hydration is unchanged

- **WHEN** the served content includes a `login` block (`{ users: [...] }`, with or without `gateOnBoot`)
- **THEN** the editor hydrates the users list and boot-gate toggle exactly as before, with no change in behavior
