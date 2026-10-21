## MODIFIED Requirements

### Requirement: Places are edited in a selection card beside the map

Selecting a place — from its marker or its row — SHALL open a selection card in the column beside the map, carrying its name, type, parent, coordinates, local-map toggle and radius, visibility, description, and codex link. Edits SHALL apply immediately without a separate confirm step.

The place's coordinates SHALL be editable directly in the card as typed latitude and longitude number fields, in addition to the existing map-based repositioning affordances (dragging the marker, or using "sposta" to re-click a position on the map). Committing a typed coordinate SHALL update the place immediately, moving its marker on the map the same way a drag does. A typed coordinate SHALL be rounded to 6 decimal places on commit, matching the precision already applied to dragged and captured coordinates.

The parent selector SHALL exclude the place itself and all of its descendants, so a cycle cannot be authored.

The **Voce del codex** field SHALL be a searchable select over the current campaign's codex entries from `GET /campaigns/:cid/codex`, showing each entry's name and type, with soft-deleted entries listed but marked `eliminata`, and a clear action. Picking an entry SHALL set the place's `codexEntryId`; clearing it SHALL remove the field. A stored `codexEntryId` that matches no entry SHALL be shown as `Voce non trovata` and SHALL be clearable.

The configuration card and the selection card SHALL sit beside the map. The map SHALL keep a stable height of its own, independent of those cards' extent, so that neither expanding the selection card nor collapsing the configuration card resizes it.

#### Scenario: Selecting a place opens its card
- **WHEN** an admin clicks a place's marker
- **THEN** a card appears beside the map with that place's data

#### Scenario: The parent selector cannot author a cycle
- **GIVEN** a place containing a child
- **WHEN** an admin opens that child's parent selector
- **THEN** neither the child itself nor any of its own descendants is offered

#### Scenario: Typing a coordinate repositions the place
- **GIVEN** a selected place
- **WHEN** an admin types a new latitude or longitude into the card and commits it
- **THEN** the place's coordinates update and its marker moves to the new position on the map

#### Scenario: A typed coordinate is rounded on commit
- **GIVEN** a selected place
- **WHEN** an admin commits a typed coordinate with more than 6 decimal places
- **THEN** the stored coordinate is rounded to 6 decimal places

#### Scenario: Map-based repositioning still works alongside typed coordinates
- **GIVEN** a selected place
- **WHEN** an admin drags its marker, or uses "sposta" to re-click a position on the map
- **THEN** the place's coordinates update the same way they did before typed coordinate fields existed

#### Scenario: Linking a place to a codex entry
- **GIVEN** a selected place
- **WHEN** an admin picks the codex entry `Diamond City` in Voce del codex
- **THEN** the place's `codexEntryId` is set to that entry's id

#### Scenario: Dangling codex link is shown and clearable
- **GIVEN** a place whose `codexEntryId` matches no entry
- **WHEN** it is selected
- **THEN** the field reads `Voce non trovata`, and clearing it removes `codexEntryId`

## ADDED Requirements

### Requirement: Place import and export carry the codex link optionally

Exported places SHALL include `codexEntryId` when it is set. Import SHALL keep an incoming place's `codexEntryId` when it is a non-empty string. It SHALL drop any other value, and a place without the field SHALL import with it absent. A file produced before the field existed SHALL therefore import exactly as it did before. The existing duplicate rule (name and coordinates) is unchanged, and `codexEntryId` SHALL NOT take part in it.

#### Scenario: Legacy file imports unchanged
- **WHEN** an admin imports a places file whose entries carry no `codexEntryId`
- **THEN** the places are added exactly as before, with no `codexEntryId`

#### Scenario: Codex link survives a round trip
- **GIVEN** a place with `codexEntryId: "e1"`
- **WHEN** the places are exported and imported into a campaign that lacks that place
- **THEN** the added place carries `codexEntryId: "e1"`
