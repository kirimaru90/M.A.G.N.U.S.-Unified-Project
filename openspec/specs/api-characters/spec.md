# api-characters Specification

## Purpose
TBD - created by archiving change add-character-module. Update Purpose after archive.
## Requirements
### Requirement: Character document structure
A character SHALL be a document with the following top-level fields: `id`, `campaignId` (ObjectId), `userId` (ObjectId), `name` (string, required), `species` (string — a slug present in the species catalog, default: `human`), `special` (embedded object), `skills` (array), `actionPoints` (embedded object), `status` (embedded object), `perks` (array), `inventory` (embedded object), `resources` (embedded object), `isDeleted` (boolean, default: false), `deletedAt` (Date, optional), `createdAt`, `updatedAt`.

`species` was previously a fixed enum (`human | ghoul | super_mutant | robot`). It is now a slug validated against `api-species-catalog` on write, so that a species' `permesso`/`svantaggio` copy and its `tagSkillBudget` can be authored in the CMS rather than hardcoded. The four historical values are the catalog's seeded slugs, so all existing persisted documents remain valid and no migration is required.

#### Scenario: Character document returned by GET
- **WHEN** a client requests `GET /campaigns/:cid/characters/:id`
- **THEN** the response SHALL contain all top-level fields listed above with `isDeleted` omitted from the response body

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

#### Scenario: Owner updates own character
- **WHEN** a player PUTs a full character body for a character they own
- **THEN** all mutable fields SHALL be replaced and the updated document returned

#### Scenario: Non-owner player cannot update
- **WHEN** a player PUTs to a character they do not own
- **THEN** the system SHALL return HTTP 404

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

