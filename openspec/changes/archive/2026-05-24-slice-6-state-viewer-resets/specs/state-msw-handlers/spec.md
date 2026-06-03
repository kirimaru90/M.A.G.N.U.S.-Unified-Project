## ADDED Requirements

### Requirement: GET state derives declarations from content and current from an override store

The MSW layer SHALL handle `GET /terminals/:id/state` and `GET /campaigns/:id/state`, returning a JSON array of state entries each shaped `{ key, type, default, current, values? }`. The `type`, `default`, and (for enums) `values` SHALL be derived from the declared terminal content (the source of truth for defaults). The `current` value SHALL come from a runtime override store and SHALL equal the `default` until a mutation overrides it. Terminal-local state SHALL be read from the terminal's `state.local`; campaign-global state SHALL be the union of every `state.global` declaration across the campaign's terminals.

#### Scenario: Terminal local state read

- **WHEN** `GET /terminals/:id/state` is requested for a terminal with declared local variables
- **THEN** the handler returns one entry per local variable with `type`/`default` from the content and `current` equal to the default (or the overridden value if one was set)

#### Scenario: Campaign global state aggregates terminals

- **WHEN** `GET /campaigns/:id/state` is requested
- **THEN** the handler returns the union of all `state.global` declarations across the campaign's terminals, de-duplicated by key

#### Scenario: Unknown id returns 404

- **WHEN** a state read targets a terminal or campaign id not in the store
- **THEN** the handler responds with 404

### Requirement: Mutate validates and applies atoms

The MSW layer SHALL handle `POST /terminals/:id/state/mutate` and `POST /campaigns/:id/state/mutate` accepting a `{ mutations: MutationItemDto[] }` body. For each atom it SHALL strip the `local.`/`global.` scope prefix, verify the variable is declared (rejecting mutations that target an undeclared variable), and verify the value matches the declared type (rejecting type mismatches). Mutations SHALL be atomic: if any atom is invalid the handler SHALL apply none. Valid `set`/`increment`/`toggle` atoms SHALL update the override store so a subsequent state read reflects the new `current`.

#### Scenario: Set mutation reflected on next read

- **WHEN** a `set` mutation is applied to a declared variable and the state is read again
- **THEN** the read returns the mutated value as `current`

#### Scenario: Type mismatch rejected

- **WHEN** a mutation sets a `number` variable to a string value
- **THEN** the handler rejects the request with an error status and the stored value is unchanged

#### Scenario: Undeclared variable rejected

- **WHEN** a mutation targets a variable not declared in the target terminal or campaign
- **THEN** the handler rejects the request and applies no part of the batch

### Requirement: Reset endpoints restore defaults

The MSW layer SHALL handle the four reset endpoints. `POST /terminals/:id/state/:key/reset` and `POST /campaigns/:id/state/:key/reset` SHALL remove the override for the named variable so it reads back as its default. `POST /terminals/:id/state/reset` SHALL clear all of that terminal's local overrides. `POST /campaigns/:id/state/reset` SHALL clear all of that campaign's global overrides and SHALL NOT touch terminal-local overrides.

#### Scenario: Single variable reset clears override

- **WHEN** a previously mutated variable is reset via its `:key/reset` endpoint and then read
- **THEN** the variable's `current` equals its declared default

#### Scenario: All-local reset clears terminal overrides

- **WHEN** `POST /terminals/:id/state/reset` is called
- **THEN** every local variable of that terminal reads back as its default

#### Scenario: Campaign reset is global-only

- **WHEN** `POST /campaigns/:id/state/reset` is called
- **THEN** all global overrides for the campaign are cleared and the local overrides of the campaign's terminals are unchanged

### Requirement: Handlers registered and seeded for non-empty panels

The state handlers SHALL be registered in the MSW worker setup alongside the existing handler groups. The seed data SHALL declare at least one terminal-local and one campaign-global variable so that both panels render non-empty out of the box.

#### Scenario: Handlers active

- **WHEN** the app boots against MSW
- **THEN** the state endpoints respond from the registered state handlers

#### Scenario: Seed yields visible state

- **WHEN** an admin opens a seeded terminal's local-state panel and a seeded campaign's global-state panel
- **THEN** each panel shows at least one declared variable

### Requirement: Campaign-owned global-schema endpoints

The MSW layer SHALL maintain a campaign-owned global-schema store (`campaignId → name → { type, default, values? }`) seeded once from terminals' `state.global` declarations, and SHALL expose CRUD over it: `GET /campaigns/:id/global-schema` returns the schema map; `POST /campaigns/:id/global-schema` adds a variable from `{ name, type, default, values? }`, rejecting a duplicate name with 409; `PATCH /campaigns/:id/global-schema/:name` merges the provided fields into the existing declaration, returning 404 if the name is unknown; `DELETE /campaigns/:id/global-schema/:name` removes the declaration, returning 404 if unknown. `GET /campaigns/:id/state` SHALL derive its entries from this owned store (applying current-value overrides) rather than aggregating across terminals per read.

#### Scenario: Add then read back

- **WHEN** `POST /campaigns/:id/global-schema` adds a new variable and the schema is read again
- **THEN** the variable appears in the `GET /campaigns/:id/global-schema` response and as a row in `GET /campaigns/:id/state`

#### Scenario: Duplicate name rejected

- **WHEN** `POST /campaigns/:id/global-schema` is called with a name that already exists
- **THEN** the handler responds with 409 and the schema is unchanged

#### Scenario: Patch changes a declaration field

- **WHEN** `PATCH /campaigns/:id/global-schema/:name` is called with a new `type` or `default`
- **THEN** the stored declaration is updated and a subsequent state read reflects the new default

#### Scenario: Delete removes the variable

- **WHEN** `DELETE /campaigns/:id/global-schema/:name` is called for an existing variable
- **THEN** it no longer appears in the schema or the campaign state read

#### Scenario: Campaign state reads the owned schema

- **WHEN** `GET /campaigns/:id/state` is requested
- **THEN** its entries come from the campaign-owned global-schema store with current-value overrides applied, not from a per-read terminal aggregation
