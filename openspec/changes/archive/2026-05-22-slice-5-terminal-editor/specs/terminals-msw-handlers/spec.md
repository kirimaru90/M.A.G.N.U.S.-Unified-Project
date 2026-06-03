## ADDED Requirements

### Requirement: PUT /terminals/:id updates stored content
The MSW mock layer SHALL handle `PUT /terminals/:id`. The handler SHALL accept a Terminal Content body and, when the id exists in the in-memory store, overwrite that record's `content` with the body, preserve the server-side fields (`id`, `campaignId`, `createdAt`, `views`), set `updatedAt` to the current time, and return the updated content with a 200 status. When the id does not exist, the handler SHALL return 404. The handler SHALL NOT re-validate the body against the Zod schema (the client validator is authoritative in dev).

#### Scenario: Save updates the record
- **WHEN** a `PUT /terminals/:id` request is made with edited content for an existing terminal
- **THEN** the handler stores the new content, bumps `updatedAt`, and a subsequent `GET /terminals/:id` returns the edited content

#### Scenario: Server fields preserved
- **WHEN** content is saved via `PUT /terminals/:id`
- **THEN** the record's `id`, `campaignId`, `createdAt`, and `views` are unchanged from before the save

#### Scenario: Export reflects the save
- **WHEN** content is saved and the terminal is then exported via `POST /terminals/:id/export`
- **THEN** the exported JSON matches the saved content

#### Scenario: Unknown id returns 404
- **WHEN** a `PUT /terminals/:id` request targets an id not in the store
- **THEN** the handler responds with 404 and no record is created

### Requirement: meta.id is server-owned; hiddenId is author-owned content
The mock SHALL treat `meta.id` as a server-owned identifier: it SHALL strip `meta.id` from any create/import/update body before storing, SHALL inject `meta.id` (equal to the record's API id) into the content returned by `GET /terminals/:id` and the `PUT` response, and SHALL omit `meta.id` from the `POST /terminals/:id/export` body. The DTO's `hiddenId` SHALL be sourced from `content.meta.hiddenId` (not a server-generated codename). A non-empty `meta.hiddenId` SHALL be unique within its campaign; create/import/update SHALL return 409 when it collides with another terminal in the same campaign.

#### Scenario: id injected on read, stripped on write
- **WHEN** a terminal is created/imported/updated and then read via `GET /terminals/:id`
- **THEN** the stored content carries no `meta.id`, and the read response includes `meta.id` equal to the record's API id

#### Scenario: Export omits the API id
- **WHEN** a terminal is exported via `POST /terminals/:id/export`
- **THEN** the exported content has no `meta.id` and still carries `meta.hiddenId` when one was authored

#### Scenario: Duplicate hiddenId rejected
- **WHEN** a create/import/update sets a `meta.hiddenId` already used by another terminal in the same campaign
- **THEN** the handler responds with 409 and the store is unchanged

### Requirement: Resolve a terminal by hiddenId
The mock SHALL handle `GET /campaigns/:campaignId/terminals/by-hidden-id/:hiddenId` — the only endpoint keyed on `hiddenId` — returning the matching terminal's DTO, or 404 when no terminal in that campaign has the given `hiddenId`.

#### Scenario: Resolve existing hiddenId
- **WHEN** a `GET /campaigns/:campaignId/terminals/by-hidden-id/:hiddenId` request targets an existing slug in that campaign
- **THEN** the handler returns that terminal's DTO (including its server-owned `id`)

#### Scenario: Unknown hiddenId returns 404
- **WHEN** the requested `hiddenId` does not exist in the campaign
- **THEN** the handler responds with 404
