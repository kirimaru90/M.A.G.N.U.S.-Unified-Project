## ADDED Requirements

### Requirement: MSW handlers cover all /users routes used in this slice
The MSW mock layer SHALL include in-memory handlers for the following routes, registered in `src/mocks/handlers/users.handlers.ts` and merged into the main handlers array in `src/mocks/browser.ts`:

- `GET /users` — returns the current in-memory user array
- `POST /users` — creates a new user (generates a UUID `id`), appends to the array, returns the created user with 201
- `GET /users/:id` — returns the matching user or 404
- `PUT /users/:id` — merges any subset of `{ username, role, password }` into the matching user, returns the updated user or 404
- `DELETE /users/:id` — removes the user from the array, returns 204 or 404

The in-memory array SHALL be seeded with at least four fixture users: one admin and at least two players (so the campaign-side picker has multiple options and the campaign assignments panel can render meaningful data on first load). Passwords MAY be stored as cleartext in the in-memory store; they SHALL NOT be returned by `GET /users` or `GET /users/:id` (the response shape SHALL be `{ id, username, role }`).

#### Scenario: GET /users returns the fixture list without passwords
- **WHEN** a client issues `GET /users`
- **THEN** MSW returns an array of at least four users with 200, and each entry contains only `{ id, username, role }` — no `password` field

#### Scenario: POST /users creates and returns a user
- **WHEN** a client issues `POST /users` with `{ username: "newbie", password: "x", role: "player" }`
- **THEN** MSW creates the user with a generated id, appends it to the in-memory array, and returns `{ id, username: "newbie", role: "player" }` with 201

#### Scenario: PUT /users/:id updates the provided fields only
- **WHEN** a client issues `PUT /users/:id` with `{ password: "newpass" }`
- **THEN** MSW updates only the password on the matching user and returns the updated user (without the password field); a subsequent login with the new password SHALL succeed against the auth mock

#### Scenario: PUT /users/:id with username and role
- **WHEN** a client issues `PUT /users/:id` with `{ username: "renamed", role: "admin" }`
- **THEN** MSW updates both fields and returns the updated user; a subsequent `GET /users` reflects the change

#### Scenario: DELETE /users/:id removes the user
- **WHEN** a client issues `DELETE /users/:id`
- **THEN** MSW removes the user from the array and returns 204; a subsequent `GET /users` does not include it

#### Scenario: Unknown user id returns 404
- **WHEN** a client issues any request targeting `/users/:id` with a non-existent id
- **THEN** MSW returns a 404 response

#### Scenario: Deleting a user cascades to campaign assignments
- **WHEN** a client deletes a player user that is currently assigned to one or more campaigns
- **THEN** MSW removes the user from the in-memory campaign-players association store so subsequent `GET /campaigns/:id/players` calls do not return the deleted user
