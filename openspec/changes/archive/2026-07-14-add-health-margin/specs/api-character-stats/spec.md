## MODIFIED Requirements

### Requirement: Patch status
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/status`. Status comprises two nanoid condition collections plus two scalars.

The body MAY contain any of:
- `positiveConditions`: `{ items, deletedIds }` collection of condition objects
- `negativeConditions`: `{ items, deletedIds }` collection of condition objects
- `criticalState`: boolean (partial-merge scalar)
- `margin`: number ≥ 1 (partial-merge scalar) — the character's **health margin**, the number of condition-weight points its health absorbs before reaching critical

Each condition SHALL have `name` (required), `severity` (enum: minor | major, default minor), and MAY have `description`. Condition ids are server-minted nanoids: id-less items are created, ids in `deletedIds` removed, unknown ids skipped. Status is **player-writable** (owner) and admin.

The character document carries a root-level `margin` (number, minimum `1`) with a **default of `4`**. A character persisted before `margin` existed reads back as `4`, preserving the prior fixed critical threshold. `margin` is seeded from the character's species at creation (per `pipboy-character-creation`) and is freely editable thereafter through this endpoint; the endpoint SHALL reject a `margin` below `1` with HTTP 400. The mutated `status` section returned in the response envelope SHALL include `margin`.

#### Scenario: Owner adds a condition
- **WHEN** the owner PATCHes `{ "negativeConditions": { "items": [ { "name": "Poisoned", "severity": "major" } ] } }`
- **THEN** a condition SHALL be added with a server-assigned id and HTTP 200 returned

#### Scenario: Owner removes a condition
- **WHEN** the owner PATCHes `{ "positiveConditions": { "deletedIds": ["k9l0m1n2"] } }`
- **THEN** the matching condition SHALL be removed and HTTP 200 returned

#### Scenario: Owner flips criticalState
- **WHEN** the owner PATCHes `{ "criticalState": true }`
- **THEN** `criticalState` SHALL become true and the condition arrays SHALL be unchanged

#### Scenario: Owner sets margin
- **WHEN** the owner PATCHes `{ "margin": 6 }`
- **THEN** `margin` SHALL become `6`, the condition arrays SHALL be unchanged, and the returned `status` section SHALL carry `margin: 6`

#### Scenario: Legacy character defaults margin to 4
- **GIVEN** a character document persisted before `margin` existed
- **WHEN** its `status` is read
- **THEN** `margin` SHALL be `4`

#### Scenario: Invalid margin rejected
- **WHEN** the body contains `margin` below `1`
- **THEN** the system SHALL return HTTP 400 and no field SHALL change

#### Scenario: Invalid condition severity
- **WHEN** a condition has a `severity` not in `['minor', 'major']`
- **THEN** the system SHALL return HTTP 400
