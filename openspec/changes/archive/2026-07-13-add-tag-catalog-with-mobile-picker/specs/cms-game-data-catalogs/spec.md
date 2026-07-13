## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Non-admin cannot reach the catalog screens

The CMS SHALL restrict every game-data catalog screen — skills, conditions, species, equipment, and tags — to admin users. A non-admin who navigates to any catalog route SHALL be redirected away (or shown an access-denied view) and SHALL NOT be able to issue catalog `PATCH` requests from the UI.

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

#### Scenario: Catalogo nav section hidden for non-admins
- **WHEN** a non-admin session renders the CMS shell
- **THEN** the sidebar does NOT contain the Catalogo section or any catalog links (including the Tag link)

#### Scenario: Catalogo nav section shown for admins
- **WHEN** an admin session renders the CMS shell
- **THEN** the sidebar contains the Catalogo section with the skills, conditions, species, equipment, and tag links
