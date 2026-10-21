## ADDED Requirements

### Requirement: The popup offers CODEX for a linked visible entry

The description popup SHALL present a `CODEX` action if and only if the place carries a `codexEntryId` **and** that id is among the entries returned by the character's codex read (`GET /campaigns/:cid/characters/:id/codex`). The tab SHALL fetch the codex once per mount, alongside the map, for this purpose. A failed codex fetch SHALL simply leave the action out and SHALL NOT affect the map.

Activating `CODEX` SHALL switch the sheet to `INFO › Codex` opened on that entry's detail, per `pipboy-codex`.

#### Scenario: Linked visible entry offers CODEX
- **GIVEN** a place whose `codexEntryId` names an entry the character can see
- **WHEN** its popup opens
- **THEN** a `CODEX` action is shown, and activating it opens that entry's detail under `INFO › Codex`

#### Scenario: Link to a hidden entry offers nothing
- **GIVEN** a place whose `codexEntryId` names a private entry the character is not listed on
- **WHEN** its popup opens
- **THEN** no `CODEX` action is shown

#### Scenario: Unlinked place offers nothing
- **WHEN** the popup opens for a place with no `codexEntryId`
- **THEN** no `CODEX` action is shown

### Requirement: The map tab can be opened focused on a place

The tab SHALL accept a one-shot intent naming a place `slug`, passed by the sheet when another tab requests it per `pipboy-sheet-navigation`. Once the map and its places have loaded, if the slug names a place in the projected map, the tab SHALL apply the focus operation to it (*A place can be focused, revealing it when hidden*). This centres the place, reveals it if its zone is closed, and opens its popup. If the slug matches no place, the tab SHALL open as it does on an ordinary visit. The intent SHALL be consumed once and SHALL NOT re-apply on later visits to the tab.

#### Scenario: Opening focused from the codex
- **GIVEN** a codex entry linked to `Vault 111`, a place inside a closed zone
- **WHEN** the user activates the entry's `MAPPA` button
- **THEN** the `MAPPA` tab opens with the view moved until `Vault 111` renders, centred, with its popup open

#### Scenario: Intent is one-shot
- **GIVEN** the map was opened focused on a place
- **WHEN** the user leaves the tab and returns to it by tapping `MAPPA`
- **THEN** the map opens as it would on any ordinary visit, and the focus operation is not applied again
