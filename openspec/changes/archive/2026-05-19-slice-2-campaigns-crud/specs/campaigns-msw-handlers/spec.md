## ADDED Requirements

### Requirement: MSW handlers cover all /campaigns routes used in this slice
The MSW mock layer SHALL include in-memory handlers for the following routes, registered in `src/mocks/handlers/campaigns.handlers.ts` and merged into the main handlers array in `src/mocks/browser.ts`:

- `GET /campaigns` — returns the current in-memory campaign array
- `POST /campaigns` — creates a new campaign (generates a UUID `id`), appends to the array, returns the created campaign
- `GET /campaigns/:id` — returns the matching campaign or 404
- `PUT /campaigns/:id` — merges `{ name, isPublic }` into the matching campaign, returns the updated campaign or 404
- `DELETE /campaigns/:id` — removes the campaign from the array, returns 204 or 404
- `POST /campaigns/:id/activate` — toggles `isActive` on the matching campaign, returns the updated campaign or 404

The in-memory array SHALL be seeded with at least two fixture campaigns (one active/public, one inactive/private) so the list page renders meaningful data on first load.

#### Scenario: GET /campaigns returns the fixture list
- **WHEN** a client issues `GET /campaigns`
- **THEN** MSW returns an array containing at least the seeded fixture campaigns with 200

#### Scenario: POST /campaigns creates and returns a campaign
- **WHEN** a client issues `POST /campaigns` with `{ name: "Test", isActive: false, isPublic: false }`
- **THEN** MSW creates the campaign with a generated id, appends it to the in-memory array, and returns the created object with 201

#### Scenario: PUT /campaigns/:id updates fields
- **WHEN** a client issues `PUT /campaigns/:id` with `{ name: "Renamed" }`
- **THEN** MSW updates the campaign in the array and returns the updated object; a subsequent `GET /campaigns` reflects the change

#### Scenario: DELETE /campaigns/:id removes the campaign
- **WHEN** a client issues `DELETE /campaigns/:id`
- **THEN** MSW removes the campaign from the array and returns 204; a subsequent `GET /campaigns` does not include it

#### Scenario: POST /campaigns/:id/activate toggles isActive
- **WHEN** a client issues `POST /campaigns/:id/activate` for a campaign with `isActive: true`
- **THEN** MSW sets `isActive: false` on the campaign and returns the updated object; a subsequent `GET /campaigns` reflects the change

#### Scenario: Unknown campaign id returns 404
- **WHEN** a client issues any request targeting `campaigns/:id` with a non-existent id
- **THEN** MSW returns a 404 response
