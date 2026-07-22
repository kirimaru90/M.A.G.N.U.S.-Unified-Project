# api-talents-catalog Specification

## Purpose

Global, non-campaign-scoped talents (perk) catalog (`slug`, `name`, `description?`) readable by any authenticated user, with admin-only batched add/update/rename/delete operations and a bootstrap-on-startup convention mirroring the skills catalog. It provides the `/talents-catalog` endpoint the Pip-Boy client previously fetched defensively and degraded to an empty list.

## Requirements

### Requirement: Talents catalog is a global, non-campaign-scoped list

The system SHALL maintain a single global talents (perk) catalog, shared across all campaigns, of entries `{ slug, name, description?, specialRequirement? }` where `slug` is the unique identifier. `specialRequirement`, when present, is an ordered array of exactly 7 integers, each `0`–`5`, positional to `strength, perception, endurance, charisma, intelligence, agility, luck` (S·P·E·C·I·A·L order) — a non-zero value at an index is the minimum for that stat; `0` means no minimum on that stat; an omitted `specialRequirement` means the talent has no requirement at all. The catalog SHALL NOT be scoped per campaign. It mirrors the shape and conventions of `api-skills-catalog`, and replaces the previously-absent `/talents-catalog` endpoint that the Pip-Boy client fetched defensively and degraded to an empty list.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the talents catalog contains an entry with `slug == "gun-fu"`
- **WHEN** any two different campaigns are queried for available talents
- **THEN** both see the same `"gun-fu"` entry

#### Scenario: A talent's specialRequirement is returned as stored
- **GIVEN** the talents catalog contains an entry with `slug == "gun-fu"` and `specialRequirement: [0, 0, 3, 0, 0, 0, 0]`
- **WHEN** any authenticated caller reads the catalog
- **THEN** the `"gun-fu"` entry is returned with that exact `specialRequirement` array

#### Scenario: A talent without a requirement omits the field
- **GIVEN** the talents catalog contains an entry with no `specialRequirement` ever set
- **WHEN** any authenticated caller reads the catalog
- **THEN** that entry is returned without a `specialRequirement` field

### Requirement: Reading the talents catalog

The system SHALL expose `GET /talents-catalog`, returning the full catalog as an array of `{ slug, name, description? }`, accessible to any authenticated user (admin or player). Anonymous callers SHALL be rejected with HTTP 401. When the catalog is empty the endpoint SHALL return an empty array (HTTP 200), never an error.

The endpoint SHALL accept an optional `?orderBy` query parameter. When `orderBy=name`, the response array SHALL be ordered by `name` ascending using a case- and accent-insensitive Italian collation (`{ locale: 'it', strength: 1 }`). `orderBy` SHALL be lenient: an absent, empty, or unrecognised value SHALL leave the response in natural storage order rather than producing an error.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /talents-catalog`
- **THEN** the response is HTTP 200 with an array of `{ slug, name, description? }` entries

#### Scenario: Empty catalog returns an empty array
- **GIVEN** the talents catalog collection holds no entries
- **WHEN** an authenticated player calls `GET /talents-catalog`
- **THEN** the response is HTTP 200 with an empty array, and no error

#### Scenario: orderBy=name returns entries in Italian-collated alphabetical order
- **GIVEN** the catalog holds entries whose names in arbitrary storage order include mixed-case and accented values
- **WHEN** an authenticated player calls `GET /talents-catalog?orderBy=name`
- **THEN** the response array is ordered by `name` ascending, case- and accent-insensitive

#### Scenario: Unknown orderBy value falls back to natural order
- **WHEN** an authenticated player calls `GET /talents-catalog?orderBy=bogus`
- **THEN** the response is HTTP 200 in natural storage order, with no error

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /talents-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Admin manages the talents catalog via batched operations

The system SHALL expose `PATCH /talents-catalog` (admin-only) accepting `{ ops: TalentsCatalogOp[] }`, where each op is `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }` and `entry` is `{ name, description?, specialRequirement? }`. This mirrors the batched-operation shape used by the skills, conditions, tag, and equipment catalogs.

- `add`: creates a new entry at `slug` with the given `entry`. A `slug` that already exists SHALL be rejected with HTTP 409 naming the conflicting slug.
- `update`: merges `entry` into the existing entry at `slug`. Merging `specialRequirement` SHALL replace the array wholesale (no per-index merge); omitting `specialRequirement` from an `update`'s `entry` SHALL leave the existing entry's `specialRequirement` unchanged.
- `rename`: changes the entry's `slug` from `slug` to `rename`, preserving its `entry` data (including `specialRequirement`). A `rename` target that already exists SHALL be rejected with HTTP 409.
- `delete`: removes the entry at `slug`. Because characters hold copies of talents rather than references, a `delete` SHALL always be permitted and SHALL NOT affect any character's talents.
- An op referencing a `slug` that does not exist (for `update`, `rename`, or `delete`) SHALL NOT be applied and SHALL be reported in a response `ignored` array with reason `unknown_slug`; it SHALL NOT cause the whole request to fail.
- An `add` op missing `entry.name` SHALL be rejected with HTTP 400.
- An `add` or `update` op whose `entry.specialRequirement` is present but is not an array of exactly 7 values, or contains a value that is not an integer in `0..5`, SHALL be rejected with HTTP 400.
- A non-admin (player) caller SHALL be rejected with HTTP 403, and an anonymous caller with HTTP 401.

#### Scenario: Admin adds a talent
- **WHEN** an admin calls `PATCH /talents-catalog` with an `add` op for slug `"gun-fu"` and `entry: { name: "Gun Fu", description: "..." }`
- **THEN** the response is HTTP 200 and a subsequent `GET /talents-catalog` includes the `"gun-fu"` entry

#### Scenario: Admin adds a talent with a SPECIAL requirement
- **WHEN** an admin calls `PATCH /talents-catalog` with an `add` op for slug `"gun-fu"` and `entry: { name: "Gun Fu", specialRequirement: [0, 0, 0, 0, 0, 3, 0] }`
- **THEN** the response is HTTP 200 and a subsequent `GET /talents-catalog` includes the `"gun-fu"` entry with that `specialRequirement`

#### Scenario: Malformed specialRequirement rejected on add
- **WHEN** an admin calls `PATCH /talents-catalog` with an `add` op whose `entry.specialRequirement` has 6 elements, or contains a value of `6` or `-1` or `2.5`
- **THEN** the response is HTTP 400 and no entry is created

#### Scenario: Malformed specialRequirement rejected on update
- **GIVEN** the catalog already contains slug `"gun-fu"`
- **WHEN** an admin calls `PATCH /talents-catalog` with an `update` op for `"gun-fu"` whose `entry.specialRequirement` has 8 elements
- **THEN** the response is HTTP 400 and the stored entry is unchanged

#### Scenario: Update without specialRequirement leaves it unchanged
- **GIVEN** the catalog contains slug `"gun-fu"` with `specialRequirement: [0, 0, 0, 0, 0, 3, 0]`
- **WHEN** an admin calls `PATCH /talents-catalog` with an `update` op for `"gun-fu"` carrying `entry: { name: "Gun Fu", description: "updated" }` (no `specialRequirement`)
- **THEN** the response is HTTP 200 and a subsequent `GET /talents-catalog` still shows `specialRequirement: [0, 0, 0, 0, 0, 3, 0]` on that entry

#### Scenario: Duplicate slug on add rejected
- **GIVEN** the catalog already contains slug `"gun-fu"`
- **WHEN** an admin calls `PATCH /talents-catalog` with an `add` op for slug `"gun-fu"`
- **THEN** the response is HTTP 409 naming the conflicting slug

#### Scenario: Unknown slug on delete is ignored and reported
- **WHEN** an admin calls `PATCH /talents-catalog` with a `delete` op for a slug that does not exist
- **THEN** the response is HTTP 200 and the op is listed in `ignored` with reason `unknown_slug`

#### Scenario: Player write rejected
- **WHEN** a non-admin authenticated player calls `PATCH /talents-catalog`
- **THEN** the response is HTTP 403

### Requirement: Talents catalog bootstrap on startup

On application startup the system SHALL ensure the talents catalog collection exists, following the same once-against-an-empty-collection convention used by the skills catalog bootstrap and the default-admin bootstrap. If a default talents seed set is defined and the collection is empty, the system SHALL insert those entries exactly once; if the collection already contains at least one entry, the system SHALL NOT insert, modify, or remove any entry. When no default seed set is defined, the catalog SHALL simply start empty and be populated via `PATCH /talents-catalog` (CMS authoring). Bootstrap SHALL NOT fail startup when the catalog is or remains empty.

#### Scenario: Non-empty catalog is left untouched on startup
- **GIVEN** the talents catalog already contains at least one entry (seeded or admin-authored)
- **WHEN** the application starts up
- **THEN** no entry is inserted, modified, or removed

#### Scenario: Startup succeeds with an empty catalog
- **GIVEN** no default talents seed set is defined and the collection is empty
- **WHEN** the application starts up
- **THEN** startup completes without error and `GET /talents-catalog` returns an empty array
