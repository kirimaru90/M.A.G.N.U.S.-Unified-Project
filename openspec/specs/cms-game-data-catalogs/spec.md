# cms-game-data-catalogs Specification

## Purpose

CMS admin screens and API-client services for authoring the global skills, conditions, species, equipment, and tag catalogs via single batched `PATCH` calls, admin-only route guarding consistent with the rest of the CMS.
## Requirements
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

### Requirement: CMS authors the species catalog

The CMS SHALL provide an admin-only screen for authoring the global species catalog (`api-species-catalog`), listing every entry's `slug`, `name`, `permesso`, `svantaggio`, `tagSkillBudget`, and `margin`, and supporting add / update / rename / delete. Changes SHALL be submitted as a single batched `PATCH /species-catalog { ops }` request, consistent with the existing skills- and conditions-catalog screens.

The `margin` field SHALL be edited as a positive integer (the character's starting health margin). The screen SHALL surface a duplicate-slug conflict (HTTP 409) and an in-use-species conflict (HTTP 409 on delete/rename) as inline errors, without discarding the user's unsaved edits.

#### Scenario: Admin edits a species' drawback copy
- **WHEN** an admin changes the `svantaggio` copy for slug `ghoul` and saves
- **THEN** the CMS issues one `PATCH /species-catalog` with an `update` op for slug `ghoul` and the list reflects the new copy

#### Scenario: Admin edits a species' tag-skill budget
- **WHEN** an admin changes `tagSkillBudget` for `human` from `4` to `5` and saves
- **THEN** the CMS issues an `update` op carrying `tagSkillBudget: 5`

#### Scenario: Admin edits a species' margin
- **WHEN** an admin changes `margin` for `human` from `4` to `6` and saves
- **THEN** the CMS issues an `update` op carrying `margin: 6` and the list reflects the new value

#### Scenario: Duplicate slug surfaces inline
- **WHEN** an admin adds a species whose slug already exists and the API responds HTTP 409
- **THEN** the CMS shows an inline duplicate-slug error and the unsaved edits are retained

#### Scenario: Deleting an in-use species surfaces inline
- **WHEN** an admin deletes a species still referenced by a character and the API responds HTTP 409
- **THEN** the CMS shows an inline error explaining the species is in use and the entry remains listed

### Requirement: CMS authors the equipment catalog

The CMS SHALL provide an admin-only screen for authoring the global equipment catalog (`api-equipment-catalog`), listing every template's `slug`, `name`, `kind`, `isStarter` flag, and — for `weapon` and `armor` kinds — its `core`/`extra` tags, and supporting add / update / rename / delete. Changes SHALL be submitted as a single batched `PATCH /equipment-catalog { ops }` request.

The CMS is the **only** place equipment templates may be authored; `apps/pip-boy` reads them but never writes them.

The `isStarter` flag alone determines which templates `pipboy-character-creation` offers during character creation. The screen SHALL present `isStarter` as a **read-only indicator** while a row is not being edited, and SHALL make it editable (a checkbox) **only within that row's edit mode**; it SHALL NOT be togglable directly from the display row. The tag editor SHALL only be presented for `weapon` and `armor` kinds; a **`description`** field SHALL be presented for `consumable` and `misc` — in place of any quantity field — matching the API's validation. The screen SHALL NOT present a `defaultQuantity` field for any kind (quantity is a per-character inventory concern, not a catalog concern).

The `kind` selector SHALL offer four kinds — `weapon`, `armor`, `consumable`, and `misc` — with `misc` labelled **"Vari"** in the UI. Because `misc` templates are never starters (`api-equipment-catalog`), the screen SHALL NOT present the `isStarter` editor for a `misc` entry.

The screen SHALL present a filter bar above the list with:
- a **name** free-text filter, a case-insensitive substring match that narrows the list as the admin types;
- an **isStarter** checkbox filter that, when checked, restricts the list to starter entries;
- a **kind** multiselect **dropdown** over `weapon | armor | consumable | misc` (an empty selection means "all kinds"), using the shared theme-aware filter-multiselect style (see `cms-backoffice-table-conventions`) so its control and overlay match the active light/dark theme;
- a **tag** searchable multiselect (a multiselect dropdown with a type-to-search box) whose options are the **distinct tag names present in the loaded catalog** (derived from the entries, not fetched from the tag catalog). An empty selection means "all tags"; when tags are selected an entry matches if it carries **any** of them (OR within the tag filter). It SHALL use the same shared theme-aware filter-multiselect style. Because only `weapon`/`armor` entries carry tags, selecting any tag naturally excludes `consumable`/`misc` entries.

The filter bar SHALL NOT include a slug filter. All active filters combine with AND (the tag filter's OR applies only within the tag selection). Filtering is performed client-side over the loaded catalog and does not issue a new request.

#### Scenario: Admin adds a starter weapon template with tags
- **WHEN** an admin adds an entry with `kind: weapon`, `isStarter: true`, and two tags — one `core`, one `extra` — and saves
- **THEN** the CMS issues one `PATCH /equipment-catalog` with an `add` op carrying `kind`, `isStarter`, and both tags with their `type` values

#### Scenario: Admin adds a misc (Vari) template with a description
- **WHEN** an admin selects `kind` "Vari", enters a name and an optional description, and saves
- **THEN** the CMS issues an `add` op with `kind: misc` and the `description`, carrying no `defaultQuantity`, and no `isStarter` editor was shown for the entry

#### Scenario: Starter indicator is read-only outside row edit
- **WHEN** the admin views the catalog list without editing any row
- **THEN** each entry's `isStarter` is shown as a read-only indicator that cannot be toggled from the display row

#### Scenario: Admin promotes an existing item to a starter within row edit
- **WHEN** an admin opens a row for editing, enables its `isStarter` checkbox, and saves the row
- **THEN** the CMS issues an `update` op carrying `isStarter: true`, and the entry becomes available in the pip-boy creation wizard's starter picker

#### Scenario: Tag editor hidden for consumables, description shown instead
- **WHEN** an admin sets an entry's `kind` to `consumable`
- **THEN** the tag editor is not presented, and a `description` field is presented instead (no quantity field)

#### Scenario: Starter editor hidden for misc
- **WHEN** an admin sets an entry's `kind` to `misc`
- **THEN** no `isStarter` editor is presented for that entry

#### Scenario: Name filter narrows the list while typing
- **GIVEN** the catalog lists many entries
- **WHEN** an admin types into the name filter
- **THEN** the list narrows to entries whose name contains the typed text, case-insensitively, updating on each keystroke

#### Scenario: No slug filter is present
- **WHEN** the admin inspects the equipment filter bar
- **THEN** there is no slug free-text filter control

#### Scenario: Kind multiselect filters by kind
- **WHEN** an admin selects `weapon` and `misc` in the kind multiselect dropdown
- **THEN** the list shows only `weapon` and `misc` entries; clearing the selection restores all kinds

#### Scenario: Tag options are the distinct tags present in the catalog
- **WHEN** an admin opens the tag filter
- **THEN** its options are the distinct tag names carried by the loaded entries (deduplicated across weapon/armor entries), searchable by typing

#### Scenario: Tag multiselect filters by tag (OR within the selection)
- **GIVEN** the catalog holds a weapon tagged `AFFIDABILE` and another tagged `PROIETTILI`
- **WHEN** an admin selects both `AFFIDABILE` and `PROIETTILI` in the tag filter
- **THEN** the list shows every entry carrying either tag; clearing the selection restores all entries

#### Scenario: Tag filter combines with the other filters via AND
- **WHEN** an admin selects `weapon` in the kind filter and `AFFIDABILE` in the tag filter
- **THEN** the list shows only weapon entries that also carry the `AFFIDABILE` tag

#### Scenario: Starter checkbox filters to starters
- **WHEN** an admin checks the isStarter filter
- **THEN** the list shows only entries with `isStarter: true`

#### Scenario: Duplicate slug surfaces inline
- **WHEN** an admin adds a template whose slug already exists and the API responds HTTP 409
- **THEN** the CMS shows an inline error naming the conflicting slug and retains the pending edits

#### Scenario: Deleting a template does not warn about character copies
- **WHEN** an admin deletes an equipment template
- **THEN** the CMS deletes it without any in-use warning, because characters hold independent copies rather than references

### Requirement: CMS authors the tag catalog

The CMS SHALL provide an admin-only screen for authoring the global tag catalog (`api-tag-catalog`), listing every entry's `slug` and `name`, and supporting add / update / rename / delete. Changes SHALL be submitted as a single batched `PATCH /tag-catalog { ops }` request.

The CMS is the **only** place tag entries may be authored; `apps/pip-boy` reads them but never writes them. The screen SHALL present the tag catalog with a **Tag** entry in the sidebar's admin-only Catalogo section.

#### Scenario: Admin adds a tag entry
- **WHEN** an admin enters a name (and slug) and saves
- **THEN** the CMS issues one `PATCH /tag-catalog` with an `add` op carrying the entry's `name`

#### Scenario: Admin renames a tag entry
- **WHEN** an admin changes an entry's slug and saves
- **THEN** the CMS issues a `rename` op preserving the entry's `name`

#### Scenario: Duplicate slug surfaces inline
- **WHEN** an admin adds an entry whose slug already exists and the API responds HTTP 409
- **THEN** the CMS shows an inline error naming the conflicting slug and retains the pending edits

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

### Requirement: CMS authors a talent's SPECIAL requirement

The talents catalog screen SHALL provide a per-row **Requisiti** action that opens a dialog for editing that talent's `specialRequirement`. The dialog SHALL present seven letter-labelled stepper controls, one per S·P·E·C·I·A·L stat (`S P E C I A L`, i.e. `strength, perception, endurance, charisma, intelligence, agility, luck` in that order), each bounded `0`–`5`, visually consistent with the pip-boy's own SPECIAL editor. Saving the dialog SHALL issue a single `update` op via `TalentsCatalogApiService.patchSchema` carrying the full 7-element `specialRequirement` array; setting every stepper to `0` SHALL be equivalent to the talent having no requirement. The main talents table row itself SHALL NOT gain seven inline numeric columns — the requirement is edited only through this dialog.

#### Scenario: Admin sets a talent's SPECIAL requirement
- **WHEN** an admin opens the Requisiti dialog for a talent, sets Endurance to `3` (leaving the rest at `0`), and saves
- **THEN** the CMS issues `patchSchema([{ action: 'update', slug, entry: { name, description, specialRequirement: [0, 0, 3, 0, 0, 0, 0] } }])`

#### Scenario: Admin clears a talent's SPECIAL requirement
- **GIVEN** a talent currently has `specialRequirement: [0, 0, 3, 0, 0, 0, 0]`
- **WHEN** an admin opens its Requisiti dialog, resets every stepper to `0`, and saves
- **THEN** the CMS issues an `update` op carrying `specialRequirement: [0, 0, 0, 0, 0, 0, 0]`, treated by the app as no requirement

#### Scenario: Requirement dialog does not widen the table
- **WHEN** an admin views the talents catalog table without opening the Requisiti dialog
- **THEN** each row shows only slug, name, description, and actions (including the Requisiti trigger) — no per-stat numeric columns are present

### Requirement: CMS imports and exports the talents catalog

The talents catalog screen SHALL provide an **Esporta** action and an **Importa** action, both operating entirely client-side against `GET`/`PATCH /talents-catalog` — no dedicated import/export API endpoint is introduced.

**Esporta** SHALL serialize the currently loaded catalog (the same entries shown in the table) as a JSON array of `{ slug, name, description?, specialRequirement? }` and trigger a browser download of a `.json` file. It SHALL require no additional confirmation and SHALL NOT issue any new network request.

**Importa** SHALL open a dialog accepting a JSON array of the same shape, either pasted as text or selected as a `.json` file upload. The screen SHALL validate the parsed input's shape (each entry has a non-empty `slug` and `name`; `specialRequirement`, when present, is an array of exactly 7 integers `0`–`5`) before proceeding, and SHALL surface a validation error without attempting a write when the input is not valid JSON or fails shape validation.

Import SHALL be **additive-only**:
- an entry whose `slug` is not present in the currently loaded catalog SHALL become one `add` op;
- an entry whose `slug` is already present in the currently loaded catalog SHALL be skipped, not applied as an `update`;
- an entry whose `slug` repeats a `slug` already accepted earlier in the same imported file SHALL be skipped (only the first occurrence in the file is considered);
- no import SHALL ever produce an `update`, `rename`, or `delete` op.

All resulting `add` ops SHALL be submitted in a single `PATCH /talents-catalog` call via `TalentsCatalogApiService.patchSchema`. After the call completes, the dialog SHALL report a summary distinguishing how many entries were added from how many were skipped, and SHALL name the skipped slugs.

#### Scenario: Export downloads the loaded catalog as JSON
- **WHEN** an admin activates Esporta on a talents catalog holding 3 entries
- **THEN** the browser downloads a `.json` file containing a JSON array of those 3 entries' `slug`, `name`, `description` (if any), and `specialRequirement` (if any), with no new network request issued

#### Scenario: Import adds only genuinely new slugs
- **GIVEN** the loaded catalog contains slug `"gun-fu"` and no other entries
- **WHEN** an admin imports a file containing `"gun-fu"` and `"iron-fist"`
- **THEN** the CMS issues one `PATCH /talents-catalog` with a single `add` op for `"iron-fist"`, and the summary reports 1 added and 1 skipped (`"gun-fu"`, already in catalog)

#### Scenario: Import skips a slug duplicated within the file
- **GIVEN** the loaded catalog is empty
- **WHEN** an admin imports a file containing two entries that both have `slug == "iron-fist"`
- **THEN** the CMS issues one `add` op for `"iron-fist"` using the first occurrence's data, and the summary reports 1 added and 1 skipped (duplicate within file)

#### Scenario: Import never updates or deletes existing entries
- **GIVEN** the loaded catalog contains slug `"gun-fu"` with `name: "Gun Fu"`
- **WHEN** an admin imports a file containing `slug: "gun-fu"` with a different `name`
- **THEN** the stored `"gun-fu"` entry's `name` is unchanged after the import

#### Scenario: Invalid JSON is rejected before any write
- **WHEN** an admin pastes text into the Importa dialog that is not valid JSON
- **THEN** the dialog shows a validation error and issues no `PATCH` request

#### Scenario: Malformed entry shape is rejected before any write
- **WHEN** an admin imports a JSON array containing an entry with no `name`, or with a `specialRequirement` of the wrong length
- **THEN** the dialog shows a validation error identifying the problem and issues no `PATCH` request

