## MODIFIED Requirements

### Requirement: Login block in olonastro JSON schema
The olonastro JSON schema SHALL support an optional `login` field on the root object and on any individual node object. In the canonical (authored, server-stored) document the `login` field SHALL have the following structure:

```json
"login": {
  "gateOnBoot": false,
  "users": [
    { "username": "<string>", "password": "<string>" }
  ]
}
```

`login.users` SHALL hold the fictional credential registry. `login.gateOnBoot` SHALL be an **optional boolean** that is meaningful **only on the root object** and controls whether a non-empty root registry prompts for login before the `"start"` node:

- When `gateOnBoot` is `true` or omitted, a non-empty root `login.users` SHALL gate the entire file (the login prompt is applied before `"start"` is shown) — this is the historical behaviour and the default.
- When `gateOnBoot` is `false`, the root registry SHALL still exist (its usernames remain available to per-node gates and the login dropdown) but the terminal SHALL NOT prompt for login at boot.

`gateOnBoot` on a node-level `login` block SHALL have no effect (node gating is applied whenever the node is entered without an authenticated user).

When this content is delivered to the terminal client via `GET /terminals/:id/load`, the server SHALL strip every `login.users[].password`, so the client receives only usernames (and `gateOnBoot`, when stored):

```json
"login": {
  "gateOnBoot": false,
  "users": [
    { "username": "<string>" }
  ]
}
```

A `login` field on an individual node gates only that node. Node-level `login` takes precedence over root-level `login` for that specific node. The client SHALL treat the presence of a `login.users` array (regardless of any `password` field) as the gate, and SHALL NOT read or rely on a `password` field.

#### Scenario: Root login with gateOnBoot omitted gates before start
- **WHEN** the loaded JSON contains a non-empty `login.users` array at the root level and no `gateOnBoot` key
- **THEN** the engine SHALL treat the entire file as protected and apply the root login gate before navigating to `"start"`

#### Scenario: Root login with gateOnBoot true gates before start
- **WHEN** the loaded JSON contains a non-empty root `login.users` array and `login.gateOnBoot` is `true`
- **THEN** the engine SHALL apply the root login gate before navigating to `"start"`

#### Scenario: Root login with gateOnBoot false does not gate at boot
- **WHEN** the loaded JSON contains a non-empty root `login.users` array and `login.gateOnBoot` is `false`
- **THEN** the engine SHALL navigate directly to `"start"` with no login intercept
- **AND** navigating to a node that carries its own `login.users` SHALL still apply that node's gate

#### Scenario: Valid login block on a node
- **WHEN** a node object contains a `login.users` array
- **THEN** the engine SHALL apply that node's login gate instead of the root-level gate when navigating to that node
- **AND** any `gateOnBoot` on that node's `login` block SHALL be ignored

#### Scenario: No login block present
- **WHEN** neither the root object nor the target node contains a `login` field
- **THEN** the engine SHALL navigate to the node without any login intercept (identical to current behaviour)

#### Scenario: Delivered login block omits passwords
- **WHEN** `GET /terminals/:id/load` returns a holotape whose root or a node carries a `login` block
- **THEN** every entry in `login.users` SHALL contain a `username` and SHALL NOT contain a `password`
- **THEN** the client SHALL still present the gate (subject to `gateOnBoot` at the root), populating the username `<select>` from the delivered usernames
