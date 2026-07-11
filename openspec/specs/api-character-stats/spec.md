# api-character-stats Specification

## Purpose
TBD - created by archiving change add-character-module. Update Purpose after archive.
## Requirements
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

### Requirement: Patch skills
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/skills`. Skills are keyed by a caller-supplied catalog slug (`id`); ids are never server-minted.

The body MAY contain:
- `items`: array of skill objects, each with `id` (catalog slug, required) and `level` (enum: competent | expert | master)
- `deletedIds`: array of catalog slugs to detach

Patch semantics:
- an item whose `id` is not yet on the character SHALL be **inserted**
- an item whose `id` is already on the character SHALL be merged (level updated)
- a slug in `deletedIds` SHALL be detached
- an item missing `id` SHALL cause HTTP 400

Skills are **owner-writable**: the character's owner, and any admin, may write them.

#### Scenario: Owner attaches a new catalog skill
- **WHEN** the character's owner PATCHes `{ "items": [ { "id": "hacking", "level": "expert" } ] }` and the character has no `hacking` skill
- **THEN** `hacking` at level expert SHALL be added and HTTP 200 returned with an empty `ignored` array

#### Scenario: Owner changes an existing skill level
- **WHEN** the character's owner PATCHes `{ "items": [ { "id": "lockpick", "level": "master" } ] }` and the character already has `lockpick`
- **THEN** the `lockpick` level SHALL become master and HTTP 200 returned

#### Scenario: Owner detaches a skill
- **WHEN** the character's owner PATCHes `{ "deletedIds": ["barter"] }`
- **THEN** the `barter` skill SHALL be removed and HTTP 200 returned

#### Scenario: Admin edits another player's skills
- **WHEN** an admin PATCHes skills on a character owned by another player in the campaign
- **THEN** the change SHALL be applied and HTTP 200 returned

#### Scenario: Skill item missing id
- **WHEN** any item in `items` has no `id`
- **THEN** the system SHALL return HTTP 400

#### Scenario: Invalid skill level
- **WHEN** an item has a `level` not in the allowed enum
- **THEN** the system SHALL return HTTP 400

#### Scenario: Non-owner player cannot write skills
- **WHEN** a player PATCHes skills of a character they do not own
- **THEN** the system SHALL return HTTP 404 and no skill SHALL change

### Requirement: Patch perks
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/perks`. Perks are a collection with server-minted nanoid ids.

The body MAY contain:
- `items`: an item with `id` updates the matching perk (unknown id is not applied and is reported in the response `ignored` array with reason `unknown_id`); an item without `id` creates a perk and the server assigns a nanoid
- `deletedIds`: array of ids to remove

Each perk SHALL have `name` (required) and MAY have `description` and `icon`. Perks are **owner-writable**: the character's owner, and any admin, may write them.

#### Scenario: Owner creates a perk
- **WHEN** the character's owner PATCHes `{ "items": [ { "name": "Bloody Mess" } ] }`
- **THEN** a perk SHALL be created with a server-assigned `id` and HTTP 200 returned

#### Scenario: Owner updates a perk
- **WHEN** the character's owner PATCHes `{ "items": [ { "id": "a1b2c3d4", "description": "..." } ] }` for an existing perk id
- **THEN** that perk SHALL be merged and HTTP 200 returned

#### Scenario: Admin edits another player's perks
- **WHEN** an admin PATCHes perks on a character owned by another player in the campaign
- **THEN** the change SHALL be applied and HTTP 200 returned

#### Scenario: Unknown perk id is skipped and reported
- **WHEN** an item references an `id` not present on the character
- **THEN** that item SHALL NOT be applied, the response `ignored` array SHALL contain an entry naming the perks section and that id with reason `unknown_id`, and HTTP 200 SHALL be returned

#### Scenario: Created perk missing name
- **WHEN** an id-less perk item omits `name`
- **THEN** the system SHALL return HTTP 400

#### Scenario: Non-owner player cannot write perks
- **WHEN** a player PATCHes perks of a character they do not own
- **THEN** the system SHALL return HTTP 404 and no perk SHALL change

### Requirement: Patch status
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/status`. Status comprises two nanoid condition collections plus a scalar.

The body MAY contain any of:
- `positiveConditions`: `{ items, deletedIds }` collection of condition objects
- `negativeConditions`: `{ items, deletedIds }` collection of condition objects
- `criticalState`: boolean (partial-merge scalar)

Each condition SHALL have `name` (required), `severity` (enum: minor | major, default minor), and MAY have `description`. Condition ids are server-minted nanoids: id-less items are created, ids in `deletedIds` removed, unknown ids skipped. Status is **player-writable** (owner) and admin.

#### Scenario: Owner adds a condition
- **WHEN** the owner PATCHes `{ "negativeConditions": { "items": [ { "name": "Poisoned", "severity": "major" } ] } }`
- **THEN** a condition SHALL be added with a server-assigned id and HTTP 200 returned

#### Scenario: Owner removes a condition
- **WHEN** the owner PATCHes `{ "positiveConditions": { "deletedIds": ["k9l0m1n2"] } }`
- **THEN** the matching condition SHALL be removed and HTTP 200 returned

#### Scenario: Owner flips criticalState
- **WHEN** the owner PATCHes `{ "criticalState": true }`
- **THEN** `criticalState` SHALL become true and the condition arrays SHALL be unchanged

#### Scenario: Invalid condition severity
- **WHEN** a condition has a `severity` not in `['minor', 'major']`
- **THEN** the system SHALL return HTTP 400

### Requirement: Patch action points
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/action-points` performing a partial merge of the action-point fields. Only fields present are changed.

Fields:
- `paMax`: number ≥ 0
- `paCurrent`: number ≥ 0
- `paTrackedBy`: enum agility | endurance

All three fields are **owner-writable**: the character's owner, and any admin, may write them. (Previously `paMax` and `paTrackedBy` were admin-only; the reference design lets the owner set both from the sheet's editor mode — a `FONTE PA` selector and a `MAX PA` stepper.)

#### Scenario: Owner spends action points
- **WHEN** the character's owner PATCHes `{ "paCurrent": 3 }`
- **THEN** `paCurrent` SHALL become 3 and HTTP 200 returned

#### Scenario: Owner sets paMax and paTrackedBy
- **WHEN** the character's owner PATCHes `{ "paMax": 6, "paTrackedBy": "endurance" }`
- **THEN** both SHALL be updated, HTTP 200 SHALL be returned, and the `ignored` array SHALL be empty

#### Scenario: Admin sets all fields
- **WHEN** an admin PATCHes `{ "paMax": 8, "paCurrent": 8, "paTrackedBy": "agility" }`
- **THEN** all three SHALL be updated and HTTP 200 returned

#### Scenario: Negative value
- **WHEN** `paMax` or `paCurrent` is negative
- **THEN** the system SHALL return HTTP 400

#### Scenario: Invalid paTrackedBy
- **WHEN** `paTrackedBy` is provided and not `agility` or `endurance`
- **THEN** the system SHALL return HTTP 400

#### Scenario: Non-owner player cannot write action points
- **WHEN** a player PATCHes the action points of a character they do not own
- **THEN** the system SHALL return HTTP 404

### Requirement: Section endpoints return the mutated section and an ignored list
Every section PATCH endpoint SHALL respond with an envelope `{ section, ignored }`. The `section` value SHALL be only the mutated section (e.g. the `special` object, the `skills` array, the `status` object), never the full character document. The `ignored` value SHALL be an array listing every input the server dropped while partially applying the request; each entry SHALL identify the section, the offending field key or element id, and a reason code — one of `unauthorized_field`, `unknown_id`, or `disallowed_section`. When nothing was dropped, `ignored` SHALL be an empty array.

When a field is dropped with reason `unauthorized_field`, the returned `section` SHALL reflect the unchanged persisted value of that field, not the rejected input.

Now that every character section is owner-writable, `unauthorized_field` and `disallowed_section` are **not emitted for an owner's or an admin's write to any currently-specified section**; a caller who may not write a section is rejected by ownership (HTTP 404) rather than partially applied. Both codes are RETAINED in the enum, reserved for future field-level restrictions, so the envelope contract stays stable for existing consumers. `unknown_id` remains the only reason code emitted in practice.

#### Scenario: Response contains the section and an ignored array
- **WHEN** any section PATCH succeeds
- **THEN** the response body SHALL be `{ section, ignored }` with HTTP 200, where `section` is the updated section value and `ignored` lists every dropped field or id (an empty array when nothing was dropped)

#### Scenario: Owner write to a formerly admin-only section reports nothing ignored
- **WHEN** the character's owner PATCHes `special`, `skills`, `perks`, `paMax`, `paTrackedBy`, or `bobbleheads` with valid values
- **THEN** the write SHALL be applied and the `ignored` array SHALL be empty

#### Scenario: Unknown id is reported
- **WHEN** a collection PATCH references an element `id` not present on the character
- **THEN** that item SHALL NOT be applied and `ignored` SHALL contain an entry naming that section and id with reason `unknown_id`, with HTTP 200 returned

### Requirement: Section endpoints enforce ownership
All section PATCH endpoints SHALL enforce the same ownership rules as the full character endpoints: players may only patch their own characters; admins may patch any character in the campaign. Field-level authorization (which sections/fields a non-admin may actually write) is applied after ownership, silently discarding unauthorized keys.

#### Scenario: Non-owner player calls a section endpoint
- **WHEN** a player PATCHes a section of a character they do not own
- **THEN** the system SHALL return HTTP 404

