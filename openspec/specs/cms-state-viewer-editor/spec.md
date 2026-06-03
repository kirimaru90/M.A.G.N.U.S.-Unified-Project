## ADDED Requirements

### Requirement: Terminal local state panel

The terminal detail page (`/terminals/:id`) SHALL render a local-state panel below the content editor. The panel SHALL load state by calling `TerminalsApiService.getEnvelope(id)` to obtain both the schema (`content.state.local`) and current runtime values (`state`), then merging them into `StateEntryDto[]`. It SHALL display a PrimeNG table with columns `key`, `type`, `default`, and `current`, plus per-row actions. When the terminal declares no local variables, the panel SHALL render an empty state ("Nessuna variabile locale dichiarata") instead of an empty table.

The panel SHALL cache the local schema after the first full load. Subsequent reloads triggered by mutations or variable resets SHALL re-fetch only the flat runtime values via `StateApiService.getTerminalFlatState(id)` and merge with the cached schema, avoiding a redundant schema fetch. Reloads triggered by `refreshTrigger` changes (after an editor save) or by `onSchemaChange` SHALL perform a full reload (schema + values) because the schema may have been modified.

#### Scenario: Local state renders

- **WHEN** an admin opens `/terminals/:id` for a terminal that declares local variables
- **THEN** the page combines schema from `GET /terminals/:id` with values from `GET /terminals/:id/state` and shows one table row per declared local variable with its key, type, default value, and current value

#### Scenario: No local variables declared

- **WHEN** the terminal declares no local variables
- **THEN** the panel shows the "Nessuna variabile locale dichiarata" empty state and no table rows

#### Scenario: Mutation reload uses cached schema

- **WHEN** an admin mutates a local variable
- **THEN** the panel reloads by fetching only the flat state (`GET /terminals/:id/state`) and merges with the already-cached schema, without issuing a second `GET /terminals/:id`

#### Scenario: Save reload fetches full state

- **WHEN** the editor triggers a save (refreshTrigger increments)
- **THEN** the panel performs a full reload via `GET /terminals/:id` to pick up any schema changes made in the editor

### Requirement: Campaign global state panel

The campaign detail page (`/campaigns/:id`) SHALL render a **single** global-state panel below the players panel; there SHALL be no separate "Schema variabili globali" panel. The panel SHALL load values via `GET /campaigns/:id/state` and display the same `{ key, type, default, current }` table layout as the terminal panel. The global variables shown SHALL be the **campaign-owned** schema (see `global-schema-management`), not a per-read aggregation across terminals. The table SHALL surface, in one place, both declaration operations (add a variable, edit a variable's `type`/`default`/`values`, delete a variable) and value operations (override `current`, per-variable reset). When the campaign declares no global variables, the panel SHALL render an empty state ("Nessuna variabile globale dichiarata").

#### Scenario: Global state renders from the campaign-owned schema

- **WHEN** an admin opens `/campaigns/:id` for a campaign with declared global variables
- **THEN** the page shows one row per global variable from the campaign-owned schema, each with its type, default, and current value

#### Scenario: Schema and value operations share one table

- **WHEN** an admin views the campaign global panel
- **THEN** add/edit/delete of a declaration and override/reset of a value are all available on the same table, with no separate schema panel

#### Scenario: No global variables declared

- **WHEN** the campaign declares no global variables
- **THEN** the panel shows the "Nessuna variabile globale dichiarata" empty state

### Requirement: Typed inline value override

Each panel SHALL allow an admin to override a variable's `current` value through an inline editor whose control matches the variable's declared type: a checkbox for `boolean`, a number input for `number`, a dropdown of the declared `values` for `enum`, and a text input for `string`. On submit the editor SHALL send the new value as a single mutation atom (`{ mutations: [ { key, op: 'set', value } ] }`) to the matching endpoint — `POST /terminals/:id/state/mutate` for local variables and `POST /campaigns/:id/state/mutate` for global variables — with the key scope-prefixed (`local.<name>` or `global.<name>`). After a 2xx response the panel SHALL re-read state so the displayed `current` reflects the server.

#### Scenario: Override a number variable

- **WHEN** an admin edits a `number` variable's current value to a valid number and submits
- **THEN** `POST /terminals/:id/state/mutate` is called with `{ mutations: [ { key: 'local.<name>', op: 'set', value: <number> } ] }` and, after success, the table shows the new current value

#### Scenario: Override an enum variable

- **WHEN** an admin edits an `enum` variable
- **THEN** the editor presents a dropdown limited to the declared `values` and submits the chosen value as a single `set` atom

#### Scenario: Editor matches the declared type

- **WHEN** the inline editor opens for a `boolean` variable
- **THEN** the control rendered is a checkbox, not a free-text input

### Requirement: Client-side type validation before mutate

Before issuing any mutate request, the editor SHALL validate the entered value against a Zod schema derived from the variable's declared type (`boolean`, `number`, `string`, or `enum` constrained to the declared `values`). When validation fails, the editor SHALL show an inline error and SHALL NOT issue the network request.

#### Scenario: String rejected for a number variable

- **WHEN** an admin attempts to set a non-numeric value on a `number` variable
- **THEN** an inline validation error appears and no `/state/mutate` request is made

#### Scenario: Out-of-range enum rejected

- **WHEN** an admin attempts to set an `enum` variable to a value not in its declared `values`
- **THEN** validation fails client-side and no `/state/mutate` request is made

#### Scenario: Valid value passes

- **WHEN** the entered value matches the declared type
- **THEN** validation passes and the single-atom mutate request is issued

### Requirement: StateApiService mediates all state calls

A `StateApiService` SHALL expose every state read, mutate, and reset call (`getTerminalFlatState`, `mutateTerminal`, `mutateCampaign`, `resetTerminalVar`, `resetCampaignVar`, `resetTerminalAll`, `resetCampaignAll`). Panel and reset components SHALL NOT call `HttpClient` directly for state operations.

`getTerminalFlatState(id)` SHALL call `GET /terminals/:id/state` and return `Observable<Record<string, unknown>>` (the raw flat key→value map). Building `StateEntryDto[]` from this flat map is the responsibility of the caller, which combines it with a schema source.

`StateApiService` SHALL NOT expose `getTerminalState` or `getCampaignState` — those methods mixed schema enrichment into the service layer and produced an incorrect result (Zod parse against an incompatible shape).

#### Scenario: Reads go through the service

- **WHEN** a state panel loads its flat runtime values
- **THEN** the request is issued by `StateApiService.getTerminalFlatState`, not by a direct `HttpClient` call in a component

#### Scenario: Flat state returned as-is

- **WHEN** `GET /terminals/:id/state` returns `{ "flag": true, "counter": 5 }`
- **THEN** `getTerminalFlatState` emits `{ "flag": true, "counter": 5 }` without any Zod transformation
