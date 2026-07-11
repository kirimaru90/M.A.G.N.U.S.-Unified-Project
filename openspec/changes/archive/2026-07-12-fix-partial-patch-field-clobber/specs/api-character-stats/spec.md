## MODIFIED Requirements

### Requirement: Patch SPECIAL stats
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/special` performing a partial merge of the seven S.P.E.C.I.A.L. attributes. Only attributes present in the body are changed; omitted attributes are left untouched.

An attribute the request does not send SHALL NOT be reset, defaulted, or otherwise written, regardless of how the request payload is deserialized on the server (including when validation materializes the body into an object carrying `undefined`-valued keys for absent attributes). An attribute present with an explicit value — including `0` — SHALL be applied.

Each attribute (strength, perception, endurance, charisma, intelligence, agility, luck) SHALL be a number between 0 and 8 inclusive. SPECIAL is **owner-writable**: the character's owner, and any admin, may write it. A non-owner player's request is rejected by the ownership rules below (HTTP 404), never silently discarded.

The narrower character-creation rule (exactly 18 points spent, each attribute clamped 1..4) is a client-side build constraint enforced by `pipboy-character-creation`, NOT an invariant of the stored document; the API SHALL NOT enforce it.

#### Scenario: Owner updates a subset of attributes
- **WHEN** the character's owner PATCHes `{ "strength": 4, "luck": 2 }`
- **THEN** only `strength` and `luck` SHALL change, the other five SHALL be unchanged, and HTTP 200 SHALL be returned with the updated `special` object as the response `section` and an empty `ignored` array

#### Scenario: Single-attribute patch never resets the others
- **GIVEN** a character with all seven attributes set to distinct non-default values
- **WHEN** the owner PATCHes `{ "strength": 4 }` and nothing else
- **THEN** `strength` SHALL become 4 and the other six attributes SHALL retain their stored values in the persisted record and the response `section`

#### Scenario: Admin updates another player's attributes
- **WHEN** an admin PATCHes `{ "strength": 4 }` on a character owned by another player in the campaign
- **THEN** `strength` SHALL change and HTTP 200 SHALL be returned

#### Scenario: Boundary values accepted
- **WHEN** any provided attribute is exactly `0` or exactly `8`
- **THEN** the system SHALL accept the value and return HTTP 200

#### Scenario: Value out of range
- **WHEN** any provided attribute is below 0 or above 8
- **THEN** the system SHALL return HTTP 400

#### Scenario: Non-owner player cannot write SPECIAL
- **WHEN** a player PATCHes any SPECIAL attribute of a character they do not own
- **THEN** the system SHALL return HTTP 404 and no attribute SHALL change
