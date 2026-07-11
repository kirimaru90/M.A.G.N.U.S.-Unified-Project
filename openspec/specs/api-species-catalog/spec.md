# api-species-catalog Specification

## Purpose

A single global, non-campaign-scoped catalog of playable species, each carrying its `permesso`/`svantaggio` copy and Tag Skill budget, so that species data is CMS-authored rather than hardcoded and every persisted `character.species` slug resolves without migration.

## Requirements

### Requirement: Species catalog is a global, non-campaign-scoped list

The system SHALL maintain a single global species catalog, shared across all campaigns, of entries `{ slug, name, permesso, svantaggio, tagSkillBudget, description? }` where:

- `slug` uniquely identifies the species and is the value persisted on `character.species` (per `api-characters`)
- `name` is the display name in Italian in-universe copy (e.g. `Umano`, `Ghoul`, `Supermutante`, `Robot`)
- `permesso` is the species' permanent benefit copy, shown during character creation and copied onto the character as a derived talent named `SPECIE · {name}`
- `svantaggio` is the species' drawback copy, shown during creation and copied onto the character as a derived talent named `SVANTAGGIO`
- `tagSkillBudget` is a positive integer — the maestria budget that species may spend across its Tag Skills during creation (the reference's "budget 4 for Umano, 3 for other species", expressed as data)

The catalog SHALL NOT be scoped per campaign. Catalog entries are presets only — a character's `perks` remain freeform `{ name, description?, icon? }` objects with no persisted link back to a catalog slug (unchanged from `api-character-stats`); the catalog supplies the copy at creation time, and a character's derived talents are freely editable thereafter.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the species catalog contains an entry with `slug == "ghoul"`
- **WHEN** any two different campaigns are queried for available species
- **THEN** both see the same `"ghoul"` entry

### Requirement: Reading the species catalog

The system SHALL expose `GET /species-catalog`, returning the full catalog as an array of `{ slug, name, permesso, svantaggio, tagSkillBudget, description? }`, accessible to any authenticated user (admin or player). Anonymous callers SHALL be rejected with HTTP 401.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /species-catalog`
- **THEN** the response is HTTP 200 with an array of species entries

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /species-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Admin manages the species catalog via batched operations

The system SHALL expose `PATCH /species-catalog` (admin-only) accepting `{ ops: SpeciesCatalogOp[] }`, where each op is `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }` and `entry` is `{ name, permesso, svantaggio, tagSkillBudget, description? }`. This mirrors the batched-operation shape already used for the skills and conditions catalogs.

- `add`: creates a new entry at `slug`. A `slug` that already exists SHALL be rejected with HTTP 409 naming the conflicting slug.
- `update`: merges `entry` into the existing entry at `slug`.
- `rename`: changes the entry's `slug` from `slug` to `rename`, preserving its `entry` data. A `rename` target that already exists SHALL be rejected with HTTP 409.
- `delete`: removes the entry at `slug`.
- An op referencing a `slug` that does not exist (for `update`, `rename`, or `delete`) SHALL NOT be applied and SHALL be reported in a response `ignored` array with reason `unknown_slug`; it SHALL NOT cause the whole request to fail.
- An `add` op missing `entry.name`, `entry.permesso`, `entry.svantaggio`, or `entry.tagSkillBudget` SHALL be rejected with HTTP 400.
- An `add` or `update` op whose `entry.tagSkillBudget` is not a positive integer SHALL be rejected with HTTP 400.
- A `delete` or `rename` op targeting a slug still referenced by at least one non-deleted character's `species` SHALL be rejected with HTTP 409, so a character can never point at a missing species.

Non-admin callers (player or anonymous) SHALL be rejected: player with HTTP 403, anonymous with HTTP 401.

#### Scenario: Admin adds a new species
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "add", "slug": "synth", "entry": { "name": "Sintetico", "permesso": "…", "svantaggio": "…", "tagSkillBudget": 3 } }] }`
- **THEN** the response is HTTP 200 and a subsequent `GET /species-catalog` includes the `"synth"` entry

#### Scenario: Duplicate slug on add rejected
- **GIVEN** the catalog already has a `"ghoul"` entry
- **WHEN** an admin PATCHes an `add` op with `slug: "ghoul"`
- **THEN** the response is HTTP 409 naming `"ghoul"`

#### Scenario: Admin updates a species' tag-skill budget
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "update", "slug": "human", "entry": { "tagSkillBudget": 5 } }] }`
- **THEN** the response is HTTP 200 and the entry's `tagSkillBudget` becomes `5`

#### Scenario: Invalid tagSkillBudget rejected
- **WHEN** an admin PATCHes an `add` op with `entry.tagSkillBudget` of `0` or `-1`
- **THEN** the response is HTTP 400

#### Scenario: Deleting a species in use is rejected
- **GIVEN** at least one non-deleted character has `species == "ghoul"`
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "delete", "slug": "ghoul" }] }`
- **THEN** the response is HTTP 409 and the entry is unchanged

#### Scenario: Unknown slug on delete is ignored and reported
- **WHEN** an admin PATCHes a `delete` op for a `slug` that does not exist in the catalog
- **THEN** the response is HTTP 200 and the response `ignored` array reports that `slug` with reason `unknown_slug`

#### Scenario: Player write rejected
- **WHEN** a player calls `PATCH /species-catalog` with any body
- **THEN** the response is HTTP 403 and the catalog is unchanged

#### Scenario: Anonymous write rejected
- **WHEN** `PATCH /species-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Default species seed the catalog when empty

When the species catalog is empty, the system SHALL seed it with the four canonical species from the game manual — `human` (Umano), `ghoul` (Ghoul), `super_mutant` (Supermutante), `robot` (Robot) — each with its `permesso` and `svantaggio` copy and a `tagSkillBudget` of `4` for `human` and `3` for the other three. This mirrors `api-skills-catalog`'s "Default skills seed the catalog when empty", and guarantees that an existing deployment's persisted `species` values always resolve without a data migration.

#### Scenario: Empty catalog is seeded on first read
- **GIVEN** the species catalog collection is empty
- **WHEN** an authenticated user calls `GET /species-catalog`
- **THEN** the response contains the four canonical species entries

#### Scenario: Seeding does not overwrite an authored catalog
- **GIVEN** the species catalog contains at least one entry
- **WHEN** `GET /species-catalog` is called
- **THEN** the catalog is returned as authored, with no seed entries injected
