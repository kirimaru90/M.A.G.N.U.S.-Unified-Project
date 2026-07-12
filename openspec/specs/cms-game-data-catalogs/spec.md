# cms-game-data-catalogs Specification

## Purpose

CMS admin screens and API-client services for authoring the global skills, conditions, species, and equipment catalogs via single batched `PATCH` calls, admin-only route guarding consistent with the rest of the CMS.

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

The CMS SHALL provide an admin-only screen for authoring the global species catalog (`api-species-catalog`), listing every entry's `slug`, `name`, `permesso`, `svantaggio`, and `tagSkillBudget`, and supporting add / update / rename / delete. Changes SHALL be submitted as a single batched `PATCH /species-catalog { ops }` request, consistent with the existing skills- and conditions-catalog screens.

The screen SHALL surface a duplicate-slug conflict (HTTP 409) and an in-use-species conflict (HTTP 409 on delete/rename) as inline errors, without discarding the user's unsaved edits.

#### Scenario: Admin edits a species' drawback copy
- **WHEN** an admin changes the `svantaggio` text of the `ghoul` entry and saves
- **THEN** the CMS issues one `PATCH /species-catalog` with an `update` op for slug `ghoul` and the list reflects the new copy

#### Scenario: Admin edits a species' tag-skill budget
- **WHEN** an admin changes `tagSkillBudget` for `human` from `4` to `5` and saves
- **THEN** the CMS issues an `update` op carrying `tagSkillBudget: 5`

#### Scenario: Duplicate slug surfaces inline
- **WHEN** an admin adds a species whose slug already exists and the API responds HTTP 409
- **THEN** the CMS shows an inline error naming the conflicting slug and retains the pending edits

#### Scenario: Deleting an in-use species surfaces inline
- **WHEN** an admin deletes a species still referenced by a character and the API responds HTTP 409
- **THEN** the CMS shows an inline error explaining the species is in use and the entry remains listed

### Requirement: CMS authors the equipment catalog

The CMS SHALL provide an admin-only screen for authoring the global equipment catalog (`api-equipment-catalog`), listing every template's `slug`, `name`, `kind`, `isStarter` flag, and — for `weapon` and `armor` kinds — its `core`/`extra` tags, and supporting add / update / rename / delete. Changes SHALL be submitted as a single batched `PATCH /equipment-catalog { ops }` request.

The CMS is the **only** place equipment templates may be authored; `apps/pip-boy` reads them but never writes them.

The screen SHALL make `isStarter` directly togglable per entry, since that flag alone determines which templates `pipboy-character-creation` offers during character creation. The tag editor SHALL only be presented for `weapon` and `armor` kinds; a `defaultQuantity` field (with an optional `description`) SHALL be presented for `consumable` and `misc`, matching the API's validation.

The `kind` selector SHALL offer four kinds — `weapon`, `armor`, `consumable`, and `misc` — with `misc` labelled **"Vari"** in the UI. Because `misc` templates are never starters (`api-equipment-catalog`), the screen SHALL NOT present the `isStarter` toggle for a `misc` entry.

The screen SHALL present a filter bar above the list with:
- a **name** free-text filter and a **slug** free-text filter, each a case-insensitive substring match that narrows the list as the admin types;
- an **isStarter** checkbox filter that, when checked, restricts the list to starter entries;
- a **kind** multi-select over `weapon | armor | consumable | misc`; an empty selection means "all kinds".

All active filters combine with AND. Filtering is performed client-side over the loaded catalog and does not issue a new request.

#### Scenario: Admin adds a starter weapon template with tags
- **WHEN** an admin adds an entry with `kind: weapon`, `isStarter: true`, and two tags — one `core`, one `extra` — and saves
- **THEN** the CMS issues one `PATCH /equipment-catalog` with an `add` op carrying `kind`, `isStarter`, and both tags with their `type` values

#### Scenario: Admin adds a misc (Vari) template
- **WHEN** an admin selects `kind` "Vari", enters a name, an optional description, and a quantity, and saves
- **THEN** the CMS issues an `add` op with `kind: misc` and a `defaultQuantity`, and no `isStarter` toggle was shown for the entry

#### Scenario: Admin promotes an existing item to a starter
- **WHEN** an admin toggles `isStarter` on for an existing template and saves
- **THEN** the CMS issues an `update` op carrying `isStarter: true`, and the entry becomes available in the pip-boy creation wizard's starter picker

#### Scenario: Tag editor hidden for consumables
- **WHEN** an admin sets an entry's `kind` to `consumable`
- **THEN** the tag editor is not presented, and a `defaultQuantity` field is presented instead

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

### Requirement: Non-admin cannot reach the catalog screens

The CMS SHALL restrict every game-data catalog screen — skills, conditions, species, and equipment — to admin users. A non-admin who navigates to any catalog route SHALL be redirected away (or shown an access-denied view) and SHALL NOT be able to issue catalog `PATCH` requests from the UI.

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

#### Scenario: Catalogo nav section hidden for non-admins
- **WHEN** a non-admin session renders the CMS shell
- **THEN** the sidebar does NOT contain the Catalogo section or any catalog links

#### Scenario: Catalogo nav section shown for admins
- **WHEN** an admin session renders the CMS shell
- **THEN** the sidebar shows the Catalogo section with its catalog links
