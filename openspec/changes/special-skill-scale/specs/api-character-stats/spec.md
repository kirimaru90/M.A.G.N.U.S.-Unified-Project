## MODIFIED Requirements

### Requirement: Patch SPECIAL stats
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/special` performing a partial merge of the seven S.P.E.C.I.A.L. attributes. Only attributes present in the body are changed; omitted attributes are left untouched.

An attribute the request does not send SHALL NOT be reset, defaulted, or otherwise written, regardless of how the request payload is deserialized on the server (including when validation materializes the body into an object carrying `undefined`-valued keys for absent attributes). An attribute present with an explicit value SHALL be applied.

Each attribute (strength, perception, endurance, charisma, intelligence, agility, luck) SHALL be a number between 1 and 5 inclusive. SPECIAL is **owner-writable**: the character's owner, and any admin, may write it. A non-owner player's request is rejected by the ownership rules below (HTTP 404), never silently discarded.

Any character persisted with an attribute outside `1..5` (from the earlier `0..8` range) SHALL be clamped into `1..5` by a one-time migration, so no stored character is left invalid under the tightened bounds.

The narrower character-creation rule (exactly 18 points spent, each attribute clamped 1..4) is a client-side build constraint enforced by `pipboy-character-creation`, NOT an invariant of the stored document; the API SHALL NOT enforce it.

#### Scenario: Owner updates a subset of attributes
- **WHEN** the character's owner PATCHes `{ "strength": 4, "luck": 2 }`
- **THEN** only `strength` and `luck` SHALL change, the other five SHALL be unchanged, and HTTP 200 SHALL be returned with the updated `special` object as the response `section` and an empty `ignored` array

#### Scenario: Single-attribute patch never resets the others
- **GIVEN** a character with all seven attributes set to distinct values in range
- **WHEN** the owner PATCHes `{ "strength": 4 }` and nothing else
- **THEN** `strength` SHALL become 4 and the other six attributes SHALL retain their stored values in the persisted record and the response `section`

#### Scenario: Admin updates another player's attributes
- **WHEN** an admin PATCHes `{ "strength": 4 }` on a character owned by another player in the campaign
- **THEN** `strength` SHALL change and HTTP 200 SHALL be returned

#### Scenario: Boundary values accepted
- **WHEN** any provided attribute is exactly `1` or exactly `5`
- **THEN** the system SHALL accept the value and return HTTP 200

#### Scenario: Value out of range
- **WHEN** any provided attribute is below 1 or above 5
- **THEN** the system SHALL return HTTP 400

#### Scenario: Legacy out-of-range value is clamped
- **GIVEN** a character persisted under the former range with `strength: 8`
- **WHEN** the one-time migration runs
- **THEN** that character's `strength` SHALL be clamped to `5`, and a persisted `0` SHALL be clamped to `1`

#### Scenario: Non-owner player cannot write SPECIAL
- **WHEN** a player PATCHes any SPECIAL attribute of a character they do not own
- **THEN** the system SHALL return HTTP 404 and no attribute SHALL change
