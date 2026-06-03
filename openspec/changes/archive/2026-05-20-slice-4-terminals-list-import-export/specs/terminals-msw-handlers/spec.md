## ADDED Requirements

### Requirement: MSW handlers cover all terminal routes used in this slice
The MSW mock layer SHALL register handlers for the following routes, registered in `src/mocks/browser.ts` via a module `src/mocks/handlers/terminals.handlers.ts`:

- `GET /campaigns/:campaignId/terminals`
- `POST /campaigns/:campaignId/terminals`
- `POST /campaigns/:campaignId/terminals/import`
- `GET /terminals/:id`
- `DELETE /terminals/:id`
- `POST /terminals/:id/export`

#### Scenario: Handlers registered with the mock service worker
- **WHEN** the application boots with MSW enabled
- **THEN** none of the above routes fall through to the real network; each is served by an in-memory handler

### Requirement: In-memory store seeded with fixture terminals
On MSW initialization, the terminals store SHALL be seeded with at least two fixture terminals belonging to the first fixture campaign defined by `campaigns.handlers.ts`. The fixtures SHALL each satisfy `TerminalContentSchema`.

#### Scenario: Seeded list returns at least two terminals for first campaign
- **WHEN** the client calls `GET /campaigns/<first-fixture-id>/terminals` against MSW
- **THEN** the response is an array containing at least two terminals, each conforming to `TerminalContentSchema`

### Requirement: List rows expose codename, timestamps, and views
The `GET /campaigns/:campaignId/terminals` handler SHALL return each terminal as a list-view row (`TerminalDto`) carrying, in addition to `id` and `meta`: a `hiddenId` (codename) string, a `createdAt` timestamp, an `updatedAt` timestamp, and an optional `views` count. These are list-view sidecar fields stored alongside the canonical `TerminalContent`, not part of `TerminalContentSchema`. Seeded fixtures SHALL include at least one terminal with a defined `views` value and at least one with `views` left undefined.

#### Scenario: List rows carry the sidecar fields
- **WHEN** the client calls `GET /campaigns/<first-fixture-id>/terminals` against MSW
- **THEN** each returned row includes `hiddenId`, `createdAt`, and `updatedAt`
- **AND** at least one seeded row omits `views` while at least one provides a numeric `views`

### Requirement: Create handler assigns an id and stores under the campaign
The `POST /campaigns/:campaignId/terminals` handler SHALL accept any body conforming to `TerminalContentSchema`, assign a fresh id (via `crypto.randomUUID()`) and a generated `hiddenId` codename, set `createdAt` and `updatedAt` to the current time and `views` to `0`, associate it with the path's `campaignId`, append it to the in-memory store, and return 201 with the stored entry.

#### Scenario: Create returns 201 with stored body
- **WHEN** the client POSTs a valid stub to `/campaigns/c1/terminals`
- **THEN** the response status is 201 and the returned body has an `id` distinct from the request body's `meta.id`
- **AND** a subsequent `GET /campaigns/c1/terminals` includes the new entry

### Requirement: Import handler accepts a full terminal verbatim
The `POST /campaigns/:campaignId/terminals/import` handler SHALL behave identically to the create handler but accept the full terminal content as the request body without further validation. The in-memory record SHALL always be assigned a fresh server-side id, regardless of the request body's `meta.id`.

#### Scenario: Import assigns a new id even when meta.id is present
- **WHEN** the client POSTs a valid terminal with `meta.id = "demo"` to `/campaigns/c1/terminals/import`
- **THEN** the response 201 includes a `meta.id` distinct from `"demo"` (assigned server-side)
- **AND** a subsequent `GET /campaigns/c1/terminals` includes the new entry alongside any existing ones

### Requirement: Detail and delete handlers operate by terminal id
- `GET /terminals/:id` SHALL return the stored content for the matching id, or 404 if absent.
- `DELETE /terminals/:id` SHALL remove the matching id from the store and respond 204, or 404 if absent.

#### Scenario: Detail returns stored content
- **WHEN** the client calls `GET /terminals/<existing-id>`
- **THEN** the response status is 200 and the body matches the stored `TerminalContent`

#### Scenario: Detail returns 404 for unknown id
- **WHEN** the client calls `GET /terminals/does-not-exist`
- **THEN** the response status is 404

#### Scenario: Delete removes and returns 204
- **WHEN** the client calls `DELETE /terminals/<existing-id>`
- **THEN** the response status is 204 and a subsequent `GET /terminals/<existing-id>` returns 404

### Requirement: Export handler returns the stored content
The `POST /terminals/:id/export` handler SHALL respond 200 with the stored `TerminalContent` as the JSON body, or 404 if the id is unknown.

#### Scenario: Export returns the stored body
- **WHEN** the client POSTs to `/terminals/<existing-id>/export`
- **THEN** the response body equals the same object returned by `GET /terminals/<existing-id>`

#### Scenario: Export of unknown id returns 404
- **WHEN** the client POSTs to `/terminals/does-not-exist/export`
- **THEN** the response status is 404
