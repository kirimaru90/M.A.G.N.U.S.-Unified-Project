## MODIFIED Requirements

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
