## MODIFIED Requirements

### Requirement: Current session inspection

The API SHALL accept `GET /auth/me` with a bearer token and return the authenticated user's profile.

The response body SHALL be `{ id, username, role, lastCampaignId, lastCharacterId, unlockedHiddenIds }` where:

- `lastCampaignId` is a string campaign id or `null`.
- `lastCharacterId` is a string character id or `null`.
- `unlockedHiddenIds` is a plain object keyed by campaign id, whose values are arrays of `hiddenId` strings. An empty map is serialized as `{}`, never `null`.

If the user's persisted `lastCampaignId` is non-null but no campaign with that id currently exists, the API SHALL `$set` the user's `lastCampaignId` to `null` before responding, and SHALL return `lastCampaignId: null` in the response. This lazy self-heal compensates for any cascade gap and is observable only to the calling user.

The same self-heal SHALL extend to `lastCharacterId`: if the user's persisted `lastCharacterId` is non-null but its referenced character does not exist, is soft-deleted (`isDeleted == true`), or its `campaignId` does not equal the (possibly just-healed) `lastCampaignId`, the API SHALL `$set` the user's `lastCharacterId` to `null` before responding, and SHALL return `lastCharacterId: null`. This guarantees that any non-null `lastCharacterId` returned by this endpoint is always safe for a caller to load directly, without the caller needing to independently re-validate it.

The endpoint SHALL NOT mutate `unlockedHiddenIds` (cleanup of stale unlock entries happens on the by-hidden-id terminal route, not here).

#### Scenario: Authenticated me call
- **WHEN** `GET /auth/me` is called with a valid bearer token for user `u1`
- **THEN** the response is HTTP 200 with body `{ id, username, role, lastCampaignId, lastCharacterId, unlockedHiddenIds }` for user `u1`

#### Scenario: User with no last campaign, no last character, and no unlocks
- **GIVEN** user `u1` has `lastCampaignId == null`, `lastCharacterId == null`, and `unlockedHiddenIds == {}`
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body contains `lastCampaignId: null`, `lastCharacterId: null`, and `unlockedHiddenIds: {}`

#### Scenario: User with unlocks across multiple campaigns
- **GIVEN** user `u1` has `unlockedHiddenIds == { "C1": ["vault-101"], "C2": ["root", "back-door"] }`
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body's `unlockedHiddenIds` equals `{ "C1": ["vault-101"], "C2": ["root", "back-door"] }`

#### Scenario: Stale lastCampaignId is lazily cleared
- **GIVEN** user `u1` has `lastCampaignId == "C-gone"` and no campaign with id `"C-gone"` exists
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body contains `lastCampaignId: null`
- **AND** the persisted user document's `lastCampaignId` is now `null`

#### Scenario: Valid lastCampaignId is returned as-is
- **GIVEN** user `u1` has `lastCampaignId == "C1"` and campaign `C1` exists
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body contains `lastCampaignId: "C1"`
- **AND** the persisted user document's `lastCampaignId` is still `"C1"`

#### Scenario: Stale lastCharacterId (character deleted) is lazily cleared
- **GIVEN** user `u1` has `lastCharacterId == "char-gone"` and no character with id `"char-gone"` exists
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body contains `lastCharacterId: null`
- **AND** the persisted user document's `lastCharacterId` is now `null`

#### Scenario: Stale lastCharacterId (soft-deleted character) is lazily cleared
- **GIVEN** user `u1` has `lastCharacterId == "char-1"`, and character `char-1` has `isDeleted == true`
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body contains `lastCharacterId: null`

#### Scenario: lastCharacterId cleared when its campaign no longer matches lastCampaignId
- **GIVEN** user `u1` has `lastCampaignId == "C2"` and `lastCharacterId == "char-1"`, where character `char-1` belongs to campaign `C1` (not `C2`)
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body contains `lastCharacterId: null`
- **AND** `lastCampaignId` is still returned as `"C2"`

#### Scenario: Valid lastCharacterId is returned as-is
- **GIVEN** user `u1` has `lastCampaignId == "C1"` and `lastCharacterId == "char-1"`, where character `char-1` belongs to campaign `C1` and is not deleted
- **WHEN** `GET /auth/me` is called with `u1`'s token
- **THEN** the response body contains `lastCharacterId: "char-1"`
- **AND** the persisted user document's `lastCharacterId` is still `"char-1"`

#### Scenario: Unauthenticated me call
- **WHEN** `GET /auth/me` is called without a bearer token
- **THEN** the response is HTTP 401

#### Scenario: Expired token
- **WHEN** `GET /auth/me` is called with a token whose `exp` is in the past
- **THEN** the response is HTTP 401
