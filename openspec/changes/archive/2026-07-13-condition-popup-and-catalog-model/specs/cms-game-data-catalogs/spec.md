## MODIFIED Requirements

### Requirement: CMS authors the equipment catalog

The CMS SHALL provide an admin-only screen for authoring the global equipment catalog (`api-equipment-catalog`), listing every template's `slug`, `name`, `kind`, `isStarter` flag, and — for `weapon` and `armor` kinds — its `core`/`extra` tags, and supporting add / update / rename / delete. Changes SHALL be submitted as a single batched `PATCH /equipment-catalog { ops }` request.

The CMS is the **only** place equipment templates may be authored; `apps/pip-boy` reads them but never writes them.

The screen SHALL make `isStarter` directly togglable per entry, since that flag alone determines which templates `pipboy-character-creation` offers during character creation. The tag editor SHALL only be presented for `weapon` and `armor` kinds; a **`description`** field SHALL be presented for `consumable` and `misc` — in place of any quantity field — matching the API's validation. The screen SHALL NOT present a `defaultQuantity` field for any kind (quantity is a per-character inventory concern, not a catalog concern).

The `kind` selector SHALL offer four kinds — `weapon`, `armor`, `consumable`, and `misc` — with `misc` labelled **"Vari"** in the UI. Because `misc` templates are never starters (`api-equipment-catalog`), the screen SHALL NOT present the `isStarter` toggle for a `misc` entry.

The screen SHALL present a filter bar above the list with:
- a **name** free-text filter and a **slug** free-text filter, each a case-insensitive substring match that narrows the list as the admin types;
- an **isStarter** checkbox filter that, when checked, restricts the list to starter entries;
- a **kind** multi-select over `weapon | armor | consumable | misc`; an empty selection means "all kinds".

All active filters combine with AND. Filtering is performed client-side over the loaded catalog and does not issue a new request.

#### Scenario: Admin adds a starter weapon template with tags
- **WHEN** an admin adds an entry with `kind: weapon`, `isStarter: true`, and two tags — one `core`, one `extra` — and saves
- **THEN** the CMS issues one `PATCH /equipment-catalog` with an `add` op carrying `kind`, `isStarter`, and both tags with their `type` values

#### Scenario: Admin adds a misc (Vari) template with a description
- **WHEN** an admin selects `kind` "Vari", enters a name and an optional description, and saves
- **THEN** the CMS issues an `add` op with `kind: misc` and the `description`, carrying no `defaultQuantity`, and no `isStarter` toggle was shown for the entry

#### Scenario: Admin promotes an existing item to a starter
- **WHEN** an admin toggles `isStarter` on for an existing template and saves
- **THEN** the CMS issues an `update` op carrying `isStarter: true`, and the entry becomes available in the pip-boy creation wizard's starter picker

#### Scenario: Tag editor hidden for consumables, description shown instead
- **WHEN** an admin sets an entry's `kind` to `consumable`
- **THEN** the tag editor is not presented, and a `description` field is presented instead (no quantity field)

#### Scenario: Starter toggle hidden for misc
- **WHEN** an admin sets an entry's `kind` to `misc`
- **THEN** no `isStarter` toggle is presented for that entry

#### Scenario: Name and slug filters narrow the list while typing
- **GIVEN** the catalog lists many entries
- **WHEN** an admin types into the name filter (or the slug filter)
- **THEN** the list narrows to entries whose name (or slug) contains the typed text, case-insensitively, updating on each keystroke

#### Scenario: Kind multi-select filters by kind
- **WHEN** an admin selects `weapon` and `misc` in the kind multi-select
- **THEN** the list shows only `weapon` and `misc` entries; clearing the selection restores all kinds

#### Scenario: Starter checkbox filters to starters
- **WHEN** an admin checks the isStarter filter
- **THEN** the list shows only entries with `isStarter: true`

#### Scenario: Duplicate slug surfaces inline
- **WHEN** an admin adds a template whose slug already exists and the API responds HTTP 409
- **THEN** the CMS shows an inline error naming the conflicting slug and retains the pending edits

#### Scenario: Deleting a template does not warn about character copies
- **WHEN** an admin deletes an equipment template
- **THEN** the CMS deletes it without any in-use warning, because characters hold independent copies rather than references

## ADDED Requirements

### Requirement: Catalog tables are sortable, defaulting to name; conditions filter by polarity and severity

Every game-data catalog table in the CMS — skills, conditions, species, and equipment — SHALL be **column-sortable**: the admin can sort by any listed column, and on load each table SHALL default to **ascending order by `name`**. Sorting is performed client-side over the loaded catalog and issues no new request.

The conditions catalog screen SHALL additionally present two filters over the loaded list:
- a **polarity** filter offering **positive / negative / all** (default all);
- a **severity** filter offering **minor / major / all** (default all).

Both filters combine with AND (with each other and with any existing text filter) and are applied client-side.

#### Scenario: Catalog table defaults to name ascending
- **WHEN** an admin opens any catalog screen (skills, conditions, species, or equipment)
- **THEN** the table is sorted ascending by `name` on first render

#### Scenario: Admin sorts by another column
- **WHEN** an admin activates a sortable column header (e.g. `slug` or `kind`)
- **THEN** the table re-sorts by that column, toggling ascending/descending on repeated activation, without issuing a new request

#### Scenario: Conditions filter by polarity
- **GIVEN** the conditions catalog holds both positive and negative entries
- **WHEN** an admin sets the polarity filter to `negative`
- **THEN** the table shows only negative-polarity conditions; setting it back to `all` restores every entry

#### Scenario: Conditions filter by severity
- **WHEN** an admin sets the severity filter to `major`
- **THEN** the table shows only `major` conditions; `all` restores every entry

#### Scenario: Polarity and severity filters combine
- **WHEN** an admin sets polarity to `negative` and severity to `minor`
- **THEN** the table shows only conditions that are both negative and minor
