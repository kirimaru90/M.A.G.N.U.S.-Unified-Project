## MODIFIED Requirements

### Requirement: Equipment catalog is a global, non-campaign-scoped list of templates

The system SHALL maintain a single global equipment catalog, shared across all campaigns, of **template** entries `{ slug, name, kind, tags?, defaultQuantity?, isStarter, description? }` where:

- `slug` uniquely identifies the template
- `name` is the item's display name
- `kind` is one of `weapon` | `armor` | `consumable` | `misc`
- `tags` is an array of `{ name, type }` with `type` one of `core` | `extra`, matching the tag shape already persisted on a character's weapons and equip items (`api-character-inventory`). Tags are meaningful for `weapon` and `armor`; for `consumable` and `misc` the array SHALL be empty or absent.
- `defaultQuantity` is a non-negative integer used when instantiating a `consumable` or `misc`; it is absent or ignored for `weapon` and `armor`
- `isStarter` is a boolean marking the template as selectable during character creation. For `kind == "misc"` it SHALL always be `false` (see the misc-exclusion requirement).

The catalog SHALL NOT be scoped per campaign. These are **templates, not instances**: they describe equipment that may be copied onto a character, and are the sole home of the starter weapon, armor, and consumable loadouts previously hardcoded as `WEAPON_KITS` / `ARMOR_KITS` constants in the reference prototype.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the equipment catalog contains an entry with `slug == "pistola-10mm"`
- **WHEN** any two different campaigns are queried for available equipment
- **THEN** both see the same `"pistola-10mm"` entry

#### Scenario: A misc template is accepted
- **WHEN** an admin adds an entry with `kind: misc`, a `name`, an optional `description`, and a `defaultQuantity`
- **THEN** the entry is stored with `kind == "misc"` and no `tags`

### Requirement: Instantiating a template copies it onto the character

A template SHALL be materialised onto a character by **copying** its `name` and `tags` into the character's inventory as a new item with a server-minted `id`, routed by `kind`:

| `kind` | destination collection | fields copied |
|---|---|---|
| `weapon` | `inventory.weapons` | `name`, `tags` (each with `damaged: false`), `broken: false` |
| `armor` | `inventory.equip` | `name`, `tags` (each with `damaged: false`), `broken: false` |
| `consumable` | `inventory.consumables` | `name`, `description?`, `quantity` from `defaultQuantity` |
| `misc` | `inventory.misc` | `name`, `description?`, `quantity` from `defaultQuantity` |

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

#### Scenario: Misc template instantiates onto inventory.misc
- **GIVEN** a catalog entry `{ slug: "chiave-inglese", kind: "misc", description: "Attrezzo", defaultQuantity: 1 }`
- **WHEN** it is instantiated onto a character
- **THEN** the character's `inventory.misc` gains an item named `Chiave inglese` with `quantity: 1` and `description: "Attrezzo"`

## ADDED Requirements

### Requirement: Misc templates are never starters

The system SHALL enforce that a `misc` catalog entry is never a starter template. On an `add` or `update` op whose resulting entry has `kind == "misc"`, the system SHALL persist `isStarter: false` regardless of the submitted value — a `true` is ignored, not rejected with an error. Consequently `GET /equipment-catalog?starter=true` SHALL never return a `misc` entry.

#### Scenario: isStarter is forced false on a misc add
- **WHEN** an admin submits an `add` op with `kind: misc` and `isStarter: true`
- **THEN** the stored entry has `isStarter: false`

#### Scenario: Changing a starter entry's kind to misc clears the flag
- **GIVEN** a stored entry with `kind: consumable` and `isStarter: true`
- **WHEN** an admin submits an `update` op changing its `kind` to `misc`
- **THEN** the stored entry has `kind: misc` and `isStarter: false`

#### Scenario: Starter filter excludes misc entries
- **GIVEN** the catalog holds a `misc` entry
- **WHEN** an authenticated caller requests `GET /equipment-catalog?starter=true`
- **THEN** the response does not contain the `misc` entry

### Requirement: Catalog entry tags are stored and returned in canonical order

The system SHALL persist a catalog entry's `tags` in a canonical order: all `core` tags first, then all `extra` tags, sorted alphabetically by `name` (case-insensitive) within each group. This ordering SHALL be applied on every `add` and `update` op before persistence, so the stored array is always canonical. `GET /equipment-catalog` SHALL return each entry's `tags` in that same order.

#### Scenario: Tags submitted out of order are stored canonically
- **WHEN** an admin adds a `weapon` entry with tags `[{name:"Zeta",type:"core"},{name:"Alfa",type:"extra"},{name:"Beta",type:"core"}]`
- **THEN** the stored `tags` are `[{name:"Beta",type:"core"},{name:"Zeta",type:"core"},{name:"Alfa",type:"extra"}]`

#### Scenario: Read returns tags in canonical order
- **GIVEN** a stored `weapon` entry whose tags are canonical
- **WHEN** a caller reads `GET /equipment-catalog`
- **THEN** that entry's `tags` are ordered core-first, then extra, alphabetical by name within each group
