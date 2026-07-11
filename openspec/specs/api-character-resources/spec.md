# api-character-resources Specification

## Purpose
TBD - created by archiving change add-character-module. Update Purpose after archive.
## Requirements
### Requirement: Patch resources
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/resources` performing a partial merge of the three resource counters. Only counters present in the body are changed; omitted counters are left untouched.

A counter the request does not send SHALL NOT be reset, zeroed, or otherwise written, regardless of how the request payload is deserialized on the server (including when validation materializes the body into an object carrying `undefined`-valued keys for absent counters). A counter present with an explicit value — including `0` — SHALL be applied.

Fields:
- `caps`: number ≥ 0
- `bobbleheads`: number ≥ 0
- `scraps`: number ≥ 0

All three counters are **owner-writable**: the character's owner, and any admin, may write them. (Previously `bobbleheads` was admin-only; the reference design's ZAINO tab presents all three — TAPPI, ROTTAMI, BOBBLEHEAD — as identical owner-editable steppers.)

#### Scenario: Owner updates all three counters
- **WHEN** the character's owner PATCHes `{ "caps": 120, "scraps": 8, "bobbleheads": 5 }`
- **THEN** all three SHALL be updated, HTTP 200 SHALL be returned with the updated `resources` object as the response `section`, and the `ignored` array SHALL be empty

#### Scenario: Owner updates bobbleheads alone
- **WHEN** the character's owner PATCHes `{ "bobbleheads": 5 }`
- **THEN** `bobbleheads` SHALL become 5, `caps` and `scraps` SHALL be unchanged, and HTTP 200 returned

#### Scenario: Single-counter patch never resets the others
- **GIVEN** a character with `caps: 120`, `scraps: 8`, `bobbleheads: 5`
- **WHEN** the owner PATCHes `{ "caps": 130 }` and nothing else
- **THEN** `caps` SHALL become 130 and both `scraps` (8) and `bobbleheads` (5) SHALL be unchanged in the persisted record and the response `section`

#### Scenario: Admin updates another player's resources
- **WHEN** an admin PATCHes `{ "bobbleheads": 5 }` on a character owned by another player in the campaign
- **THEN** `bobbleheads` SHALL become 5 and HTTP 200 returned

#### Scenario: Zero values allowed
- **WHEN** any provided counter is set to 0
- **THEN** the system SHALL accept the value and return HTTP 200

#### Scenario: Negative value
- **WHEN** any provided counter is below 0
- **THEN** the system SHALL return HTTP 400

#### Scenario: Non-owner player cannot write resources
- **WHEN** a player PATCHes the resources of a character they do not own
- **THEN** the system SHALL return HTTP 404

### Requirement: Resources endpoint enforces ownership
`PATCH /campaigns/:cid/characters/:id/resources` SHALL enforce the same ownership rules as all other character endpoints: players may only patch their own characters; admins may patch any character in the campaign.

#### Scenario: Non-owner player calls resources endpoint
- **WHEN** a player PATCHes the resources of a character they do not own
- **THEN** the system SHALL return HTTP 404

