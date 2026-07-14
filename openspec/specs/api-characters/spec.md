# api-characters Specification

## Purpose
TBD - created by archiving change add-character-module. Update Purpose after archive.
## Requirements
### Requirement: Character document structure
A character SHALL be a document with the following top-level fields: `id`, `campaignId` (ObjectId), `userId` (ObjectId), `name` (string, required), `species` (string — a slug present in the species catalog, default: `human`), `special` (embedded object), `skills` (array), `actionPoints` (embedded object), `status` (embedded object), `perks` (array), `inventory` (embedded object), `resources` (embedded object), `background` (string, optional), `isDeleted` (boolean, default: false), `deletedAt` (Date, optional), `createdAt`, `updatedAt`.

`species` was previously a fixed enum (`human | ghoul | super_mutant | robot`). It is now a slug validated against `api-species-catalog` on write, so that a species' `permesso`/`svantaggio` copy and its `tagSkillBudget` can be authored in the CMS rather than hardcoded. The four historical values are the catalog's seeded slugs, so all existing persisted documents remain valid and no migration is required.

The `background` field is persisted with `select: false`: it SHALL NOT be included in the character list response, the character detail response, or any section-`PATCH` response. It is readable only through the dedicated background endpoint (see *Character background storage and retrieval*). All other fields are returned as before, with `isDeleted` omitted from the response body.

#### Scenario: Character document returned by GET
- **WHEN** a client requests `GET /campaigns/:cid/characters/:id`
- **THEN** the response SHALL contain every top-level field listed above **except** `background` and `isDeleted`

#### Scenario: Background never appears on list or detail
- **GIVEN** a character with a non-empty `background`
- **WHEN** a client requests `GET /campaigns/:cid/characters` or `GET /campaigns/:cid/characters/:id`
- **THEN** no `background` key SHALL appear anywhere in the response body

#### Scenario: Existing species values remain valid
- **GIVEN** a character persisted with `species: "super_mutant"` before this change
- **WHEN** it is read back
- **THEN** the value SHALL be returned unchanged and SHALL resolve to the seeded `super_mutant` species-catalog entry

### Requirement: List characters in campaign
The system SHALL expose `GET /campaigns/:cid/characters` returning all non-deleted characters in the campaign visible to the authenticated user.

#### Scenario: Admin lists all characters
- **WHEN** an admin calls `GET /campaigns/:cid/characters`
- **THEN** the response SHALL contain every non-deleted character in the campaign regardless of owner

#### Scenario: Player lists own characters
- **WHEN** a player calls `GET /campaigns/:cid/characters`
- **THEN** the response SHALL contain only characters where `userId` matches the player's own user id

#### Scenario: Soft-deleted characters excluded
- **WHEN** a character has `isDeleted: true`
- **THEN** it SHALL NOT appear in the list response for any actor

### Requirement: Create character
The system SHALL expose `POST /campaigns/:cid/characters`. A player creates a character assigned to themselves; an admin creates a character assigned to a specified player.

A provided `species` SHALL be validated against `api-species-catalog`: an unknown slug SHALL be rejected with HTTP 400. When `species` is omitted, the character SHALL default to `human`.

#### Scenario: Player creates own character
- **WHEN** a player POSTs `{ name, species? }` to `/campaigns/:cid/characters`
- **THEN** a character SHALL be created with `userId` set from the JWT and all other fields at their defaults

#### Scenario: Admin creates character for a player
- **WHEN** an admin POSTs `{ userId, name, species? }` to `/campaigns/:cid/characters`
- **THEN** a character SHALL be created with `userId` set to the provided value

#### Scenario: Admin omits userId
- **WHEN** an admin POSTs without a `userId` field
- **THEN** the system SHALL return HTTP 400

#### Scenario: userId must belong to a campaign member
- **WHEN** the `userId` in the body does not match any player in the campaign's `players` array
- **THEN** the system SHALL return HTTP 400

#### Scenario: Unknown species slug rejected
- **WHEN** a caller POSTs `{ name, species: "deathclaw" }` and no species-catalog entry has slug `deathclaw`
- **THEN** the system SHALL return HTTP 400

### Requirement: Get character detail
The system SHALL expose `GET /campaigns/:cid/characters/:id` returning the full character document.

#### Scenario: Player accesses own character
- **WHEN** a player requests their own character
- **THEN** the full character document SHALL be returned with HTTP 200

#### Scenario: Player accesses another player's character
- **WHEN** a player requests a character they do not own
- **THEN** the system SHALL return HTTP 404

#### Scenario: Admin accesses any character
- **WHEN** an admin requests any character in the campaign
- **THEN** the full character document SHALL be returned with HTTP 200

### Requirement: Full document update
The system SHALL expose `PUT /campaigns/:cid/characters/:id` replacing the entire mutable character document (all fields except `campaignId`, `userId`, `isDeleted`, `deletedAt`, `createdAt`).

The `background` field is exempt from the "replace" semantics: because it is never delivered on the read paths, a full update that **omits** `background` SHALL leave the stored value **unchanged** (it SHALL NOT be cleared). A full update that **includes** `background` SHALL overwrite it.

#### Scenario: Owner updates own character
- **WHEN** a player PUTs a full character body for a character they own
- **THEN** all mutable fields SHALL be replaced and the updated document returned

#### Scenario: Non-owner player cannot update
- **WHEN** a player PUTs to a character they do not own
- **THEN** the system SHALL return HTTP 404

#### Scenario: PUT without background preserves the stored background
- **GIVEN** a character with `background: "Nato nel Vault 88…"`
- **WHEN** the owner PUTs a full character body that contains no `background` key
- **THEN** the response is HTTP 200 and the stored `background` SHALL still be `"Nato nel Vault 88…"`

#### Scenario: PUT with background overwrites it
- **WHEN** the owner PUTs a full character body containing `background: "Nuova storia"`
- **THEN** the stored `background` SHALL become `"Nuova storia"`

### Requirement: Character background storage and retrieval
The system SHALL expose `GET /campaigns/:cid/characters/:id/background` returning `{ background }` (a string, or `null` when unset) and `PATCH /campaigns/:cid/characters/:id/background` accepting `{ background }` to set or clear it. An empty-string `background` SHALL clear the stored value. Both routes SHALL enforce the same access rules as the other character endpoints: the requesting user SHALL be the character's owner or an admin and a member of the campaign; otherwise the response SHALL be HTTP 404. Unauthenticated requests SHALL be rejected with HTTP 401.

#### Scenario: Owner reads background
- **GIVEN** a character owned by player U with `background: "Storia"`
- **WHEN** U calls `GET /campaigns/:cid/characters/:id/background`
- **THEN** the response is HTTP 200 with body `{ "background": "Storia" }`

#### Scenario: Unset background reads as null
- **GIVEN** a character with no `background`
- **WHEN** the owner reads the background endpoint
- **THEN** the response is HTTP 200 with body `{ "background": null }`

#### Scenario: Owner sets background
- **WHEN** the owner PATCHes `{ "background": "Nuova storia" }`
- **THEN** the response is HTTP 200 and a subsequent `GET .../background` returns `"Nuova storia"`

#### Scenario: Admin reads any character's background
- **WHEN** an admin calls `GET /campaigns/:cid/characters/:id/background` for any character in the campaign
- **THEN** the response is HTTP 200

#### Scenario: Non-owner player denied background
- **WHEN** a player who does not own the character calls either background route
- **THEN** the response is HTTP 404

#### Scenario: Unauthenticated denied background
- **WHEN** a request with no or invalid JWT reaches either background route
- **THEN** the response is HTTP 401

### Requirement: Soft-delete character
The system SHALL expose `DELETE /campaigns/:cid/characters/:id`. Instead of removing the document, it SHALL set `isDeleted: true` and `deletedAt` to the current timestamp.

#### Scenario: Player soft-deletes own character
- **WHEN** a player calls DELETE on their own character
- **THEN** `isDeleted` SHALL be set to `true`, `deletedAt` set to now, and HTTP 200 returned

#### Scenario: Admin soft-deletes any character
- **WHEN** an admin calls DELETE on any character in the campaign
- **THEN** `isDeleted` SHALL be set to `true` and `deletedAt` set to now

#### Scenario: Deleting an already-deleted character
- **WHEN** DELETE is called on a character with `isDeleted: true`
- **THEN** the system SHALL return HTTP 404

### Requirement: Campaign membership enforced
All character endpoints SHALL require the requesting user to be a member of the campaign (player in `campaign.players[]`) or an admin. Unauthenticated requests SHALL be rejected.

#### Scenario: Non-member player attempts access
- **WHEN** a player who is not in `campaign.players` accesses any character endpoint
- **THEN** the system SHALL return HTTP 404

#### Scenario: Unauthenticated request
- **WHEN** a request with no or invalid JWT reaches any character endpoint
- **THEN** the system SHALL return HTTP 401

