## MODIFIED Requirements

### Requirement: Campaign map document

The API SHALL persist at most one map document per campaign, holding a `config` object and a `places` array.

`config` SHALL carry: `startLat`, `startLng`, `startZoom`, `minZoom`, `maxZoom`, and `bounds` (`{ south, west, north, east }`).

Each place SHALL carry: `slug` (unique within the map), `name`, `type` (one of the `PLACE_TYPES` enum), `lat`, `lng`, `hasLocalMap` (boolean), `radius` (metres; present only when `hasLocalMap` is true), `isPublic` (boolean), `parent` (a sibling place's `slug`, or null), `desc`, optional `icon` (an icon key overriding the type's default), and optional `codexEntryId` (the `id` of a codex entry of the same campaign).

`codexEntryId` SHALL be optional on write and on read. A place stored or sent without it SHALL be valid and SHALL read with the field absent, so map documents and import files that predate the field keep working unchanged. Its value SHALL be validated only as a non-empty string; it SHALL NOT be checked against the codex, so a link to an entry that does not exist, or no longer exists, is a dangling link that clients hide. A place's `codexEntryId` SHALL be returned to non-admins as is, alongside the place's other fields. Whether the linked entry is visible is decided by the codex projection, not by the map.

A campaign with no stored map SHALL read as an empty map — default `config` and `places: []` — rather than 404.

#### Scenario: Campaign without a map reads as empty
- **WHEN** a caller who may see the campaign reads the map of a campaign that has never been authored
- **THEN** the response is HTTP 200 with an empty `places` array and a default `config`

#### Scenario: A place without codexEntryId is still valid
- **WHEN** an admin writes a map whose places carry no `codexEntryId`
- **THEN** the write succeeds and those places read back with no `codexEntryId`

#### Scenario: A place links to a codex entry
- **WHEN** an admin writes a place with `codexEntryId: "e1"`
- **THEN** the write succeeds, and both admins and players reading that public place receive `codexEntryId: "e1"`

#### Scenario: A dangling codex link is accepted
- **WHEN** an admin writes a place whose `codexEntryId` names no existing entry
- **THEN** the write succeeds unchanged
