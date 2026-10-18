# api-quests Specification

## Purpose

Campaign-scoped quests for the API: a `quests` collection (one document per quest) of `story` or `personal` kind, each with an append-only list of stage snapshots; admin CRUD for quests and stages, validation by kind, a `revealedAt` timestamp per stage, and a read-only per-character player projection with two-level (quest and stage) visibility that leaks no trace of hidden stages.

## Requirements

### Requirement: Quest document structure

The API SHALL persist quests in their own `quests` collection, one document per quest, scoped to a campaign. A quest SHALL carry:

- `id` (server-minted string), `campaignId` (ObjectId)
- `kind`: `story` | `personal`
- `characterIds`: array of character ids (meaningful only for `personal`)
- `isPublic`: boolean (meaningful only for `story`)
- `stages`: an ordered, embedded array of stages
- `createdAt`, `updatedAt`

Each stage SHALL carry:

- `id` (server-minted string)
- `title` (string, required, non-empty)
- `description` (string, optional)
- `reward` (string, optional)
- `status`: `in_corso` | `standby` | `completata`
- `isMilestone` (boolean, default `false`)
- `isPublic` (boolean, default `false`)
- `revealedAt` (date or null)
- `createdAt`, `updatedAt`

`title`, `description`, and `reward` SHALL be free text. Stage order SHALL be the array order, which is the order of creation, and SHALL NOT be derived from any timestamp. Responses SHALL NOT leak the raw `_id` or `__v`.

#### Scenario: Admin reads a quest with its stages
- **WHEN** an admin reads a quest
- **THEN** the response contains `id`, `kind`, `characterIds`, `isPublic`, `createdAt`, `updatedAt`, and `stages` in creation order, each stage carrying `id`, `title`, `description`, `reward`, `status`, `isMilestone`, `isPublic`, `revealedAt`, `createdAt`, `updatedAt`

### Requirement: Validation by kind

A `personal` quest SHALL require a non-empty `characterIds` with no duplicates. Every id SHALL name a non-deleted character of the same campaign. A `story` quest SHALL store `characterIds` as an empty array: any provided value SHALL be rejected with HTTP 400. A `personal` quest SHALL store `isPublic` as `false`, and any `isPublic: true` sent for it SHALL be rejected with HTTP 400.

Changing `kind` SHALL be allowed and SHALL be validated against the resulting kind: switching to `personal` requires `characterIds` in the same request, and switching to `story` clears `characterIds`.

#### Scenario: Personal quest without characters is rejected
- **WHEN** an admin creates a `personal` quest with an empty or missing `characterIds`
- **THEN** the response is HTTP 400

#### Scenario: Character from another campaign is rejected
- **WHEN** an admin assigns a personal quest to a character id belonging to a different campaign
- **THEN** the response is HTTP 400 and nothing is stored

#### Scenario: Story quest with characters is rejected
- **WHEN** an admin creates a `story` quest carrying a non-empty `characterIds`
- **THEN** the response is HTTP 400

#### Scenario: Switching a story quest to personal
- **WHEN** an admin PATCHes a story quest with `{ kind: "personal", characterIds: [A] }`
- **THEN** the quest becomes personal for character A and its `isPublic` is `false`

### Requirement: Admin quest CRUD

The API SHALL expose these admin-only endpoints, guarded by `JwtRequiredGuard`, `CampaignAccessGuard`, and `AdminGuard`:

- `GET /campaigns/:cid/quests`: every quest of the campaign, with all stages, regardless of visibility
- `GET /campaigns/:cid/quests/:qid`
- `POST /campaigns/:cid/quests`: accepts the quest header (`kind`, `characterIds?`, `isPublic?`) plus a required `stage` for its first stage, so a quest never exists without a stage
- `PATCH /campaigns/:cid/quests/:qid`: merges `kind`, `characterIds`, `isPublic`
- `DELETE /campaigns/:cid/quests/:qid`

A `qid` that does not belong to the addressed campaign SHALL yield HTTP 404.

#### Scenario: Create a quest with its first stage
- **WHEN** an admin POSTs `{ kind: "story", isPublic: true, stage: { title: "Un segnale strano", status: "in_corso", isPublic: true } }`
- **THEN** the response is HTTP 201 with the quest carrying one stage, whose `revealedAt` is set

#### Scenario: Create without a stage is rejected
- **WHEN** an admin POSTs a quest header with no `stage`
- **THEN** the response is HTTP 400

#### Scenario: Non-admin cannot reach admin routes
- **WHEN** a player calls any `/campaigns/:cid/quests` endpoint
- **THEN** the request is rejected and nothing changes

#### Scenario: Quest of another campaign is not addressable
- **GIVEN** quest Q belongs to campaign C1
- **WHEN** an admin calls `GET /campaigns/C2/quests/Q`
- **THEN** the response is HTTP 404

### Requirement: Admin stage operations

The API SHALL expose admin-only stage endpoints under the same guards:

- `POST /campaigns/:cid/quests/:qid/stages`: appends a stage at the end
- `PATCH /campaigns/:cid/quests/:qid/stages/:sid`: merges `title`, `description`, `reward`, `status`, `isMilestone`, `isPublic` into an existing stage, at any position
- `DELETE /campaigns/:cid/quests/:qid/stages/:sid`: removes a stage, only when it is the **last** stage and the quest has more than one stage

Stages SHALL NOT be reorderable. Deleting a non-last stage SHALL yield HTTP 409. Deleting the only stage SHALL yield HTTP 409: to remove a quest's last remaining stage, the quest itself is deleted. A `sid` that is not in the addressed quest SHALL yield HTTP 404.

#### Scenario: Append a stage
- **GIVEN** a quest with two stages
- **WHEN** an admin POSTs a new stage
- **THEN** the quest has three stages and the new one is last

#### Scenario: Correct a past stage
- **WHEN** an admin PATCHes `{ description: "…" }` on the first of three stages
- **THEN** that stage is updated in place and the order is unchanged

#### Scenario: Only the last stage can be deleted
- **GIVEN** a quest with three stages
- **WHEN** an admin deletes the second stage
- **THEN** the response is HTTP 409 and the quest still has three stages

#### Scenario: The only stage cannot be deleted
- **GIVEN** a quest with one stage
- **WHEN** an admin deletes that stage
- **THEN** the response is HTTP 409

### Requirement: Stage reveal timestamp

A stage's `revealedAt` SHALL be set to the current time the first time the stage is stored with `isPublic: true`, whether on creation or on a later PATCH. It SHALL NOT change on later publications or on edits. Unpublishing SHALL leave `revealedAt` untouched, so a stage that is hidden and then published again keeps its original reveal date.

#### Scenario: Prepared stage is dated when revealed
- **GIVEN** a stage created with `isPublic: false` on Tuesday
- **WHEN** an admin PATCHes it to `isPublic: true` on Saturday
- **THEN** its `revealedAt` is Saturday and its `createdAt` is Tuesday

#### Scenario: Republication keeps the first reveal date
- **GIVEN** a stage revealed on day 1, hidden on day 2
- **WHEN** it is made public again on day 3
- **THEN** its `revealedAt` is still day 1

### Requirement: Player quest read, projected per character

The API SHALL expose `GET /campaigns/:cid/characters/:id/quests`, guarded like the character notes endpoints (`JwtRequiredGuard`, `CampaignAccessGuard`, `CharacterOwnerGuard`): the character's owner or an admin. Access failures yield HTTP 404, unauthenticated requests HTTP 401, and a soft-deleted character is unreachable.

The response SHALL be what the character sees, and SHALL be the same projection for an admin as for the owner. A quest SHALL be included only when:

```
( kind = story    ∧ quest.isPublic )
∨ ( kind = personal ∧ :id ∈ characterIds )
AND the quest has at least one stage with isPublic = true
```

Each included quest SHALL be projected to:

- `id`, `kind`
- `stages`: **only** its public stages, in order, each as `{ id, title, description, reward, status, isMilestone, revealedAt }`
- `current`: the **last public stage**, from which the quest's displayed status and milestone status derive
- `updatedAt`: the most recent `revealedAt` or `updatedAt` among its **public** stages
- `involved` (personal only): the **other** non-deleted characters in `characterIds`, as `{ id, name }` only, excluding the requesting character; an empty array when the character is the sole holder

The projection SHALL NOT include `characterIds`, the quest-level `isPublic`, any hidden stage, any hidden stage's id, the total stage count, or any timestamp influenced by a hidden stage.

#### Scenario: Story quest hidden at quest level
- **WHEN** a player reads quests for their character and a story quest has `isPublic: false`
- **THEN** that quest is absent even if some of its stages are public

#### Scenario: Personal quest of another character is absent
- **GIVEN** a personal quest assigned only to character B
- **WHEN** the owner of character A reads A's quests
- **THEN** the quest is absent

#### Scenario: Quest with only draft stages is absent
- **GIVEN** a public story quest whose every stage has `isPublic: false`
- **WHEN** a player reads quests
- **THEN** the quest is absent

#### Scenario: Draft stage leaves no trace
- **GIVEN** a public story quest whose stages 1 and 3 are public and stage 2 is hidden
- **WHEN** a player reads quests
- **THEN** the quest's `stages` contains exactly stages 1 and 3, `current` is stage 3, and no field reveals that a second stage exists

#### Scenario: Preparing a draft does not touch the player view
- **GIVEN** the player's response for a quest
- **WHEN** an admin appends a hidden stage to that quest
- **THEN** the player's next response for that quest is identical, `updatedAt` included

#### Scenario: Current state follows the last public stage
- **GIVEN** a quest whose last public stage has `status: standby` and `isMilestone: true`, followed by a hidden stage with `status: completata`
- **WHEN** a player reads quests
- **THEN** `current.status` is `standby` and `current.isMilestone` is `true`

#### Scenario: Milestone status can be lost
- **GIVEN** a quest whose current stage has `isMilestone: true`
- **WHEN** an admin appends and publishes a stage with `isMilestone: false`
- **THEN** the player's `current.isMilestone` is `false`, and the earlier stage still carries `isMilestone: true` in `stages`

#### Scenario: Shared personal quest lists the other characters
- **GIVEN** a personal quest assigned to characters A, B, and C
- **WHEN** the owner of A reads A's quests
- **THEN** `involved` is `[{ id: B, name }, { id: C, name }]` and contains no other character fields

#### Scenario: Sole holder sees no involved characters
- **GIVEN** a personal quest assigned only to character A
- **WHEN** the owner of A reads A's quests
- **THEN** `involved` is an empty array

#### Scenario: Soft-deleted co-holder disappears
- **GIVEN** a personal quest assigned to A and B, and B is soft-deleted
- **WHEN** the owner of A reads A's quests
- **THEN** `involved` is empty

#### Scenario: Another player's character is unreachable
- **WHEN** a player reads quests of a character they do not own
- **THEN** the response is HTTP 404

#### Scenario: Unauthenticated read is rejected
- **WHEN** a request without a valid JWT reads a character's quests
- **THEN** the response is HTTP 401

### Requirement: Character deletion and quest assignments

A character's soft deletion SHALL NOT rewrite the quests that reference it. Personal quests SHALL keep the id in `characterIds`, and the player projection SHALL ignore it. Every admin read of a quest SHALL include `characters: [{ id, name, deleted }]`, resolved from `characterIds` in the same order, so the CMS can render names and mark deleted characters without a separate lookup. A personal quest whose every assigned character is deleted SHALL remain readable and editable by an admin.

#### Scenario: Admin read flags deleted assignees
- **GIVEN** a personal quest assigned to A and B, and B is soft-deleted
- **WHEN** an admin reads the quest
- **THEN** `characterIds` still contains B and `characters` carries B with `deleted: true`
