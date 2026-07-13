## MODIFIED Requirements

### Requirement: Equipment catalog is a global, non-campaign-scoped list of templates

The system SHALL maintain a single global equipment catalog, shared across all campaigns, of **template** entries `{ slug, name, kind, tags?, isStarter, description? }` where:

- `slug` uniquely identifies the template
- `name` is the item's display name
- `kind` is one of `weapon` | `armor` | `consumable` | `misc`
- `tags` is an array of `{ name, type }` with `type` one of `core` | `extra`, matching the tag shape already persisted on a character's weapons and equip items (`api-character-inventory`). Tags are meaningful for `weapon` and `armor`; for `consumable` and `misc` the array SHALL be empty or absent.
- `description` is an optional free-text field, meaningful for `consumable` and `misc` (their sole descriptive field); it MAY be present on any kind.
- `isStarter` is a boolean marking the template as selectable during character creation. For `kind == "misc"` it SHALL always be `false` (see the misc-exclusion requirement).

Templates SHALL NOT carry a quantity. Quantity is a per-character **inventory** concern, not a template concern: it lives on the character's item (`GenericItem.quantity`) and is adjusted there. The catalog SHALL NOT be scoped per campaign. These are **templates, not instances**: they describe equipment that may be copied onto a character, and are the sole home of the starter weapon, armor, and consumable loadouts previously hardcoded as `WEAPON_KITS` / `ARMOR_KITS` constants in the reference prototype.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the equipment catalog contains an entry with `slug == "pistola-10mm"`
- **WHEN** any two different campaigns are queried for available equipment
- **THEN** both see the same `"pistola-10mm"` entry

#### Scenario: A misc template is accepted
- **WHEN** an admin adds an entry with `kind: misc`, a `name`, and an optional `description`
- **THEN** the entry is stored with `kind == "misc"`, no `tags`, and no quantity field

### Requirement: Instantiating a template copies it onto the character

A template SHALL be materialised onto a character by **copying** its `name` and `tags` into the character's inventory as a new item with a server-minted `id`, routed by `kind`:

| `kind` | destination collection | fields copied |
|---|---|---|
| `weapon` | `inventory.weapons` | `name`, `tags` (each with `damaged: false`), `broken: false` |
| `armor` | `inventory.equip` | `name`, `tags` (each with `damaged: false`), `broken: false` |
| `consumable` | `inventory.consumables` | `name`, `description?`, `quantity: 1` |
| `misc` | `inventory.misc` | `name`, `description?`, `quantity: 1` |

Instantiating a `consumable` or `misc` SHALL always set `quantity` to `1`; the character then adjusts the count with the inventory stepper. Templates carry no default quantity to copy.

The character's item SHALL NOT persist any link back to the catalog `slug`. Once copied, the item is an ordinary inventory item: renaming it, retagging it, marking a tag `damaged`, changing its quantity, or deleting it SHALL have no effect on the catalog entry, and editing the catalog entry SHALL have no effect on any character that already carries a copy.

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

#### Scenario: Consumable template instantiates with quantity one
- **GIVEN** a catalog entry `{ slug: "stimpack", kind: "consumable" }`
- **WHEN** it is instantiated onto a character
- **THEN** the character's `inventory.consumables` gains an item named `Stimpack` with `quantity: 1`

#### Scenario: Misc template instantiates onto inventory.misc with quantity one
- **GIVEN** a catalog entry `{ slug: "chiave-inglese", kind: "misc", description: "Attrezzo" }`
- **WHEN** it is instantiated onto a character
- **THEN** the character's `inventory.misc` gains an item named `Chiave inglese` with `quantity: 1` and `description: "Attrezzo"`

### Requirement: Reading the equipment catalog

The system SHALL expose `GET /equipment-catalog`, returning the full catalog as an array of `{ slug, name, kind, tags?, isStarter, description? }`, accessible to any authenticated user (admin or player). The response SHALL NOT include a `defaultQuantity` field. The endpoint SHALL accept an optional `?starter=true` filter returning only entries with `isStarter: true`. Anonymous callers SHALL be rejected with HTTP 401.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /equipment-catalog`
- **THEN** the response is HTTP 200 with an array of equipment template entries, none carrying a `defaultQuantity`

#### Scenario: Starter filter returns only starter templates
- **GIVEN** the catalog holds five entries, three of which have `isStarter: true`
- **WHEN** an authenticated player calls `GET /equipment-catalog?starter=true`
- **THEN** the response contains exactly those three entries

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /equipment-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Admin manages the equipment catalog via batched operations

The system SHALL expose `PATCH /equipment-catalog` (admin-only) accepting `{ ops: EquipmentCatalogOp[] }`, where each op is `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }` and `entry` is `{ name, kind, tags?, isStarter, description? }`. The `entry` shape SHALL NOT include `defaultQuantity`. This mirrors the batched-operation shape already used for the skills, conditions, and species catalogs.

Equipment templates are authorable **only** through this endpoint — that is, only in the CMS. `apps/pip-boy` SHALL treat the catalog as read-only.

- `add`: creates a new entry at `slug`. A `slug` that already exists SHALL be rejected with HTTP 409 naming the conflicting slug.
- `update`: merges `entry` into the existing entry at `slug`.
- `rename`: changes the entry's `slug` from `slug` to `rename`, preserving its `entry` data. A `rename` target that already exists SHALL be rejected with HTTP 409.
- `delete`: removes the entry at `slug`. Because characters hold copies rather than references, a `delete` SHALL always be permitted and SHALL NOT affect any character's inventory.
- An op referencing a `slug` that does not exist (for `update`, `rename`, or `delete`) SHALL NOT be applied and SHALL be reported in a response `ignored` array with reason `unknown_slug`; it SHALL NOT cause the whole request to fail.

#### Scenario: Admin adds a misc template with a description and no quantity
- **WHEN** an admin sends an `add` op with `kind: misc`, a `name`, and a `description`
- **THEN** the entry is stored with `kind == "misc"` and its `description`, and no `defaultQuantity` is stored even if one was supplied
