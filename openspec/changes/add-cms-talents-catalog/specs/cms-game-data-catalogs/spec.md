# cms-game-data-catalogs Specification (delta)

## ADDED Requirements

### Requirement: CMS authors the talents catalog

The CMS SHALL provide an admin screen listing every entry of the global talents catalog (`slug`, `name`, `description`), sourced from `GET /talents-catalog`. The screen SHALL provide an add affordance (revealing an editable blank row for `slug`/`name`/`description`), inline rename/edit of existing rows, and a per-row delete action with confirmation. All writes SHALL go through a single batched service method, `TalentsCatalogApiService.patchSchema(ops)`, issuing `PATCH /talents-catalog`; components SHALL NOT call `HttpClient` directly for these writes. The screen SHALL be reachable only by an authenticated admin, following the same admin-only route guarding already applied to the rest of the CMS.

The screen SHALL surface a duplicate-slug conflict (HTTP 409) as an inline error without discarding the user's unsaved edits. The talents catalog SHALL be reachable via a **Talenti** entry in the sidebar's admin-only Catalogo section.

#### Scenario: Talents catalog table loads
- **WHEN** an admin opens the talents catalog screen
- **THEN** it renders one row per catalog entry, sourced from a single `GET /talents-catalog` read

#### Scenario: Add a talent from the table
- **WHEN** an admin uses the add affordance, fills in slug/name/description, and saves
- **THEN** `TalentsCatalogApiService.patchSchema` is called with `[{ action: 'add', slug, entry: { name, description } }]` and, after success, the table re-reads and shows the new entry

#### Scenario: Rename a talent from the table
- **WHEN** an admin edits an existing row's slug and saves
- **THEN** `patchSchema` is called with a single `{ action: 'rename', slug, rename }` op (not a delete plus add)

#### Scenario: Edit a talent's name or description from the table
- **WHEN** an admin edits an existing row's name or description (leaving the slug unchanged) and saves
- **THEN** `patchSchema` is called with `[{ action: 'update', slug, entry: { name, description } }]`

#### Scenario: Delete a talent from the table
- **WHEN** an admin triggers the delete action on a row and confirms
- **THEN** `patchSchema` is called with `[{ action: 'delete', slug }]` and the row is removed from the table

#### Scenario: Duplicate slug surfaces inline
- **WHEN** an admin adds a talent whose slug already exists and the API responds HTTP 409
- **THEN** the CMS shows an inline duplicate-slug error and the unsaved edits are retained

## MODIFIED Requirements

### Requirement: Non-admin cannot reach the catalog screens

The CMS SHALL restrict every game-data catalog screen — skills, conditions, species, equipment, tags, and talents — to admin users. A non-admin who navigates to any catalog route SHALL be redirected away (or shown an access-denied view) and SHALL NOT be able to issue catalog `PATCH` requests from the UI.

The sidebar **Catalogo** navigation section SHALL be rendered only for admin users. A non-admin session SHALL NOT see the Catalogo section or any of its links, so it never presents a link whose route the user cannot follow. This nav-visibility rule is layered on top of the route guard, which remains in force as the security boundary.

#### Scenario: Non-admin redirected from the skills catalog screen
- **WHEN** a non-admin user navigates to the skills catalog route
- **THEN** they are redirected away or shown an access-denied view

#### Scenario: Non-admin redirected from the conditions catalog screen
- **WHEN** a non-admin user navigates to the conditions catalog route
- **THEN** they are redirected away or shown an access-denied view

#### Scenario: Non-admin redirected from the species catalog screen
- **WHEN** a non-admin user navigates to the species catalog route
- **THEN** they are redirected away or shown an access-denied view

#### Scenario: Non-admin redirected from the equipment catalog screen
- **WHEN** a non-admin user navigates to the equipment catalog route
- **THEN** they are redirected away or shown an access-denied view

#### Scenario: Non-admin redirected from the tag catalog screen
- **WHEN** a non-admin user navigates to the tag catalog route
- **THEN** they are redirected away or shown an access-denied view

#### Scenario: Non-admin redirected from the talents catalog screen
- **WHEN** a non-admin user navigates to the talents catalog route
- **THEN** they are redirected away or shown an access-denied view

#### Scenario: Catalogo nav section hidden for non-admins
- **WHEN** a non-admin session renders the CMS shell
- **THEN** the sidebar does NOT contain the Catalogo section or any catalog links (including the Talenti link)

#### Scenario: Catalogo nav section shown for admins
- **WHEN** an admin session renders the CMS shell
- **THEN** the sidebar contains the Catalogo section with the skills, conditions, species, equipment, tag, and talents links

### Requirement: Catalog tables are sortable, defaulting to name; conditions filter by polarity and severity

Every game-data catalog table in the CMS — skills, conditions, species, equipment, and talents — SHALL be **column-sortable**: the admin can sort by any listed column, and on load each table SHALL default to **ascending order by `name`**. Sorting is performed client-side over the loaded catalog and issues no new request.

The conditions catalog screen SHALL additionally present two **multiselect** filters over the loaded list, each using the shared theme-aware filter-multiselect style (see `cms-backoffice-table-conventions`):
- a **polarity** multiselect over `positive | negative` (an empty selection means "all polarities");
- a **severity** multiselect over `minor | major` (an empty selection means "all severities").

Both filters combine with AND (with each other and with any existing text filter) and are applied client-side.

#### Scenario: Catalog table defaults to name ascending
- **WHEN** an admin opens any catalog screen (skills, conditions, species, equipment, or talents)
- **THEN** the table is sorted ascending by `name` on first render

#### Scenario: Admin sorts by another column
- **WHEN** an admin activates a sortable column header (e.g. `slug` or `kind`)
- **THEN** the table re-sorts by that column, toggling ascending/descending on repeated activation, without issuing a new request

#### Scenario: Conditions filter by polarity (multiselect)
- **GIVEN** the conditions catalog holds both positive and negative entries
- **WHEN** an admin selects `negative` in the polarity multiselect
- **THEN** the table shows only negative-polarity conditions; clearing the selection restores every entry

#### Scenario: Conditions filter by severity (multiselect)
- **WHEN** an admin selects `major` in the severity multiselect
- **THEN** the table shows only `major` conditions; clearing the selection restores every entry

#### Scenario: Polarity and severity filters combine
- **WHEN** an admin selects `negative` in polarity and `minor` in severity
- **THEN** the table shows only conditions that are both negative and minor

#### Scenario: Selecting multiple values in one filter widens that filter
- **WHEN** an admin selects both `minor` and `major` in the severity multiselect
- **THEN** the table shows conditions of either severity (the selection within a single filter combines with OR)
