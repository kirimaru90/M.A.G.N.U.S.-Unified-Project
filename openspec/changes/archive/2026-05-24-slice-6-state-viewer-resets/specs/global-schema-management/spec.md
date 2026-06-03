## ADDED Requirements

### Requirement: Campaign owns the global variable schema

Global variables SHALL be owned by the campaign, exposed as a campaign-scoped schema resource of `name → { type, default, values? }`. A `CampaignGlobalSchemaApiService` SHALL mediate all schema calls — `getSchema(campaignId)`, `addVar(campaignId, name, decl)`, `updateVar(campaignId, name, decl)`, `deleteVar(campaignId, name)` — against `/campaigns/:id/global-schema`. Components SHALL NOT call `HttpClient` directly for schema operations. Terminals SHALL reference global variables by name only and SHALL NOT own their declarations.

#### Scenario: Schema loads for a campaign

- **WHEN** the campaign global panel opens
- **THEN** it calls `GET /campaigns/:id/global-schema` through `CampaignGlobalSchemaApiService` and renders one row per declared global variable

#### Scenario: Schema calls go through the service

- **WHEN** a global variable is added, edited, or deleted
- **THEN** the request is issued by `CampaignGlobalSchemaApiService`, not by a direct `HttpClient` call in a component

### Requirement: Campaign global table manages declarations and values together

The campaign's global-state table SHALL be a single `app-state-table` that supports both schema operations and value operations. It SHALL provide an add affordance that reveals an editable blank row for declaring a new global variable (name, type, default, and — for `enum` — values) and SHALL provide a per-row delete action that removes the declaration after confirmation. The separate "Schema variabili globali" panel SHALL NOT exist. The add and delete affordances SHALL be opt-in so that tables which do not own a schema (e.g. the terminal-local panel) do not show them.

#### Scenario: Add a global variable from the table

- **WHEN** an admin uses the add affordance, fills in name/type/default, and saves
- **THEN** `POST /campaigns/:id/global-schema` is called with the declaration and, after success, the table re-reads and shows the new variable

#### Scenario: Delete a global variable from the table

- **WHEN** an admin triggers the delete action on a global variable and confirms
- **THEN** `DELETE /campaigns/:id/global-schema/:name` is called and the variable is removed from the table

#### Scenario: Terminal-local table shows no schema add/delete

- **WHEN** the terminal-local "Stato locale" table renders
- **THEN** it shows neither the add-variable affordance nor the per-row delete action

### Requirement: Editing a global declaration from the campaign is allowed

An admin SHALL be able to edit a global variable's declaration (`type`, `default`, and `values`) from the campaign global table, and the edit SHALL persist. The campaign SHALL NOT block such edits or redirect the admin to the terminal editor. On a successful `type` change the variable's stored `current` override SHALL be cleared so it reads back as the new default rather than a stale value of the previous type. A rename (changing the variable's name) SHALL be performed as a delete of the old name plus an add of the new name with the edited declaration.

#### Scenario: Change a global variable's type

- **WHEN** an admin changes a global variable's `type` and saves
- **THEN** `PATCH /campaigns/:id/global-schema/:name` is called with the new declaration, no "edit in the terminal" warning is shown, and the variable's current value reads back as the new default

#### Scenario: Change default without changing type

- **WHEN** an admin edits only the `default` (or `enum` `values`)
- **THEN** the change is sent as a single `PATCH` and persists on re-read

### Requirement: Terminal editor references global variables read-only

The terminal editor's state-schema section SHALL display global variables as **read-only** rows (name, type, default, and enum values shown but not editable). To reference a campaign global variable, the editor SHALL present an add control that, when activated, reveals an autocomplete field listing only the campaign global names not already referenced by this terminal; selecting a name SHALL append a read-only reference row. A reference SHALL be removable. The same name SHALL NOT be referenced twice by one terminal. Referenced names SHALL be persisted in the terminal's `content.state.global` through the editor's existing deferred-save form.

#### Scenario: Add a global reference via autocomplete

- **WHEN** an admin presses the add-global control and selects a name from the autocomplete
- **THEN** a read-only row for that global variable appears and the name is staged into the terminal's `state.global`

#### Scenario: Already-referenced names are excluded

- **WHEN** the autocomplete list is shown
- **THEN** it offers only campaign global names not already referenced by this terminal, preventing duplicates

#### Scenario: Global fields are not editable in the terminal

- **WHEN** a global reference row is shown in the terminal editor
- **THEN** its type and default are displayed as text and cannot be edited from the terminal

### Requirement: Consistent columned styling across variable lists

Local and global variable lists SHALL use the same columned table presentation (`Variabile`, `Tipo`, `Default`, and where applicable `Valore` and `Azioni`). The terminal editor's lists MAY remain bound to the editor's reactive form rather than reusing the live `app-state-table` component, but SHALL adopt the same columned layout and styling.

#### Scenario: Editor lists match the panel styling

- **WHEN** an admin views the terminal editor's local and global variable lists
- **THEN** both render in the same columned layout used by the campaign and terminal-detail state tables
