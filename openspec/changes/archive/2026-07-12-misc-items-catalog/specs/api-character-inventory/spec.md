## MODIFIED Requirements

### Requirement: Patch inventory items
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/inventory` performing id-based diffing on the four item arrays. Each array is patched independently via an `{ items, deletedIds }` block; arrays omitted from the body are left untouched.

The body MAY contain any of `weapons`, `equip`, `consumables`, `misc`, each shaped as:
- `items`: an item with `id` updates the matching item (unknown id is not applied and is reported in the response `ignored` array with reason `unknown_id`); an item without `id` is created and the server assigns a nanoid short string id
- `deletedIds`: array of ids to remove from that array

The `misc` array is the renamed successor of the former `other` collection (same `GenericItem` shape); the key `other` SHALL NO LONGER be accepted and a body carrying it SHALL be rejected as an unknown property (HTTP 400).

Item shapes:
- `weapons` / `equip`: `name` (required), `tags` array (optional), `broken` boolean (optional)
- `consumables` / `misc`: `name` (required), `description` (optional), `quantity` number ≥ 0

Each tag object SHALL have `name` (string, required), `type` (enum: core | extra, required), and `damaged` (boolean, optional, default false).

Item ids SHALL be unique across all four arrays, including the ids the server assigns on create — a newly created item SHALL NOT receive an id already present in any of `weapons`, `equip`, `consumables`, or `misc`. Inventory is **player-writable** (owner) and admin — owners have full create/update/delete.

Updating an existing item SHALL be a **partial merge**: only the fields present in the patch item are written, and every field the patch item does not mention is preserved from the stored record. A field that the request did not send SHALL NOT be nulled or cleared, regardless of how the request payload is deserialized. A field present with an explicit value — including `false`, `0`, `""`, and `[]` — SHALL be applied, so intentional clears (e.g. an empty `tags` array, or `broken: false`) still take effect.

When a `weapons` or `equip` item's `tags` are written (on create or update), the system SHALL persist them in canonical order: all `core` tags first, then all `extra` tags, alphabetical by `name` (case-insensitive) within each group. The response `section` and all subsequent reads SHALL return each item's `tags` in that order.

#### Scenario: Owner adds an item
- **WHEN** the owner PATCHes `{ "weapons": { "items": [ { "name": "10mm Pistol" } ] } }`
- **THEN** a weapon SHALL be created with a server-assigned `id` and HTTP 200 returned with the updated `inventory` object as the response `section`

#### Scenario: Owner updates an item
- **WHEN** the owner PATCHes `{ "weapons": { "items": [ { "id": "a1b2", "broken": true } ] } }` for an existing item id
- **THEN** that item SHALL be merged and HTTP 200 returned

#### Scenario: Owner removes an item
- **WHEN** the owner PATCHes `{ "weapons": { "deletedIds": ["c3d4"] } }`
- **THEN** the matching weapon SHALL be removed and HTTP 200 returned

#### Scenario: Untouched arrays are preserved
- **WHEN** the body contains only a `weapons` block
- **THEN** `equip`, `consumables`, and `misc` SHALL be unchanged

#### Scenario: Owner adds a misc item
- **WHEN** the owner PATCHes `{ "misc": { "items": [ { "name": "Chiave inglese", "quantity": 1 } ] } }`
- **THEN** a misc item SHALL be created on `inventory.misc` with a server-assigned `id` and HTTP 200 returned

#### Scenario: Legacy `other` key is rejected
- **WHEN** the owner PATCHes a body containing an `other` block
- **THEN** the system SHALL return HTTP 400 for the unknown property

#### Scenario: Updating tags preserves the item name
- **GIVEN** a weapon with `name: "10mm Pistol"` and one tag
- **WHEN** the owner PATCHes `{ "weapons": { "items": [ { "id": "a1b2", "tags": [ … ] } ] } }` with no `name` field
- **THEN** the tags SHALL be updated and the item's `name` SHALL remain `"10mm Pistol"` in both the persisted record and the response `section`

#### Scenario: Updating the name preserves tags
- **GIVEN** a weapon with a `name` and two tags
- **WHEN** the owner PATCHes `{ "weapons": { "items": [ { "id": "a1b2", "name": "Renamed" } ] } }` with no `tags` field
- **THEN** the `name` SHALL be updated and the item's `tags` SHALL be unchanged

#### Scenario: Updating consumable quantity preserves the name
- **GIVEN** a consumable with `name: "Stimpak"` and `quantity: 3`
- **WHEN** the owner PATCHes `{ "consumables": { "items": [ { "id": "e5f6", "quantity": 4 } ] } }` with no `name` field
- **THEN** the `quantity` SHALL become `4` and the item's `name` SHALL remain `"Stimpak"`

#### Scenario: Explicit empty value clears a field
- **GIVEN** a weapon with two tags
- **WHEN** the owner PATCHes `{ "weapons": { "items": [ { "id": "a1b2", "tags": [] } ] } }`
- **THEN** the item's `tags` SHALL be emptied — an explicit `[]` is applied, not treated as omission

#### Scenario: Tags are persisted and returned in canonical order
- **GIVEN** a weapon item
- **WHEN** the owner PATCHes its `tags` as `[{name:"Zeta",type:"core"},{name:"Alfa",type:"extra"},{name:"Beta",type:"core"}]`
- **THEN** the persisted and returned `tags` are `[{name:"Beta",type:"core"},{name:"Zeta",type:"core"},{name:"Alfa",type:"extra"}]`

#### Scenario: Unknown item id is skipped and reported
- **WHEN** an item references an `id` not present in that array
- **THEN** that item SHALL NOT be applied, the response `ignored` array SHALL contain an entry naming that array and the offending id with reason `unknown_id`, and HTTP 200 SHALL be returned

#### Scenario: Created item ids never collide across arrays
- **WHEN** the owner creates one or more id-less items across any of the four arrays
- **THEN** every server-assigned id SHALL be unique across `weapons`, `equip`, `consumables`, and `misc`, never duplicating an id already present in any of the four arrays

#### Scenario: Negative quantity
- **WHEN** a created or updated consumable or misc item has `quantity` below 0
- **THEN** the system SHALL return HTTP 400

#### Scenario: Invalid tag type
- **WHEN** a tag has a `type` not in `['core', 'extra']`
- **THEN** the system SHALL return HTTP 400

#### Scenario: Created item missing name
- **WHEN** an id-less item omits the `name` field
- **THEN** the system SHALL return HTTP 400
