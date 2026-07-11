## MODIFIED Requirements

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
