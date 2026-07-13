## MODIFIED Requirements

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

### Requirement: Catalog tables are sortable, defaulting to name; conditions filter by polarity and severity

Every game-data catalog table in the CMS — skills, conditions, species, and equipment — SHALL be **column-sortable**: the admin can sort by any listed column, and on load each table SHALL default to **ascending order by `name`**. Sorting is performed client-side over the loaded catalog and issues no new request.

The conditions catalog screen SHALL additionally present two **multiselect** filters over the loaded list, each using the shared theme-aware filter-multiselect style (see `cms-backoffice-table-conventions`):
- a **polarity** multiselect over `positive | negative` (an empty selection means "all polarities");
- a **severity** multiselect over `minor | major` (an empty selection means "all severities").

Both filters combine with AND (with each other and with any existing text filter) and are applied client-side.

#### Scenario: Catalog table defaults to name ascending
- **WHEN** an admin opens any catalog screen (skills, conditions, species, or equipment)
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
