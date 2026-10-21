## ADDED Requirements

### Requirement: Codex entry document structure

The API SHALL persist codex entries in their own `codex_entries` collection, one document per entry, scoped to a campaign. An entry SHALL carry:

- `id` (server-minted nanoid), `campaignId` (ObjectId)
- `type`: `personaggio` | `luogo` | `fazione` | `creatura`
- `name` (string, required, non-empty after trim)
- `description` (string, optional)
- `secretDescription` (string, optional; master-only)
- `imageUrl` (string, optional; an `http(s)` URL)
- `isPublic` (boolean, default `false`)
- `visibleToCharacterIds` (array of character ObjectIds, default `[]`, no duplicates)
- `isEditable` (boolean)
- `mapPlaceSlug` (string or null, default `null`)
- `createdByCharacterId` (ObjectId or null; `null` when the master created it)
- `isDeleted` (boolean, default `false`), `deletedAt` (date or null), `deletedByCharacterId` (ObjectId or null)
- `createdAt`, `updatedAt`

Responses SHALL NOT leak the raw `_id` or `__v`. `mapPlaceSlug` SHALL NOT be validated against the campaign map: a slug that resolves to no place is a dangling link that clients hide, not an error.

#### Scenario: Admin reads every field
- **WHEN** an admin reads an entry
- **THEN** the response contains every field listed above, including `secretDescription`, `visibleToCharacterIds`, `isEditable`, and the soft-delete fields

#### Scenario: Unknown type is rejected
- **WHEN** a caller creates an entry with `type: "oggetto"`
- **THEN** the response is HTTP 400

#### Scenario: Non-http image URL is rejected
- **WHEN** a caller creates an entry with `imageUrl: "javascript:alert(1)"`
- **THEN** the response is HTTP 400

### Requirement: Admin codex CRUD

The API SHALL expose these admin-only endpoints, guarded by `JwtRequiredGuard`, `CampaignAccessGuard`, and `AdminGuard`:

- `GET /campaigns/:cid/codex`: every entry of the campaign, **including soft-deleted ones**, with all fields
- `POST /campaigns/:cid/codex`: create; `isEditable` defaults to `false` and `createdByCharacterId` is `null`
- `GET /campaigns/:cid/codex/:entryId`: read one, deleted or not
- `PATCH /campaigns/:cid/codex/:entryId`: partial update of any authored field, including `visibleToCharacterIds`, `isEditable`, `secretDescription`, and `isDeleted` (setting it `false` restores the entry and clears `deletedAt` and `deletedByCharacterId`; setting it `true` soft-deletes it with `deletedByCharacterId: null`)
- `DELETE /campaigns/:cid/codex/:entryId`: **hard** delete, returning HTTP 204

Every id in `visibleToCharacterIds` SHALL name a non-deleted character of the same campaign; otherwise the request SHALL be rejected with HTTP 400. An `entryId` that does not belong to the addressed campaign SHALL yield HTTP 404.

#### Scenario: Master creates a non-editable entry by default
- **WHEN** an admin POSTs `{ type: "fazione", name: "Confraternita d'Acciaio" }`
- **THEN** the entry is stored with `isEditable: false`, `isPublic: false`, `visibleToCharacterIds: []`, and `createdByCharacterId: null`

#### Scenario: Master reveals an entry to specific characters
- **WHEN** an admin PATCHes `{ visibleToCharacterIds: [A, B] }` on a private entry
- **THEN** characters A and B see the entry and no other character does

#### Scenario: Character from another campaign is rejected
- **WHEN** an admin sets `visibleToCharacterIds` to a character id belonging to another campaign
- **THEN** the response is HTTP 400 and nothing is stored

#### Scenario: Admin list includes deleted entries
- **GIVEN** an entry soft-deleted by a player
- **WHEN** an admin lists the campaign's codex
- **THEN** the entry is present with `isDeleted: true`, its `deletedAt`, and its `deletedByCharacterId`

#### Scenario: Admin restores a soft-deleted entry
- **WHEN** an admin PATCHes `{ isDeleted: false }` on a soft-deleted entry
- **THEN** the entry has `isDeleted: false`, `deletedAt: null`, `deletedByCharacterId: null`, and players who may see it see it again

#### Scenario: Admin delete is permanent
- **WHEN** an admin DELETEs an entry
- **THEN** the response is HTTP 204 and a subsequent admin GET of that entry is HTTP 404

#### Scenario: Non-admin cannot reach admin routes
- **WHEN** a player calls `GET /campaigns/:cid/codex`
- **THEN** the response is HTTP 403

#### Scenario: Entry from another campaign is not found
- **WHEN** an admin calls `GET /campaigns/C2/codex/E` for an entry `E` of campaign `C1`
- **THEN** the response is HTTP 404

### Requirement: Player codex read, projected per character

The API SHALL expose `GET /campaigns/:cid/characters/:chid/codex`, guarded by `JwtRequiredGuard`, `CampaignAccessGuard`, and `CharacterOwnerGuard`: the character's owner or an admin, with access failures yielding HTTP 404 and a soft-deleted character unreachable. The response SHALL be the same projection for an admin as for the owner.

An entry SHALL be included only when it is **not** soft-deleted **and** either `isPublic` is `true` or `visibleToCharacterIds` contains `chid`. Visibility SHALL be evaluated at read time, so an entry made private again stops being returned to every character not listed in `visibleToCharacterIds`.

Each returned entry SHALL carry `id`, `type`, `name`, `description`, `imageUrl`, `isPublic`, `isEditable`, `mapPlaceSlug`, `isOwn` (`createdByCharacterId` equals `chid`), `createdAt`, and `updatedAt`. It SHALL NOT carry `secretDescription`, `visibleToCharacterIds`, `createdByCharacterId`, or any soft-delete field. Entries SHALL be ordered by `name`, Italian-collated, case- and accent-insensitive.

#### Scenario: Public entry is seen by everyone
- **GIVEN** an entry with `isPublic: true` and `visibleToCharacterIds: []`
- **WHEN** any character of the campaign reads its codex
- **THEN** the entry is included

#### Scenario: Listed character sees a private entry
- **GIVEN** a private entry with `visibleToCharacterIds: [A]`
- **WHEN** A and B each read their codex
- **THEN** A's response includes the entry and B's does not

#### Scenario: Making an entry private hides it from unlisted characters
- **GIVEN** a public entry with `visibleToCharacterIds: [A]` that B currently sees
- **WHEN** the entry is set to `isPublic: false`
- **THEN** B's next read no longer includes it, while A's still does

#### Scenario: Secret description never reaches a player
- **GIVEN** a visible entry with a `secretDescription`
- **WHEN** its owner, or an admin through the character route, reads the codex
- **THEN** no returned entry carries `secretDescription`

#### Scenario: Soft-deleted entry is gone for players
- **GIVEN** a public entry that has been soft-deleted
- **WHEN** any character reads its codex
- **THEN** the entry is not included

#### Scenario: Non-owner gets 404
- **WHEN** a player reads the codex of a character they do not own
- **THEN** the response is HTTP 404

### Requirement: Player creates codex entries

The API SHALL expose `POST /campaigns/:cid/characters/:chid/codex` under the same guards. The body SHALL accept only `type`, `name`, `description`, `imageUrl`, `isPublic`, and `mapPlaceSlug`. Any other field, including `isEditable`, `visibleToCharacterIds`, and `secretDescription`, SHALL be rejected with HTTP 400.

The stored entry SHALL have `visibleToCharacterIds: [chid]`, `isEditable: true`, `createdByCharacterId: chid`, and `isPublic` as sent (default `false`). The response SHALL be the created entry in the player projection.

#### Scenario: Player creates a private entry
- **WHEN** the owner of A POSTs `{ type: "creatura", name: "Mirelurk" }`
- **THEN** the entry is stored with `visibleToCharacterIds: [A]`, `isEditable: true`, `isPublic: false`, and it is returned with `isOwn: true`

#### Scenario: Player cannot set master-only fields
- **WHEN** a player POSTs an entry with `secretDescription` or `visibleToCharacterIds`
- **THEN** the response is HTTP 400 and nothing is stored

### Requirement: Player edits gated by visibility and isEditable

The API SHALL expose `PATCH /campaigns/:cid/characters/:chid/codex/:entryId` under the same guards. The body SHALL accept only `type`, `name`, `description`, `imageUrl`, `isPublic`, and `mapPlaceSlug`, rejecting any other field with HTTP 400.

For a non-admin caller, the write SHALL be allowed only when the entry is **visible to `chid`** (per the player projection rule) **and** `isEditable` is `true`. An entry that is not visible, deleted, or in another campaign SHALL yield HTTP 404. A visible entry with `isEditable: false` SHALL yield HTTP 403. An admin caller SHALL bypass the `isEditable` check but not the visibility rule. The response SHALL be the updated entry in the player projection, or HTTP 204 with no body if the update leaves the entry no longer visible to `chid`.

#### Scenario: Any character that sees an editable entry may edit it
- **GIVEN** a public, editable entry created by A
- **WHEN** B PATCHes `{ description: "…" }`
- **THEN** the description is updated

#### Scenario: Master entry is read-only for players
- **GIVEN** a visible entry with `isEditable: false`
- **WHEN** a player PATCHes it
- **THEN** the response is HTTP 403 and nothing changes

#### Scenario: Player toggles public
- **GIVEN** A's own private entry
- **WHEN** A PATCHes `{ isPublic: true }`
- **THEN** every character of the campaign sees the entry

#### Scenario: Making private an entry seen only through public
- **GIVEN** a public, editable entry with `visibleToCharacterIds: [A]` that B sees only because it is public
- **WHEN** B PATCHes `{ isPublic: false }`
- **THEN** the change is stored, the response is HTTP 204, and B no longer sees the entry

#### Scenario: Invisible entry is not found
- **WHEN** a player PATCHes a private entry they are not listed on
- **THEN** the response is HTTP 404

### Requirement: Player deletion is a soft delete

The API SHALL expose `DELETE /campaigns/:cid/characters/:chid/codex/:entryId` under the same guards, subject to the same visibility and `isEditable` rule as PATCH. It SHALL NOT remove the document; it SHALL set `isDeleted: true`, `deletedAt` to now, and `deletedByCharacterId: chid`, and return HTTP 204. After a soft delete, every player route SHALL treat the entry as absent (HTTP 404 for PATCH and DELETE).

#### Scenario: Player delete keeps the document
- **WHEN** a player deletes an editable entry they see
- **THEN** the response is HTTP 204, the entry disappears from every character's codex, and the admin list still shows it with `isDeleted: true` and `deletedByCharacterId` set to that character

#### Scenario: Non-editable entry cannot be deleted by a player
- **WHEN** a player deletes a visible entry with `isEditable: false`
- **THEN** the response is HTTP 403 and the entry is unchanged

#### Scenario: Deleted entry cannot be edited
- **GIVEN** a soft-deleted entry
- **WHEN** a player PATCHes it
- **THEN** the response is HTTP 404

### Requirement: Codex export and import

The API SHALL expose, under the admin guards:

- `GET /campaigns/:cid/codex/export`: a JSON array of every entry in the campaign, deleted ones included, each with every authored field (`id`, `type`, `name`, `description`, `secretDescription`, `imageUrl`, `isPublic`, `visibleToCharacterIds`, `isEditable`, `mapPlaceSlug`, `createdByCharacterId`, `isDeleted`, `deletedAt`, `deletedByCharacterId`) and no `campaignId`, `_id`, or `__v`
- `POST /campaigns/:cid/codex/import`: body `{ entries: [...] }`, the same shape

Import SHALL be **append-only**. It SHALL never modify or delete an existing entry. Every incoming item SHALL be decided independently, in file order:

- **invalid**: not an object, missing a non-empty `name`, or a `type` outside the enum: skipped
- **collision**: its `id` matches an existing entry of the campaign (deleted or not), **or** its `type` plus normalized `name` (trimmed, whitespace-collapsed, Italian case- and accent-insensitive) matches an existing entry (deleted or not): skipped
- **duplicate in file**: it collides, by the same two keys, with an earlier item already accepted from this file: skipped
- otherwise **added**: it keeps its incoming `id` when present and not taken, else it gets a new one

An added entry SHALL keep only the ids in `visibleToCharacterIds`, `createdByCharacterId`, and `deletedByCharacterId` that name characters of the target campaign. Other ids are dropped or set to null. `mapPlaceSlug` SHALL be kept as is. `isEditable` SHALL default to `false` when absent.

The response SHALL be `{ added: number, skipped: [{ index, name, reason }] }` with `reason` one of `invalid`, `collision`, `duplicate_in_file`.

#### Scenario: Re-importing an export adds nothing
- **WHEN** an admin exports the codex and imports the file into the same campaign
- **THEN** `added` is 0 and every item is skipped as `collision`

#### Scenario: Name collision is skipped across campaigns
- **GIVEN** campaign C2 already has a `luogo` named `Diamond City`
- **WHEN** a file from C1 containing `{ type: "luogo", name: "diamond  city" }` is imported into C2
- **THEN** that item is skipped as `collision` and the existing entry is unchanged

#### Scenario: Foreign character ids are dropped
- **WHEN** an entry whose `visibleToCharacterIds` names characters of another campaign is imported
- **THEN** it is added with those ids removed

#### Scenario: Soft-deleted entries still collide
- **GIVEN** a soft-deleted entry `Mirelurk` of type `creatura`
- **WHEN** a file containing a `creatura` named `Mirelurk` is imported
- **THEN** the item is skipped as `collision` and the deleted entry stays deleted

#### Scenario: Invalid items are reported
- **WHEN** a file contains an item with no name and one with `type: "oggetto"`
- **THEN** both are skipped as `invalid` and the rest of the file is processed
