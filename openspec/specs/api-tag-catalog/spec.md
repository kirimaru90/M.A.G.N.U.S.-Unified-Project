# api-tag-catalog Specification

## Purpose

A global, non-campaign-scoped catalog of canonical tag names, seeded with defaults and authored admin-only from the CMS, exposed for reading to any authenticated user and for batched write operations to admins. The catalog supplies canonical tag names to speed up and standardise tag entry on inventory items; it never constrains what tag names may be attached to an item.

## Requirements

### Requirement: Tag catalog is a global, non-campaign-scoped list of tag names

The system SHALL maintain a single global tag catalog, shared across all campaigns, of entries `{ slug, name }` where:

- `slug` uniquely identifies the tag entry
- `name` is the tag's canonical display name

The catalog SHALL NOT carry a `core` / `extra` type: whether a tag is core or extra is a property of how it is attached to a specific item, not of the tag name. The catalog SHALL NOT be scoped per campaign. These are canonical **names** offered to speed up and standardise tag entry; they never constrain what tag names may be attached to an item.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the tag catalog contains an entry with `slug == "automatica"`
- **WHEN** any two different campaigns' characters are edited
- **THEN** both see the same `"automatica"` tag entry

#### Scenario: Entry carries a name and no type
- **WHEN** an admin adds an entry with `slug: "pesante"` and `name: "Pesante"`
- **THEN** the entry is stored as `{ slug: "pesante", name: "Pesante" }` with no `type` field

### Requirement: Reading the tag catalog

The system SHALL expose `GET /tag-catalog`, returning the full catalog as an array of `{ slug, name }`, accessible to any authenticated user (admin or player). Anonymous callers SHALL be rejected with HTTP 401.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /tag-catalog`
- **THEN** the response is HTTP 200 with an array of tag entries

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /tag-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Admin manages the tag catalog via batched operations

The system SHALL expose `PATCH /tag-catalog` (admin-only) accepting `{ ops: TagCatalogOp[] }`, where each op is `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }` and `entry` is `{ name }`. This mirrors the batched-operation shape used by the skills, conditions, species, and equipment catalogs.

Tag entries are authorable **only** through this endpoint — that is, only in the CMS. `apps/pip-boy` SHALL treat the catalog as read-only.

- `add`: creates a new entry at `slug`. A `slug` that already exists SHALL be rejected with HTTP 409 naming the conflicting slug.
- `update`: merges `entry` into the existing entry at `slug`.
- `rename`: changes the entry's `slug` from `slug` to `rename`, preserving its `entry` data. A `rename` target that already exists SHALL be rejected with HTTP 409.
- `delete`: removes the entry at `slug`. Because items hold plain tag names rather than references, a `delete` SHALL always be permitted and SHALL NOT affect any character's inventory.
- An op referencing a `slug` that does not exist (for `update`, `rename`, or `delete`) SHALL NOT be applied and SHALL be reported in a response `ignored` array with reason `unknown_slug`; it SHALL NOT cause the whole request to fail.

A non-admin caller SHALL be rejected with HTTP 403.

#### Scenario: Admin adds a tag entry
- **WHEN** an admin sends `PATCH /tag-catalog { ops: [{ action: "add", slug: "automatica", entry: { name: "Automatica" } }] }`
- **THEN** the catalog gains `{ slug: "automatica", name: "Automatica" }`

#### Scenario: Duplicate slug on add is rejected
- **GIVEN** the catalog already contains `slug == "automatica"`
- **WHEN** an admin sends an `add` op for `slug == "automatica"`
- **THEN** the response is HTTP 409 naming the conflicting slug

#### Scenario: Unknown slug is reported, not fatal
- **WHEN** an admin sends a `delete` op for a slug that does not exist
- **THEN** the op is reported in the response `ignored` array with reason `unknown_slug` and the request still succeeds (HTTP 200)

#### Scenario: Non-admin cannot write
- **WHEN** a non-admin calls `PATCH /tag-catalog`
- **THEN** the response is HTTP 403

### Requirement: Default tags seed the catalog when empty

On startup, when the tag catalog collection is empty, the system SHALL seed it with a default set of common tag names. When the collection already contains at least one entry, the seed SHALL be a no-op so admin edits are never overwritten.

#### Scenario: Seed populates an empty catalog
- **GIVEN** the tag catalog collection is empty at startup
- **WHEN** the bootstrap seed runs
- **THEN** the catalog contains the default tag entries

#### Scenario: Seed is a no-op when non-empty
- **GIVEN** the tag catalog already contains at least one entry
- **WHEN** the bootstrap seed runs
- **THEN** the existing entries are unchanged and no defaults are re-inserted
