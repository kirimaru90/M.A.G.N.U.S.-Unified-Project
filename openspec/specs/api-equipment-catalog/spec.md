# api-equipment-catalog Specification

## Purpose

A single global, non-campaign-scoped catalog of equipment **templates** (weapons, armor, consumables) that the CMS authors and clients copy onto characters, replacing the reference prototype's hardcoded starter loadouts.

## Requirements

### Requirement: Equipment catalog is a global, non-campaign-scoped list of templates

The system SHALL maintain a single global equipment catalog, shared across all campaigns, of **template** entries `{ slug, name, kind, tags?, defaultQuantity?, isStarter, description? }` where:

- `slug` uniquely identifies the template
- `name` is the item's display name
- `kind` is one of `weapon` | `armor` | `consumable`
- `tags` is an array of `{ name, type }` with `type` one of `core` | `extra`, matching the tag shape already persisted on a character's weapons and equip items (`api-character-inventory`). Tags are meaningful for `weapon` and `armor`; for `consumable` the array SHALL be empty or absent.
- `defaultQuantity` is a non-negative integer used when instantiating a `consumable`; it is absent or ignored for `weapon` and `armor`
- `isStarter` is a boolean marking the template as selectable during character creation

The catalog SHALL NOT be scoped per campaign. These are **templates, not instances**: they describe equipment that may be copied onto a character, and are the sole home of the starter weapon, armor, and consumable loadouts previously hardcoded as `WEAPON_KITS` / `ARMOR_KITS` constants in the reference prototype.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the equipment catalog contains an entry with `slug == "pistola-10mm"`
- **WHEN** any two different campaigns are queried for available equipment
- **THEN** both see the same `"pistola-10mm"` entry

### Requirement: Instantiating a template copies it onto the character

A template SHALL be materialised onto a character by **copying** its `name` and `tags` into the character's inventory as a new item with a server-minted `id`, routed by `kind`:

| `kind` | destination collection | fields copied |
|---|---|---|
| `weapon` | `inventory.weapons` | `name`, `tags` (each with `damaged: false`), `broken: false` |
| `armor` | `inventory.equip` | `name`, `tags` (each with `damaged: false`), `broken: false` |
| `consumable` | `inventory.consumables` | `name`, `description?`, `quantity` from `defaultQuantity` |

The character's item SHALL NOT persist any link back to the catalog `slug`. Once copied, the item is an ordinary inventory item: renaming it, retagging it, marking a tag `damaged`, or deleting it SHALL have no effect on the catalog entry, and editing the catalog entry SHALL have no effect on any character that already carries a copy.

This mirrors the copy-on-use semantics already specified for `api-conditions-catalog` (presets that "speed up authoring a condition, not constrain it"). Instantiation is performed by the client through the existing `PATCH /campaigns/:cid/characters/:id/inventory` endpoint; this capability adds no new write path onto a character.

#### Scenario: Copying a weapon template yields an independent item
- **GIVEN** a catalog entry `{ slug: "pistola-10mm", kind: "weapon", tags: [{ name: "Affidabile", type: "core" }] }`
- **WHEN** it is instantiated onto a character
- **THEN** the character's `inventory.weapons` gains an item named `Pistola 10mm` with a server-minted `id`, the tag `Affidabile` of type `core` and `damaged: false`, and **no** `slug` field

#### Scenario: Editing the character's copy does not alter the template
- **GIVEN** a character carries a copy of the `"pistola-10mm"` template
- **WHEN** the owner renames their item and marks one of its tags `damaged`
- **THEN** the catalog entry `"pistola-10mm"` SHALL be unchanged

#### Scenario: Editing the template does not alter existing copies
- **GIVEN** a character carries a copy of the `"pistola-10mm"` template
- **WHEN** an admin updates that catalog entry's `name` and `tags`
- **THEN** the character's existing inventory item SHALL be unchanged

#### Scenario: Consumable template instantiates with its default quantity
- **GIVEN** a catalog entry `{ slug: "stimpack", kind: "consumable", defaultQuantity: 2 }`
- **WHEN** it is instantiated onto a character
- **THEN** the character's `inventory.consumables` gains an item named `Stimpack` with `quantity: 2`

### Requirement: Reading the equipment catalog

The system SHALL expose `GET /equipment-catalog`, returning the full catalog as an array of `{ slug, name, kind, tags?, defaultQuantity?, isStarter, description? }`, accessible to any authenticated user (admin or player). The endpoint SHALL accept an optional `?starter=true` filter returning only entries with `isStarter: true`. Anonymous callers SHALL be rejected with HTTP 401.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /equipment-catalog`
- **THEN** the response is HTTP 200 with an array of equipment template entries

#### Scenario: Starter filter returns only starter templates
- **GIVEN** the catalog holds five entries, three of which have `isStarter: true`
- **WHEN** an authenticated player calls `GET /equipment-catalog?starter=true`
- **THEN** the response contains exactly those three entries

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /equipment-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Admin manages the equipment catalog via batched operations

The system SHALL expose `PATCH /equipment-catalog` (admin-only) accepting `{ ops: EquipmentCatalogOp[] }`, where each op is `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }` and `entry` is `{ name, kind, tags?, defaultQuantity?, isStarter, description? }`. This mirrors the batched-operation shape already used for the skills, conditions, and species catalogs.

Equipment templates are authorable **only** through this endpoint — that is, only in the CMS. `apps/pip-boy` SHALL treat the catalog as read-only.

- `add`: creates a new entry at `slug`. A `slug` that already exists SHALL be rejected with HTTP 409 naming the conflicting slug.
- `update`: merges `entry` into the existing entry at `slug`.
- `rename`: changes the entry's `slug` from `slug` to `rename`, preserving its `entry` data. A `rename` target that already exists SHALL be rejected with HTTP 409.
- `delete`: removes the entry at `slug`. Because characters hold copies rather than references, a `delete` SHALL always be permitted and SHALL NOT affect any character's inventory.
- An op referencing a `slug` that does not exist (for `update`, `rename`, or `delete`) SHALL NOT be applied and SHALL be reported in a response `ignored` array with reason `unknown_slug`; it SHALL NOT cause the whole request to fail.
- An `add` op missing `entry.name` or `entry.kind` SHALL be rejected with HTTP 400.
- An `add` or `update` op whose `entry.kind` is not `weapon`, `armor`, or `consumable` SHALL be rejected with HTTP 400.
- An `add` or `update` op supplying a tag whose `type` is not `core` or `extra` SHALL be rejected with HTTP 400.
- An `add` or `update` op supplying non-empty `tags` for a `consumable`, or a negative `defaultQuantity`, SHALL be rejected with HTTP 400.
- When `isStarter` is omitted on `add`, it SHALL default to `false`.

Non-admin callers (player or anonymous) SHALL be rejected: player with HTTP 403, anonymous with HTTP 401.

#### Scenario: Admin adds a starter weapon template
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "add", "slug": "pistola-10mm", "entry": { "name": "Pistola 10mm", "kind": "weapon", "isStarter": true, "tags": [{ "name": "Affidabile", "type": "core" }] } }] }`
- **THEN** the response is HTTP 200 and `GET /equipment-catalog?starter=true` includes the `"pistola-10mm"` entry

#### Scenario: Admin promotes an existing item to a starter
- **GIVEN** the catalog has entry `"coltello"` with `isStarter: false`
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "update", "slug": "coltello", "entry": { "isStarter": true } }] }`
- **THEN** the response is HTTP 200 and `"coltello"` appears in `GET /equipment-catalog?starter=true`

#### Scenario: Duplicate slug on add rejected
- **GIVEN** the catalog already has a `"pistola-10mm"` entry
- **WHEN** an admin PATCHes an `add` op with `slug: "pistola-10mm"`
- **THEN** the response is HTTP 409 naming `"pistola-10mm"`

#### Scenario: Invalid kind rejected
- **WHEN** an admin PATCHes an `add` op with `entry: { "name": "X", "kind": "vehicle" }`
- **THEN** the response is HTTP 400

#### Scenario: Invalid tag type rejected
- **WHEN** an admin PATCHes an `add` op with a tag whose `type` is `"legendary"`
- **THEN** the response is HTTP 400

#### Scenario: Tags on a consumable rejected
- **WHEN** an admin PATCHes an `add` op with `entry: { "name": "Stimpack", "kind": "consumable", "tags": [{ "name": "X", "type": "core" }] }`
- **THEN** the response is HTTP 400

#### Scenario: Deleting a template leaves existing copies intact
- **GIVEN** a character carries a copy of the `"pistola-10mm"` template
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "delete", "slug": "pistola-10mm" }] }`
- **THEN** the response is HTTP 200, the catalog entry is gone, and the character's inventory item is unchanged

#### Scenario: Unknown slug on delete is ignored and reported
- **WHEN** an admin PATCHes a `delete` op for a `slug` that does not exist in the catalog
- **THEN** the response is HTTP 200 and the response `ignored` array reports that `slug` with reason `unknown_slug`

#### Scenario: Player write rejected
- **WHEN** a player calls `PATCH /equipment-catalog` with any body
- **THEN** the response is HTTP 403 and the catalog is unchanged

#### Scenario: Anonymous write rejected
- **WHEN** `PATCH /equipment-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Default equipment seeds the catalog when empty

When the equipment catalog is empty, the system SHALL seed it with the reference design's starter loadouts: the four starter weapon kits and three starter armor kits from the game manual (each with its `core`/`extra` tags and `isStarter: true`), plus a `stimpack` consumable with `defaultQuantity: 2` and `isStarter: true` representing the fixed "Dotazione fissa: 2 Stimpack inclusi". This mirrors `api-skills-catalog`'s "Default skills seed the catalog when empty".

#### Scenario: Empty catalog is seeded on first read
- **GIVEN** the equipment catalog collection is empty
- **WHEN** an authenticated user calls `GET /equipment-catalog`
- **THEN** the response contains the seeded starter weapons, armors, and the stimpack consumable

#### Scenario: Seeding does not overwrite an authored catalog
- **GIVEN** the equipment catalog contains at least one entry
- **WHEN** `GET /equipment-catalog` is called
- **THEN** the catalog is returned as authored, with no seed entries injected
