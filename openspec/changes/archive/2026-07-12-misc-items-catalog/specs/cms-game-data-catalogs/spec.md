## MODIFIED Requirements

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
