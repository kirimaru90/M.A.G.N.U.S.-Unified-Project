## ADDED Requirements

### Requirement: MSW handlers cover the /campaigns/:id/players sub-resource
The MSW mock layer SHALL extend `src/mocks/handlers/campaigns.handlers.ts` with in-memory handlers for the campaign-players sub-resource:

- `GET /campaigns/:id/players` — returns the array of player users currently assigned to the campaign, each entry shaped as `{ id, username, role }` (no password)
- `POST /campaigns/:id/players` — accepts `{ playerId }`, validates that the campaign exists, validates that a user with that id exists and has `role === 'player'`, then appends the association; returns the assigned user with 201. Re-assigning an already-assigned player SHALL be idempotent (return 201 or 200 without creating a duplicate).
- `DELETE /campaigns/:id/players/:playerId` — removes the association; returns 204 or 404 if the campaign or the assignment does not exist

The in-memory association store SHALL be seeded so at least one fixture campaign has at least one fixture player assigned, so both panels (`<app-user-campaigns-panel>` and `<app-campaign-players-panel>`) render meaningful data on first load.

#### Scenario: GET /campaigns/:id/players returns the seeded assignments
- **WHEN** a client issues `GET /campaigns/:id/players` for a campaign with two assigned players
- **THEN** MSW returns an array of two `{ id, username, role: 'player' }` objects with 200

#### Scenario: POST /campaigns/:id/players assigns a player
- **WHEN** a client issues `POST /campaigns/:id/players` with `{ playerId: "<existing-player-id>" }`
- **THEN** MSW appends the association and returns the assigned user with 201; a subsequent `GET /campaigns/:id/players` includes the player

#### Scenario: POST rejects non-existent players
- **WHEN** a client issues `POST /campaigns/:id/players` with a `playerId` that does not match any user
- **THEN** MSW returns a 404

#### Scenario: POST rejects admins
- **WHEN** a client issues `POST /campaigns/:id/players` with the id of a user whose role is `admin`
- **THEN** MSW returns a 400 (or 422) and does not assign the user

#### Scenario: POST is idempotent for already-assigned players
- **WHEN** a client issues `POST /campaigns/:id/players` for a player that is already assigned to the campaign
- **THEN** MSW returns a 2xx response and `GET /campaigns/:id/players` still contains exactly one entry for that player

#### Scenario: DELETE removes the association
- **WHEN** a client issues `DELETE /campaigns/:id/players/:playerId` for an existing assignment
- **THEN** MSW removes the association and returns 204; a subsequent `GET /campaigns/:id/players` does not include the player

#### Scenario: DELETE on missing assignment returns 404
- **WHEN** a client issues `DELETE /campaigns/:id/players/:playerId` for a `(campaign, player)` pair that has no association
- **THEN** MSW returns a 404
