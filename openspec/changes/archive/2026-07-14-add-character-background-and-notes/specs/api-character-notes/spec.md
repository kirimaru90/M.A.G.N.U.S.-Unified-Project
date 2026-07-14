## ADDED Requirements

### Requirement: Character note document structure
A character note SHALL be a document with fields `id` (server-minted string), `characterId` (ObjectId), `campaignId` (ObjectId), `userId` (ObjectId), `title` (string, required), `note` (string), `createdAt`, and `updatedAt`. Notes SHALL live in their own collection, one document per note, and SHALL be scoped to a single character. The response body SHALL expose `{ id, title, note, createdAt, updatedAt }` and SHALL NOT leak the raw `_id` or `__v`.

#### Scenario: Note returned by GET
- **WHEN** a client lists or reads a note
- **THEN** each note object SHALL contain `id`, `title`, `note`, `createdAt`, and `updatedAt`

### Requirement: List notes for a character
The system SHALL expose `GET /campaigns/:cid/characters/:id/notes` returning all notes belonging to that character.

#### Scenario: Owner lists notes
- **WHEN** the owner calls `GET /campaigns/:cid/characters/:id/notes`
- **THEN** the response is HTTP 200 with an array of that character's notes

#### Scenario: Notes are isolated per character
- **GIVEN** character A has a note N and character B (same owner) has none
- **WHEN** the owner lists character B's notes
- **THEN** N SHALL NOT appear in the response

### Requirement: Create note
The system SHALL expose `POST /campaigns/:cid/characters/:id/notes` accepting `{ title, note? }`. A non-empty `title` is required; `note` defaults to an empty string. The server SHALL mint the `id` and set `characterId`, `campaignId`, and `userId` from the parent character.

#### Scenario: Owner creates a note
- **WHEN** the owner POSTs `{ "title": "Contatti", "note": "Parlare con Ada." }`
- **THEN** the response is HTTP 201 with the created note carrying a server-minted `id` and timestamps

#### Scenario: Missing title rejected
- **WHEN** the owner POSTs a body with no `title` (or an empty one)
- **THEN** the response is HTTP 400

### Requirement: Update note
The system SHALL expose `PATCH /campaigns/:cid/characters/:id/notes/:noteId` accepting `{ title?, note? }` and merging the provided fields. A `noteId` that does not belong to the addressed character SHALL yield HTTP 404.

#### Scenario: Owner updates a note
- **WHEN** the owner PATCHes `{ "note": "Aggiornato." }` on an existing note
- **THEN** the response is HTTP 200 with the merged note and a bumped `updatedAt`

#### Scenario: Note from another character not updatable here
- **GIVEN** note N belongs to character A
- **WHEN** a caller PATCHes N under character B's path
- **THEN** the response is HTTP 404

### Requirement: Delete note
The system SHALL expose `DELETE /campaigns/:cid/characters/:id/notes/:noteId` removing the note. A `noteId` not belonging to the addressed character SHALL yield HTTP 404.

#### Scenario: Owner deletes a note
- **WHEN** the owner deletes an existing note
- **THEN** the response is HTTP 200 (or 204) and the note no longer appears in the list

#### Scenario: Deleting an unknown note
- **WHEN** the owner deletes a `noteId` that does not exist under the character
- **THEN** the response is HTTP 404

### Requirement: Notes access control
All notes endpoints SHALL require the requesting user to be the parent character's owner or an admin, and a member of the campaign. Access failures SHALL return HTTP 404 (consistent with the character "404-over-403" convention); unauthenticated requests SHALL return HTTP 401. Notes SHALL be unreachable once the parent character is soft-deleted.

#### Scenario: Non-owner player denied
- **WHEN** a player who does not own the character calls any notes endpoint
- **THEN** the response is HTTP 404

#### Scenario: Admin manages any character's notes
- **WHEN** an admin calls a notes endpoint for any character in the campaign
- **THEN** the request is authorized (subject to the note existing)

#### Scenario: Unauthenticated denied
- **WHEN** a request with no or invalid JWT reaches any notes endpoint
- **THEN** the response is HTTP 401

#### Scenario: Notes of a soft-deleted character are unreachable
- **GIVEN** character A has notes and is then soft-deleted
- **WHEN** the owner lists A's notes
- **THEN** the response is HTTP 404 (the parent character guard denies access)
