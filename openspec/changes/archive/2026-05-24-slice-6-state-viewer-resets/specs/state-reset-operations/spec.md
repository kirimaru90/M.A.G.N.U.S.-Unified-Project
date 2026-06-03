## ADDED Requirements

### Requirement: Reset a single variable to its default

Each state-table row SHALL offer a per-variable reset action. For a local variable it SHALL call `POST /terminals/:id/state/:key/reset`; for a global variable it SHALL call `POST /campaigns/:id/state/:key/reset`, where `:key` is the bare variable name. The action SHALL be guarded by a low-severity confirmation that names the variable and its default value, and after success the panel SHALL re-read state so the variable's `current` returns to its default.

#### Scenario: Single local variable reset

- **WHEN** an admin confirms the reset action on a local variable row
- **THEN** `POST /terminals/:id/state/:key/reset` is called and, after success, the row's current value equals its default

#### Scenario: Single global variable reset

- **WHEN** an admin confirms the reset action on a global variable row
- **THEN** `POST /campaigns/:id/state/:key/reset` is called and the row's current value returns to its default

#### Scenario: Reset is confirmed first

- **WHEN** an admin clicks per-variable reset
- **THEN** a confirmation appears naming the variable, and no request is made until it is confirmed

### Requirement: Reset all local state of a terminal

The terminal state panel SHALL offer an action to reset all of the terminal's local variables to their defaults via `POST /terminals/:id/state/reset`, guarded by a medium-severity (warn) confirmation that states how many variables will be reset. After success the panel SHALL re-read state.

#### Scenario: All local reset

- **WHEN** an admin confirms "reset all local state" for a terminal
- **THEN** `POST /terminals/:id/state/reset` is called and every local variable's current value returns to its default

#### Scenario: Warn-level confirmation

- **WHEN** an admin triggers the all-local reset
- **THEN** a warn-severity confirmation is shown before any request is issued

### Requirement: Reset all global state of a campaign

The campaign state panel SHALL offer an action to reset all of the campaign's global variables to their defaults via `POST /campaigns/:id/state/reset`, guarded by a medium-severity (warn) confirmation. This operation SHALL affect only global state — not the local state of the campaign's terminals. After success the panel SHALL re-read state.

#### Scenario: All global reset

- **WHEN** an admin confirms "reset all global state" for a campaign
- **THEN** `POST /campaigns/:id/state/reset` is called and every global variable's current value returns to its default

#### Scenario: Local state untouched by global reset

- **WHEN** the all-global reset completes
- **THEN** the local state of the campaign's terminals is unchanged

### Requirement: Reset the entire campaign

The campaign state panel SHALL offer a high-severity "reset entire campaign" action that restores all global state AND all local state across every terminal in the campaign to defaults. It SHALL be orchestrated on the client: first `POST /campaigns/:id/state/reset` (global), then one `POST /terminals/:id/state/reset` for each terminal in the campaign. If the global reset fails the operation SHALL abort before resetting any terminal. The per-terminal resets SHALL run such that one terminal's failure does not prevent the others, and the result SHALL be reported as a summary identifying any failures. The confirmation SHALL require the admin to retype the campaign name exactly before the destructive action is enabled.

#### Scenario: Entire-campaign reset orchestration

- **WHEN** an admin confirms the entire-campaign reset
- **THEN** the campaign global reset is called first, then a local reset is called for each terminal in the campaign, and on completion both global and all local state read back as their defaults

#### Scenario: Retype-name gate

- **WHEN** the entire-campaign confirmation dialog is open
- **THEN** the destructive button is disabled until the admin types the campaign name exactly, and is enabled once the typed value matches

#### Scenario: Global failure aborts before terminals

- **WHEN** the campaign global reset request fails
- **THEN** no per-terminal reset request is issued and the failure is reported

#### Scenario: Partial terminal failure is reported

- **WHEN** one terminal's local reset fails while others succeed
- **THEN** the successful resets still apply and the summary reports which terminal(s) failed

### Requirement: Confirmation severity scales with blast radius

Every reset operation SHALL be guarded by a confirmation, and the confirmation's severity SHALL scale with the operation's blast radius: low for a single variable, warn for all-local or all-global, and danger (with the retype-name gate) for the entire campaign.

#### Scenario: Severity increases with scope

- **WHEN** the per-variable, all-scope, and entire-campaign reset actions are each triggered
- **THEN** the per-variable confirmation is low severity, the all-local/all-global confirmations are warn severity, and the entire-campaign confirmation is danger severity with a retype-name gate
