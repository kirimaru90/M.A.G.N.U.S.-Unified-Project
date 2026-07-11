## ADDED Requirements

### Requirement: CMS authors the skills catalog

The CMS SHALL provide an admin screen listing every entry of the global skills catalog (`slug`, `name`, `description`), sourced from `GET /skills-catalog`. The screen SHALL provide an add affordance (revealing an editable blank row for `slug`/`name`/`description`), inline rename/edit of existing rows, and a per-row delete action with confirmation. All writes SHALL go through a single batched service method, `SkillsCatalogApiService.patchSchema(ops)`, issuing `PATCH /skills-catalog`; components SHALL NOT call `HttpClient` directly for these writes. The screen SHALL be reachable only by an authenticated admin, following the same admin-only route guarding already applied to the rest of the CMS.

#### Scenario: Skills catalog table loads
- **WHEN** an admin opens the skills catalog screen
- **THEN** it renders one row per catalog entry, sourced from a single `GET /skills-catalog` read

#### Scenario: Add a skill from the table
- **WHEN** an admin uses the add affordance, fills in slug/name/description, and saves
- **THEN** `SkillsCatalogApiService.patchSchema` is called with `[{ action: 'add', slug, entry: { name, description } }]` and, after success, the table re-reads and shows the new entry

#### Scenario: Rename a skill from the table
- **WHEN** an admin edits an existing row's slug and saves
- **THEN** `patchSchema` is called with a single `{ action: 'rename', slug, rename }` op (not a delete plus add)

#### Scenario: Delete a skill from the table
- **WHEN** an admin triggers the delete action on a row and confirms
- **THEN** `patchSchema` is called with `[{ action: 'delete', slug }]` and the row is removed from the table

### Requirement: CMS authors the conditions catalog

The CMS SHALL provide an admin screen listing every entry of the global conditions catalog (`slug`, `name`, `defaultSeverity`, `polarity`, `description`), sourced from `GET /conditions-catalog`. The screen SHALL provide the same add/rename/edit/delete affordances as the skills catalog screen, with `defaultSeverity` presented as a `minor`/`major` selector and `polarity` presented as a `positive`/`negative` selector, and SHALL route all writes through a single batched service method, `ConditionsCatalogApiService.patchSchema(ops)`, issuing `PATCH /conditions-catalog`. The screen SHALL be reachable only by an authenticated admin.

#### Scenario: Conditions catalog table loads
- **WHEN** an admin opens the conditions catalog screen
- **THEN** it renders one row per catalog entry, including each entry's `defaultSeverity` and `polarity`

#### Scenario: Add a condition preset from the table
- **WHEN** an admin uses the add affordance, fills in slug/name/defaultSeverity/polarity, and saves
- **THEN** `ConditionsCatalogApiService.patchSchema` is called with `[{ action: 'add', slug, entry: { name, defaultSeverity, polarity } }]`

#### Scenario: Change a condition preset's severity
- **WHEN** an admin changes an existing row's `defaultSeverity` selector and saves
- **THEN** `patchSchema` is called with `[{ action: 'update', slug, entry: { name, defaultSeverity, polarity } }]`

#### Scenario: Change a condition preset's polarity
- **WHEN** an admin changes an existing row's `polarity` selector and saves
- **THEN** `patchSchema` is called with `[{ action: 'update', slug, entry: { name, defaultSeverity, polarity } }]` reflecting the new `polarity`

#### Scenario: Delete a condition preset from the table
- **WHEN** an admin triggers the delete action on a row and confirms
- **THEN** `patchSchema` is called with `[{ action: 'delete', slug }]` and the row is removed from the table

### Requirement: Non-admin cannot reach the catalog screens

A non-admin (player) or unauthenticated visitor navigating to either catalog screen's route SHALL be redirected away, consistent with the CMS's existing admin-only route guard.

#### Scenario: Player redirected from the skills catalog screen
- **WHEN** a player-role session navigates to the skills catalog route
- **THEN** the CMS redirects away without rendering the catalog table

#### Scenario: Unauthenticated visitor redirected from the conditions catalog screen
- **WHEN** an unauthenticated visitor navigates to the conditions catalog route
- **THEN** the CMS redirects to its login screen
