## MODIFIED Requirements

### Requirement: Campaign owns the global variable schema

Global variables SHALL be owned by the campaign. Both their **declarations** (`type`, `default`, `values?`) and their **current values** SHALL be read from the campaign document's `state` map (`GET /campaigns/:id` → `state`, shaped `name → { type, default, value, values? }`); the global panel SHALL build its rows from that single map and SHALL NOT depend on the flat `GET /campaigns/:id/state` for this purpose. All schema **writes** SHALL go through a single batched endpoint, `PATCH /campaigns/:id/state/schema`, with a body of `{ ops: StateSchemaOp[] }`, where each op is `{ action: 'add' | 'update' | 'delete', name, rename?, entry?, value? }` and `entry` is `{ type, default, values? }`. A `CampaignGlobalSchemaApiService` SHALL mediate the write via a single method, `patchSchema(campaignId, ops)`, returning the `{ state }` flat post-update snapshot. Components SHALL NOT call `HttpClient` directly for schema operations, and SHALL NOT call any `/campaigns/:id/global-schema` route (it no longer exists). Terminals SHALL reference global variables by name only and SHALL NOT own their declarations.

#### Scenario: Schema loads for a campaign

- **WHEN** the campaign global panel opens
- **THEN** it renders one row per global variable, sourcing each declaration (`type`, `default`, `values?`) and the current `value` from the campaign document's `state` map in a single read

#### Scenario: Schema writes go through the batched service method

- **WHEN** a global variable is added, edited, renamed, or deleted
- **THEN** the request is issued as a single `PATCH /campaigns/:id/state/schema` with a one-element `ops` array by `CampaignGlobalSchemaApiService.patchSchema`, not by a direct `HttpClient` call in a component and not against any `/global-schema` route

#### Scenario: Add a global variable

- **WHEN** an admin adds a variable with name/type/default (and `values` for enum)
- **THEN** `patchSchema` is called with `[{ action: 'add', name, entry }]` and, after success, the table re-reads and shows the new variable

#### Scenario: Delete a global variable

- **WHEN** an admin confirms deletion of a global variable
- **THEN** `patchSchema` is called with `[{ action: 'delete', name }]` and the variable is removed from the table

### Requirement: Editing a global declaration from the campaign is allowed

An admin SHALL be able to edit a global variable's declaration (`type`, `default`, `values`) and rename it from the campaign global table, and the edit SHALL persist. The campaign SHALL NOT block such edits or redirect the admin to the terminal editor. A default/values-only edit SHALL be sent as `{ action: 'update', name, entry, value }` with `value` set to the current value so it is preserved. A `type` change SHALL be sent as `{ action: 'update', name, entry }` with `value` omitted, so the variable resets to the new `entry.default` (no separate reset call). A **rename** SHALL be sent as a single `{ action: 'update', name, rename, entry, value }` op — NOT as a delete plus add — so that the backend rewrites referencing terminals atomically and the value is preserved.

#### Scenario: Change a global variable's type

- **WHEN** an admin changes a global variable's `type` and saves
- **THEN** `patchSchema` is called with `[{ action: 'update', name, entry }]` (no `value`), no "edit in the terminal" warning is shown, and the variable's current value reads back as the new default

#### Scenario: Change default without changing type

- **WHEN** an admin edits only the `default` (or enum `values`)
- **THEN** the change is sent as a single `update` op carrying the preserved `value` and persists on re-read

#### Scenario: Rename a global variable

- **WHEN** an admin renames a global variable and saves
- **THEN** `patchSchema` is called with a single `[{ action: 'update', name, rename, entry, value }]` op, and on success referencing terminals reflect the new name

## ADDED Requirements

### Requirement: Cross-reference conflicts are surfaced as a blocking modal

When a `PATCH /campaigns/:id/state/schema` returns `409` with a `StateSchemaConflictResponse` (a `delete` of a variable referenced by terminals at `content.state.global.<name>`, or a `rename` that collides on a referencing terminal), the backoffice SHALL parse `conflicts[].referencedBy` and present a **blocking** modal that displays the response `error` and lists each referencing terminal as a clickable link to `/terminals/:id`. The modal SHALL be dismiss-only — it SHALL NOT offer a proceed/override action — so the admin resolves the referencing terminals before retrying. Non-409 errors (and unparseable 409 bodies) SHALL fall back to a generic error notification.

#### Scenario: Delete of a referenced variable is blocked

- **WHEN** an admin deletes a global variable referenced by one or more terminals and the API returns `409`
- **THEN** a blocking modal opens listing the referencing terminals as links to their editors, and the delete does not take effect

#### Scenario: Rename collides on a referencing terminal

- **WHEN** an admin renames a global variable whose rename target already exists on a referencing terminal and the API returns `409`
- **THEN** the same blocking modal opens listing the colliding terminal(s) as links

#### Scenario: Non-conflict errors use the generic path

- **WHEN** a schema write fails with a non-409 status (or a 409 whose body cannot be parsed)
- **THEN** a generic error notification is shown rather than the conflict modal
