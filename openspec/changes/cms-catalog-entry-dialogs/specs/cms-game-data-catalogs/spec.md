## ADDED Requirements

### Requirement: Catalog entries are created and edited through a dialog

Every game-data catalog screen (skills, conditions, species, equipment, tag, talents) SHALL create and edit entries through a modal **entry dialog**, and SHALL NOT present editable inline rows in the table, for either adding or editing. The screen header SHALL always offer a `+ Aggiungi` action that opens the dialog empty, in create mode. Each row SHALL offer an edit action that opens the dialog pre-filled with that entry, in edit mode. The table rows themselves SHALL remain read-only.

The dialog SHALL submit its write through the catalog's batched `patchSchema(ops)` service method:
- in create mode, a single `add` op;
- in edit mode with the slug unchanged, a single `update` op carrying the full edited entry;
- in edit mode with the slug changed (on catalogs whose slug is editable), a single `PATCH` carrying `[{ action: 'rename', slug: <old>, rename: <new> }, { action: 'update', slug: <new>, entry }]`, in that order, so that field changes made in the same edit are not lost.

On success the dialog SHALL close and the screen SHALL re-read the catalog. On failure the dialog SHALL stay open, SHALL keep every value the admin entered, and SHALL show the error inside the dialog:
- a duplicate-slug HTTP 409 SHALL name the conflicting slug (`Slug "<slug>" già esistente`);
- an HTTP 400 SHALL show `Dati non validi`;
- any other failure SHALL show `Errore imprevisto`.

Cancelling the dialog SHALL issue no request and SHALL discard the dialog's values.

The dialog's footer (an `Annulla` action and a primary submit action that is disabled and relabelled while saving) and its error block SHALL be the CMS's shared dialog-actions component, the same one used by the users, campaigns and terminals dialogs.

#### Scenario: Add opens an empty dialog
- **WHEN** an admin activates `+ Aggiungi` on any catalog screen
- **THEN** an entry dialog opens with empty fields (and catalog defaults where they exist), and no editable row appears in the table

#### Scenario: Edit opens a pre-filled dialog
- **WHEN** an admin activates the edit action on a row
- **THEN** an entry dialog opens pre-filled with that entry's values, and the row itself stays read-only

#### Scenario: Changing slug and name in one edit keeps both
- **GIVEN** a skills entry `{ slug: "lockpick", name: "Scasso" }`
- **WHEN** an admin edits it in the dialog, changes the slug to `lockpicking` and the name to `Scassinare`, and saves
- **THEN** `patchSchema` is called once with `[{ action: 'rename', slug: 'lockpick', rename: 'lockpicking' }, { action: 'update', slug: 'lockpicking', entry: { name: 'Scassinare', … } }]`, and after the reload the entry shows both the new slug and the new name

#### Scenario: Conflict keeps the dialog open with edits retained
- **WHEN** an admin saves a dialog and the API responds HTTP 409 for slug `automatica`
- **THEN** the dialog stays open, shows `Slug "automatica" già esistente`, and every field still holds the value the admin entered

#### Scenario: Cancel issues no request
- **WHEN** an admin opens an entry dialog, changes fields, and activates `Annulla`
- **THEN** the dialog closes and no `PATCH` request is issued

## MODIFIED Requirements

### Requirement: CMS authors the skills catalog

The CMS SHALL provide an admin screen listing every entry of the global skills catalog (`slug`, `name`, `description`), sourced from `GET /skills-catalog`. The screen SHALL provide an add action and a per-row edit action, both opening the skills entry dialog (per `Catalog entries are created and edited through a dialog`) for `slug`/`name`/`description`, and a per-row delete action with confirmation. All writes SHALL go through a single batched service method, `SkillsCatalogApiService.patchSchema(ops)`, issuing `PATCH /skills-catalog`; components SHALL NOT call `HttpClient` directly for these writes. The screen SHALL be reachable only by an authenticated admin, following the same admin-only route guarding already applied to the rest of the CMS.

#### Scenario: Skills catalog table loads
- **WHEN** an admin opens the skills catalog screen
- **THEN** it renders one row per catalog entry, sourced from a single `GET /skills-catalog` read

#### Scenario: Add a skill from the dialog
- **WHEN** an admin uses the add action, fills in slug/name/description in the dialog, and saves
- **THEN** `SkillsCatalogApiService.patchSchema` is called with `[{ action: 'add', slug, entry: { name, description } }]` and, after success, the table re-reads and shows the new entry

#### Scenario: Rename a skill from the dialog
- **WHEN** an admin edits an entry's slug in the dialog and saves
- **THEN** `patchSchema` is called with a `{ action: 'rename', slug, rename }` op followed by an `update` op for the new slug (not a delete plus add)

#### Scenario: Delete a skill from the table
- **WHEN** an admin triggers the delete action on a row and confirms
- **THEN** `patchSchema` is called with `[{ action: 'delete', slug }]` and the row is removed from the table

### Requirement: CMS authors the conditions catalog

The CMS SHALL provide an admin screen listing every entry of the global conditions catalog (`slug`, `name`, `defaultSeverity`, `polarity`, `description`), sourced from `GET /conditions-catalog`. The screen SHALL provide the same add/rename/edit/delete affordances as the skills catalog screen, through a conditions entry dialog, with `defaultSeverity` presented as a `minor`/`major` selector and `polarity` presented as a `positive`/`negative` selector, and SHALL route all writes through a single batched service method, `ConditionsCatalogApiService.patchSchema(ops)`, issuing `PATCH /conditions-catalog`. The screen SHALL be reachable only by an authenticated admin.

#### Scenario: Conditions catalog table loads
- **WHEN** an admin opens the conditions catalog screen
- **THEN** it renders one row per catalog entry, including each entry's `defaultSeverity` and `polarity`

#### Scenario: Add a condition preset from the dialog
- **WHEN** an admin uses the add action, fills in slug/name/defaultSeverity/polarity in the dialog, and saves
- **THEN** `ConditionsCatalogApiService.patchSchema` is called with `[{ action: 'add', slug, entry: { name, defaultSeverity, polarity } }]`

#### Scenario: Change a condition preset's severity
- **WHEN** an admin changes an entry's `defaultSeverity` selector in the dialog and saves
- **THEN** `patchSchema` is called with `[{ action: 'update', slug, entry: { name, defaultSeverity, polarity } }]`

#### Scenario: Change a condition preset's polarity
- **WHEN** an admin changes an entry's `polarity` selector in the dialog and saves
- **THEN** `patchSchema` is called with `[{ action: 'update', slug, entry: { name, defaultSeverity, polarity } }]` reflecting the new `polarity`

#### Scenario: Delete a condition preset from the table
- **WHEN** an admin triggers the delete action on a row and confirms
- **THEN** `patchSchema` is called with `[{ action: 'delete', slug }]` and the row is removed from the table

### Requirement: CMS authors the species catalog

The CMS SHALL provide an admin-only screen for authoring the global species catalog (`api-species-catalog`), listing every entry's `slug`, `name`, `permesso`, `svantaggio`, `tagSkillBudget`, and `margin`, and supporting add / update / delete through a species entry dialog. Changes SHALL be submitted as a single batched `PATCH /species-catalog { ops }` request, consistent with the other catalog screens.

The species `slug` SHALL be editable only when creating an entry. In edit mode the dialog SHALL show the slug read-only, and a species edit SHALL always submit a plain `update` op, never a `rename`. The CMS SHALL NOT offer a species rename.

The `margin` field SHALL be edited as a positive integer (the character's starting health margin). The screen SHALL surface a duplicate-slug conflict (HTTP 409 on add) inside the dialog without discarding the admin's unsaved edits. It SHALL surface an in-use-species conflict (HTTP 409 on delete) as an error explaining the species is in use by a character (`Specie in uso da un personaggio`).

#### Scenario: Admin edits a species' drawback copy
- **WHEN** an admin changes the `svantaggio` copy for slug `ghoul` in the dialog and saves
- **THEN** the CMS issues one `PATCH /species-catalog` with an `update` op for slug `ghoul` and the list reflects the new copy

#### Scenario: Admin edits a species' tag-skill budget
- **WHEN** an admin changes `tagSkillBudget` for `human` from `4` to `5` and saves
- **THEN** the CMS issues an `update` op carrying `tagSkillBudget: 5`

#### Scenario: Admin edits a species' margin
- **WHEN** an admin changes `margin` for `human` from `4` to `6` and saves
- **THEN** the CMS issues an `update` op carrying `margin: 6` and the list reflects the new value

#### Scenario: Species slug is read-only when editing
- **WHEN** an admin opens the edit dialog for species `ghoul`
- **THEN** the slug `ghoul` is shown but cannot be changed, and saving issues only an `update` op for `ghoul`, never a `rename`

#### Scenario: Admin renames a species' display name
- **WHEN** an admin changes the `name` of species `ghoul` from `Ghoul` to `Ghoul ferale` and saves
- **THEN** the CMS issues an `update` op for slug `ghoul` carrying `name: "Ghoul ferale"`, and the slug is unchanged

#### Scenario: Duplicate slug surfaces in the dialog
- **WHEN** an admin adds a species whose slug already exists and the API responds HTTP 409
- **THEN** the dialog shows an error naming the conflicting slug and the unsaved edits are retained

#### Scenario: Deleting an in-use species surfaces an error
- **WHEN** an admin deletes a species still referenced by a character and the API responds HTTP 409
- **THEN** the CMS shows an error explaining the species is in use and the entry remains listed

### Requirement: CMS authors the equipment catalog

The CMS SHALL provide an admin-only screen for authoring the global equipment catalog (`api-equipment-catalog`), listing every template's `slug`, `name`, `kind`, `isStarter` flag, and — for `weapon` and `armor` kinds — its `core`/`extra` tags, and supporting add / update / rename / delete through an equipment entry dialog. Changes SHALL be submitted as a single batched `PATCH /equipment-catalog { ops }` request.

The CMS is the **only** place equipment templates may be authored; `apps/pip-boy` reads them but never writes them.

The `isStarter` flag alone determines which templates `pipboy-character-creation` offers during character creation. The list SHALL present `isStarter` as a **read-only indicator** and SHALL NOT let it be toggled from the list row. `isStarter` SHALL be editable (a checkbox) **only within the entry dialog**. Within the dialog:
- the tag editor SHALL only be presented for `weapon` and `armor` kinds;
- a **`description`** field SHALL be presented for `consumable` and `misc`, in place of any quantity field, matching the API's validation;
- switching `kind` SHALL switch between these fields;
- no `defaultQuantity` field SHALL be presented for any kind (quantity is a per-character inventory concern, not a catalog concern).

The `kind` selector SHALL offer four kinds — `weapon`, `armor`, `consumable`, and `misc` — with `misc` labelled **"Vari"** in the UI. Because `misc` templates are never starters (`api-equipment-catalog`), the dialog SHALL NOT present the `isStarter` editor for a `misc` entry.

The screen SHALL present a filter bar above the list with:
- a **name** free-text filter, a case-insensitive substring match that narrows the list as the admin types;
- an **isStarter** checkbox filter that, when checked, restricts the list to starter entries;
- a **kind** multiselect **dropdown** over `weapon | armor | consumable | misc` (an empty selection means "all kinds"), using the shared theme-aware filter-multiselect style (see `cms-backoffice-table-conventions`) so its control and overlay match the active light/dark theme;
- a **tag** searchable multiselect (a multiselect dropdown with a type-to-search box) whose options are the **distinct tag names present in the loaded catalog** (derived from the entries, not fetched from the tag catalog). An empty selection means "all tags"; when tags are selected an entry matches if it carries **any** of them (OR within the tag filter). It SHALL use the same shared theme-aware filter-multiselect style. Because only `weapon`/`armor` entries carry tags, selecting any tag naturally excludes `consumable`/`misc` entries.

The filter bar SHALL NOT include a slug filter. All active filters combine with AND (the tag filter's OR applies only within the tag selection). Filtering is performed client-side over the loaded catalog and does not issue a new request.

#### Scenario: Admin adds a starter weapon template with tags
- **WHEN** an admin adds an entry in the dialog with `kind: weapon`, `isStarter: true`, and two tags — one `core`, one `extra` — and saves
- **THEN** the CMS issues one `PATCH /equipment-catalog` with an `add` op carrying `kind`, `isStarter`, and both tags with their `type` values

#### Scenario: Admin adds a misc (Vari) template with a description
- **WHEN** an admin selects `kind` "Vari" in the dialog, enters a name and an optional description, and saves
- **THEN** the CMS issues an `add` op with `kind: misc` and the `description`, carrying no `defaultQuantity`, and no `isStarter` editor was shown for the entry

#### Scenario: Starter indicator is read-only in the list
- **WHEN** the admin views the catalog list
- **THEN** each entry's `isStarter` is shown as a read-only indicator that cannot be toggled from the list row

#### Scenario: Admin promotes an existing item to a starter in the dialog
- **WHEN** an admin opens an entry's edit dialog, enables its `isStarter` checkbox, and saves
- **THEN** the CMS issues an `update` op carrying `isStarter: true`, and the entry becomes available in the pip-boy creation wizard's starter picker

#### Scenario: Tag editor hidden for consumables, description shown instead
- **WHEN** an admin sets an entry's `kind` to `consumable` in the dialog
- **THEN** the tag editor is not presented, and a `description` field is presented instead (no quantity field)

#### Scenario: Starter editor hidden for misc
- **WHEN** an admin sets an entry's `kind` to `misc` in the dialog
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

#### Scenario: Duplicate slug surfaces in the dialog
- **WHEN** an admin adds a template whose slug already exists and the API responds HTTP 409
- **THEN** the dialog shows an error naming the conflicting slug and retains the pending edits

#### Scenario: Deleting a template does not warn about character copies
- **WHEN** an admin deletes an equipment template
- **THEN** the CMS deletes it without any in-use warning, because characters hold independent copies rather than references

### Requirement: CMS authors the tag catalog

The CMS SHALL provide an admin-only screen for authoring the global tag catalog (`api-tag-catalog`), listing every entry's `slug` and `name`, and supporting add / update / rename / delete through a tag entry dialog. Changes SHALL be submitted as a single batched `PATCH /tag-catalog { ops }` request.

The CMS is the **only** place tag entries may be authored; `apps/pip-boy` reads them but never writes them. The screen SHALL present the tag catalog with a **Tag** entry in the sidebar's admin-only Catalogo section.

#### Scenario: Admin adds a tag entry
- **WHEN** an admin enters a name (and slug) in the dialog and saves
- **THEN** the CMS issues one `PATCH /tag-catalog` with an `add` op carrying the entry's `name`

#### Scenario: Admin renames a tag entry
- **WHEN** an admin changes an entry's slug in the dialog and saves
- **THEN** the CMS issues a `rename` op followed by an `update` op for the new slug carrying the entry's `name`

#### Scenario: Duplicate slug surfaces in the dialog
- **WHEN** an admin adds an entry whose slug already exists and the API responds HTTP 409
- **THEN** the dialog shows an error naming the conflicting slug and retains the pending edits

### Requirement: CMS authors the talents catalog

The CMS SHALL provide an admin screen listing every entry of the global talents catalog (`slug`, `name`, `description`, and a requirements preview), sourced from `GET /talents-catalog`. The screen SHALL provide an add action and a per-row edit action, both opening the talent entry dialog (per `Catalog entries are created and edited through a dialog`), and a per-row delete action with confirmation. All writes SHALL go through a single batched service method, `TalentsCatalogApiService.patchSchema(ops)`, issuing `PATCH /talents-catalog`; components SHALL NOT call `HttpClient` directly for these writes. The screen SHALL be reachable only by an authenticated admin, following the same admin-only route guarding already applied to the rest of the CMS.

The table SHALL include a read-only **Requisiti** preview column. It SHALL list, in S·P·E·C·I·A·L order, the letter and value of each stat whose requirement is greater than `0` (e.g. `P2 A3`). It SHALL show `—` when the talent has no `specialRequirement` or when every value is `0`.

The screen SHALL surface a duplicate-slug conflict (HTTP 409) inside the dialog without discarding the user's unsaved edits. The talents catalog SHALL be reachable via a **Talenti** entry in the sidebar's admin-only Catalogo section.

#### Scenario: Talents catalog table loads
- **WHEN** an admin opens the talents catalog screen
- **THEN** it renders one row per catalog entry, sourced from a single `GET /talents-catalog` read

#### Scenario: Add a talent from the dialog
- **WHEN** an admin uses the add action, fills in slug/name/description in the dialog (leaving every requirement stepper at `0`), and saves
- **THEN** `TalentsCatalogApiService.patchSchema` is called with `[{ action: 'add', slug, entry: { name, description, specialRequirement: [0, 0, 0, 0, 0, 0, 0] } }]` and, after success, the table re-reads and shows the new entry

#### Scenario: Rename a talent from the dialog
- **WHEN** an admin edits an entry's slug in the dialog and saves
- **THEN** `patchSchema` is called with a `{ action: 'rename', slug, rename }` op followed by an `update` op for the new slug (not a delete plus add)

#### Scenario: Edit a talent's name or description from the dialog
- **WHEN** an admin edits an entry's name or description in the dialog (leaving the slug unchanged) and saves
- **THEN** `patchSchema` is called with `[{ action: 'update', slug, entry: { name, description, specialRequirement } }]`

#### Scenario: Delete a talent from the table
- **WHEN** an admin triggers the delete action on a row and confirms
- **THEN** `patchSchema` is called with `[{ action: 'delete', slug }]` and the row is removed from the table

#### Scenario: Requirements preview lists non-zero stats
- **GIVEN** a talent with `specialRequirement: [0, 2, 0, 0, 0, 3, 0]`
- **WHEN** the talents table renders
- **THEN** its Requisiti cell reads `P2 A3`

#### Scenario: Requirements preview shows a dash when there is no requirement
- **GIVEN** a talent with no `specialRequirement`, or with every value `0`
- **WHEN** the talents table renders
- **THEN** its Requisiti cell reads `—`

#### Scenario: Duplicate slug surfaces in the dialog
- **WHEN** an admin adds a talent whose slug already exists and the API responds HTTP 409
- **THEN** the dialog shows an error naming the conflicting slug and the unsaved edits are retained

### Requirement: CMS authors a talent's SPECIAL requirement

The talent entry dialog SHALL present, alongside `slug`/`name`/`description`, seven letter-labelled stepper controls, one per S·P·E·C·I·A·L stat (`S P E C I A L`, i.e. `strength, perception, endurance, charisma, intelligence, agility, luck` in that order). Each stepper SHALL be bounded `0`–`5` and SHALL be visually consistent with the pip-boy's own SPECIAL editor. The steppers SHALL be available in both create and edit mode. In create mode every stepper SHALL start at `0`; in edit mode each SHALL start at the talent's current value, or `0` when the talent has no requirement.

Saving the dialog SHALL carry the full 7-element `specialRequirement` array in the `add` or `update` op's `entry`, alongside the other fields, in the same single `PATCH` via `TalentsCatalogApiService.patchSchema`. Setting every stepper to `0` SHALL be equivalent to the talent having no requirement.

The screen SHALL NOT offer a separate per-row requirement action or requirement-only dialog. The talents table SHALL NOT gain seven inline numeric columns; the requirement is shown only as the read-only preview column.

#### Scenario: Admin sets a talent's SPECIAL requirement
- **WHEN** an admin opens the edit dialog for a talent, sets Endurance to `3` (leaving the rest at `0`), and saves
- **THEN** the CMS issues `patchSchema([{ action: 'update', slug, entry: { name, description, specialRequirement: [0, 0, 3, 0, 0, 0, 0] } }])`

#### Scenario: Admin sets a requirement while creating a talent
- **WHEN** an admin uses the add action, fills in slug and name, sets Agility to `2`, and saves
- **THEN** the CMS issues an `add` op whose `entry` carries `specialRequirement: [0, 0, 0, 0, 0, 2, 0]`

#### Scenario: Admin clears a talent's SPECIAL requirement
- **GIVEN** a talent currently has `specialRequirement: [0, 0, 3, 0, 0, 0, 0]`
- **WHEN** an admin opens its edit dialog, resets every stepper to `0`, and saves
- **THEN** the CMS issues an `update` op carrying `specialRequirement: [0, 0, 0, 0, 0, 0, 0]`, treated by the app as no requirement

#### Scenario: No separate requirement action exists
- **WHEN** an admin views the talents catalog table
- **THEN** each row offers only edit and delete actions (no Requisiti action), and no per-stat numeric columns are present
