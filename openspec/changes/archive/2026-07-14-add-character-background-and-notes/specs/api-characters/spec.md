## MODIFIED Requirements

### Requirement: Character document structure
A character SHALL be a document with the following top-level fields: `id`, `campaignId` (ObjectId), `userId` (ObjectId), `name` (string, required), `species` (string — a slug present in the species catalog, default: `human`), `special` (embedded object), `skills` (array), `actionPoints` (embedded object), `status` (embedded object), `perks` (array), `inventory` (embedded object), `resources` (embedded object), `background` (string, optional), `isDeleted` (boolean, default: false), `deletedAt` (Date, optional), `createdAt`, `updatedAt`.

The `background` field is persisted with `select: false`: it SHALL NOT be included in the character list response, the character detail response, or any section-`PATCH` response. It is readable only through the dedicated background endpoint (see *Character background storage and retrieval*). All other fields are returned as before, with `isDeleted` omitted from the response body.

#### Scenario: Character document returned by GET
- **WHEN** a client requests `GET /campaigns/:cid/characters/:id`
- **THEN** the response SHALL contain every top-level field listed above **except** `background` and `isDeleted`

#### Scenario: Background never appears on list or detail
- **GIVEN** a character with a non-empty `background`
- **WHEN** a client requests `GET /campaigns/:cid/characters` or `GET /campaigns/:cid/characters/:id`
- **THEN** no `background` key SHALL appear anywhere in the response body

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

## ADDED Requirements

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

#### Scenario: Non-owner player denied
- **WHEN** a player who does not own the character calls either background route
- **THEN** the response is HTTP 404

#### Scenario: Unauthenticated denied
- **WHEN** a request with no or invalid JWT reaches either background route
- **THEN** the response is HTTP 401
