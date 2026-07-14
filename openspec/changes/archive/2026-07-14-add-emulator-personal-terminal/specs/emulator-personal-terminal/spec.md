## ADDED Requirements

### Requirement: Personal terminal list entry (authenticated only)
When the user is authenticated, the terminal list SHALL present a synthetic `[ SCHEDA PERSONALE ]` entry above the campaign's public archives. The entry is not a stored terminal: selecting it SHALL NOT issue `GET /terminals/:id/load` and SHALL NOT be looked up by hidden id. When the user is anonymous, the entry SHALL NOT be rendered.

#### Scenario: Authenticated user sees the entry
- **GIVEN** an authenticated session on a campaign's terminal list
- **WHEN** the list renders
- **THEN** a `[ SCHEDA PERSONALE ]` entry is shown above the public archive entries

#### Scenario: Anonymous user does not see the entry
- **GIVEN** an anonymous session on a public campaign's terminal list
- **WHEN** the list renders
- **THEN** no `[ SCHEDA PERSONALE ]` entry is present

#### Scenario: Selecting the entry does not load a stored terminal
- **WHEN** the authenticated user selects `[ SCHEDA PERSONALE ]`
- **THEN** the emulator opens the character-selection screen and issues no `GET /terminals/:id/load` request

### Requirement: Character-selection screen
Selecting the personal-terminal entry SHALL open a character-selection screen populated from `GET /campaigns/:cid/characters`. Each returned character SHALL be a selectable, keyboard-navigable entry. The screen SHALL render into the existing terminal container (no new `index.html` element). A `[ Indietro ]` control SHALL return to the terminal list.

#### Scenario: Picker lists the player's characters
- **GIVEN** the authenticated player owns two characters in the campaign
- **WHEN** the character-selection screen renders
- **THEN** it shows one selectable entry per character

#### Scenario: Back returns to the terminal list
- **WHEN** the user activates `[ Indietro ]` on the character-selection screen
- **THEN** the terminal list is shown again

### Requirement: Empty and error states
When `GET /campaigns/:cid/characters` returns an empty list, the screen SHALL show `NESSUN PERSONAGGIO` with a working back control instead of an empty selection. When the request fails, the screen SHALL show the network-error treatment used elsewhere in the list flow, with a back control.

#### Scenario: No characters
- **GIVEN** the player owns no characters in the campaign
- **WHEN** the character-selection screen renders
- **THEN** it shows `NESSUN PERSONAGGIO` and a control that returns to the terminal list

#### Scenario: Character fetch fails
- **WHEN** the characters request errors
- **THEN** a network-error message and a back control are shown

### Requirement: Launching the character terminal
Choosing a character SHALL issue `GET /campaigns/:cid/characters/:id/terminal` and hand the returned `{ content, localState, globalState }` payload to the emulator's existing playback (`playTerminalData`), with no special-case rendering. Playback, typewriter, sound, the static per-node headers, and the engine's back/disconnect buttons SHALL behave exactly as for any other terminal. Disconnecting SHALL return to the terminal list. A failed generation request SHALL surface the standard read-error treatment with a return-to-list control.

#### Scenario: Character terminal plays through the normal engine
- **WHEN** the user selects a character
- **THEN** the emulator issues `GET /campaigns/:cid/characters/:id/terminal` and plays the returned terminal, showing the `SCHEDA PERSONALE — <NOME>` start banner and the `Riepilogo` / `Background` / `Note` choices

#### Scenario: Disconnect returns to the list
- **WHEN** the user disconnects from the character terminal
- **THEN** the campaign's terminal list is shown again

#### Scenario: Generation request fails
- **WHEN** the `GET .../terminal` request errors
- **THEN** the standard read-error message and a return-to-list control are shown
