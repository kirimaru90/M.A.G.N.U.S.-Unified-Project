## MODIFIED Requirements

### Requirement: User document carries last-campaign and unlock state

Each user document SHALL carry three server-owned fields that record per-user navigation state:

- `lastCampaignId`: a nullable string id of the campaign the user most recently entered a terminal in, or most recently set via the last-selection endpoint. Default `null`. Never accepted from client input on any user-management endpoint.
- `lastCharacterId`: a nullable string id of the character the user most recently selected via the last-selection endpoint. Default `null`. Never accepted from client input on any user-management endpoint.
- `unlockedHiddenIds`: a map keyed by campaign id whose values are arrays of `hiddenId` slugs the user has unlocked via the by-hidden-id terminal route. Default `{}`. Never accepted from client input on any user-management endpoint.

Existing user documents that pre-date this requirement SHALL be treated as having `lastCampaignId == null`, `lastCharacterId == null`, and `unlockedHiddenIds == {}` on read; no migration is required.

User-management endpoints (`GET /users`, `POST /users`, `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id`) SHALL NOT expose any of the three fields in their response bodies and SHALL NOT accept any of them on input. `lastCampaignId` and `unlockedHiddenIds` are written exclusively by the auth and terminals modules per their own specifications; `lastCharacterId` (and, alternatively, `lastCampaignId`) is written exclusively by the self-service last-selection endpoint below.

#### Scenario: New user defaults
- **WHEN** an admin creates a new user via `POST /users`
- **THEN** the persisted user document has `lastCampaignId == null`, `lastCharacterId == null`, and `unlockedHiddenIds == {}`

#### Scenario: User-list response shape unchanged
- **WHEN** an admin calls `GET /users`
- **THEN** the response items contain `id`, `username`, `role`, `createdAt` and do not contain `lastCampaignId`, `lastCharacterId`, or `unlockedHiddenIds`

#### Scenario: User-update ignores new fields on input
- **WHEN** an admin calls `PUT /users/:id` with a body that includes `lastCampaignId`, `lastCharacterId`, or `unlockedHiddenIds`
- **THEN** the response is HTTP 200 and the persisted user document's values for those fields are unchanged

### Requirement: Cascade on campaign deletion

When a campaign is deleted, the system SHALL cascade the deletion across every user document:

- For every user whose `lastCampaignId` equals the deleted campaign's id, the field SHALL be set to `null`, and `lastCharacterId` SHALL also be set to `null` (a character reference cannot outlive the campaign that scopes it).
- For every user, the per-campaign entry at `unlockedHiddenIds.<campaignId>` SHALL be removed (`$unset`).

The cascade SHALL run as part of the campaign-delete operation and SHALL complete before the delete response is returned.

#### Scenario: lastCampaignId cleared on referenced campaign delete
- **GIVEN** user U has `lastCampaignId == "C1"`
- **WHEN** an admin deletes campaign `C1`
- **THEN** user U's `lastCampaignId` is `null` after the delete completes

#### Scenario: lastCharacterId cleared alongside lastCampaignId on referenced campaign delete
- **GIVEN** user U has `lastCampaignId == "C1"` and `lastCharacterId == "char-1"` (a character belonging to campaign `C1`)
- **WHEN** an admin deletes campaign `C1`
- **THEN** user U's `lastCampaignId` and `lastCharacterId` are both `null` after the delete completes

#### Scenario: Per-campaign unlock entry removed on campaign delete
- **GIVEN** user U has `unlockedHiddenIds == { "C1": ["vault-101"], "C2": ["root"] }`
- **WHEN** an admin deletes campaign `C1`
- **THEN** user U's `unlockedHiddenIds` is `{ "C2": ["root"] }` (the `C1` key is gone)

#### Scenario: Unrelated users unaffected
- **GIVEN** user V has `lastCampaignId == "C2"`, `lastCharacterId == "char-2"` (belonging to `C2`), and `unlockedHiddenIds == { "C2": ["s1"] }`
- **WHEN** an admin deletes campaign `C1`
- **THEN** user V's `lastCampaignId`, `lastCharacterId`, and `unlockedHiddenIds` are all unchanged

## ADDED Requirements

### Requirement: Self-service last-selection update

The system SHALL expose `PUT /users/me/last-selection` accepting `{ campaignId, characterId }`, callable by any authenticated user (admin or player) to update their own `lastCampaignId`/`lastCharacterId` pair only.

Both fields SHALL be required together in the request body; a body missing either field SHALL be rejected with HTTP 400. The API SHALL validate that `characterId` identifies a non-deleted character whose own `campaignId` equals the supplied `campaignId`; a mismatch, or a reference to a deleted or non-existent character, SHALL be rejected with HTTP 400. For a non-admin (player) caller, the API SHALL additionally require that the character's `userId` equals the caller's own id; a player referencing a character they do not own SHALL be rejected with HTTP 404 (consistent with the existing 404-over-403 convention used elsewhere for ownership checks).

On success, the API SHALL set the caller's `lastCampaignId` and `lastCharacterId` to the supplied values and respond HTTP 200 with `{ lastCampaignId, lastCharacterId }`.

#### Scenario: Player sets their own last selection
- **WHEN** a player who owns character `char-1` in campaign `C1` calls `PUT /users/me/last-selection` with `{ "campaignId": "C1", "characterId": "char-1" }`
- **THEN** the response is HTTP 200 with `{ "lastCampaignId": "C1", "lastCharacterId": "char-1" }`
- **AND** a subsequent `GET /auth/me` for that user reflects the same values

#### Scenario: Missing characterId rejected
- **WHEN** a caller PUTs `{ "campaignId": "C1" }` with no `characterId`
- **THEN** the response is HTTP 400 and the caller's stored last-selection is unchanged

#### Scenario: campaignId/characterId mismatch rejected
- **GIVEN** character `char-1` belongs to campaign `C1`
- **WHEN** a caller PUTs `{ "campaignId": "C2", "characterId": "char-1" }`
- **THEN** the response is HTTP 400 and the caller's stored last-selection is unchanged

#### Scenario: Player cannot set last-selection to another player's character
- **GIVEN** character `char-9` is owned by a different player
- **WHEN** a player PUTs `{ "campaignId": "C1", "characterId": "char-9" }`
- **THEN** the response is HTTP 404 and the caller's stored last-selection is unchanged

#### Scenario: Admin can set last-selection to any character
- **GIVEN** character `char-9` is owned by a player, in campaign `C1`
- **WHEN** an admin PUTs `{ "campaignId": "C1", "characterId": "char-9" }`
- **THEN** the response is HTTP 200 with `{ "lastCampaignId": "C1", "lastCharacterId": "char-9" }`

#### Scenario: Reference to a soft-deleted character rejected
- **GIVEN** character `char-1` in campaign `C1` has `isDeleted == true`
- **WHEN** its owner PUTs `{ "campaignId": "C1", "characterId": "char-1" }`
- **THEN** the response is HTTP 400 and the caller's stored last-selection is unchanged
