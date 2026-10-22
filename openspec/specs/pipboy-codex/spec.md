# pipboy-codex Specification

## Purpose

Pip-Boy codex under INFO › Codex: entry list and detail, editor popup, confirmed soft deletion, opening on a given entry, and precached codex scripts.

## Requirements
### Requirement: Codex list under INFO › Codex

The `INFO › Codex` subtab SHALL render the character's codex from `GET /campaigns/:cid/characters/:id/codex`, following the per-tab lazy-fetch pattern: render synchronously, paint a skeleton, and fill in when the fetch resolves. The client SHALL NOT filter by visibility, because the API returns only what the character may see.

Above the list the subtab SHALL show, in order:

1. a search box (`pb-input`, placeholder `cerca…`)
2. a type select (`pb-select`) with `Tutti i tipi` (default), `Personaggi`, `Luoghi`, `Fazioni`, `Creature`
3. when the sheet is editable, a `+ NUOVA VOCE` dashed block button

Entries SHALL be grouped by `type` in this order: `PERSONAGGI`, `LUOGHI`, `FAZIONI`, `CREATURE`. A group with no entry passing the current search and type filter SHALL NOT render. Each group head SHALL show the label and its count (`▸ LUOGHI (5)`) and SHALL toggle the group open and closed. Groups SHALL be **collapsed by default**. While the search box is non-empty, every rendered group SHALL be shown expanded regardless of its toggle state. Clearing the search SHALL restore the toggle states. Within a group, entries SHALL be ordered by name, Italian-collated, case- and accent-insensitive.

Search SHALL match `name`, case- and accent-insensitively. Each row SHALL show the name, and a `PUBBLICA` marker when `isPublic`. Activating a row SHALL open the entry detail.

With no entries at all, the subtab SHALL show `Nessuna voce nel codex`. With entries but no match for the current filters, it SHALL show `Nessun risultato`. A failed fetch SHALL show a CRT-consistent Italian error message, never a crash or a blank pane.

The search text, type filter, and group toggle states SHALL be preserved when returning from the detail view.

#### Scenario: Empty categories are hidden
- **GIVEN** a codex with two `luogo` entries and one `fazione` entry
- **WHEN** the user opens `INFO › Codex`
- **THEN** only the `▸ LUOGHI (2)` and `▸ FAZIONI (1)` heads render, both collapsed

#### Scenario: A group expands on demand
- **WHEN** the user activates the `LUOGHI` head
- **THEN** its two rows are shown

#### Scenario: Search auto-expands matching groups
- **GIVEN** every group collapsed
- **WHEN** the user types `dia` in the search box
- **THEN** only groups with a matching entry render, expanded, showing only the matching rows

#### Scenario: Type filter narrows to one category
- **WHEN** the user selects `Creature` in the type select
- **THEN** only the `CREATURE` group can render

#### Scenario: Empty state
- **WHEN** the API returns no entries
- **THEN** the subtab shows `Nessuna voce nel codex`

### Requirement: Codex entry detail

Opening an entry SHALL replace the list in the content pane, like the quest detail, and SHALL offer a back control (`◀`) returning to the list. It SHALL show, in order:

1. **Image**, when `imageUrl` is present: rendered at the top, centred, with `object-fit: contain`, a maximum width of the pane, and a maximum height of 40% of the viewport height, so its proportions are preserved and it is never cropped. If the image fails to load, its block SHALL be removed with no broken-image icon.
2. **Header**: the name, the type label (`PERSONAGGIO`, `LUOGO`, `FAZIONE`, `CREATURA`), and `PUBBLICA` when `isPublic`
3. **Map line**, when `mapPlaceSlug` resolves to a place in the character's map (`GET /campaigns/:cid/map`): `Luogo: <place name>` and a `MAPPA` button. When it does not resolve, neither SHALL render.
4. **Description**, rendered as text, when present

When the entry is `isEditable` and the sheet is editable, the detail SHALL also offer `MODIFICA` and `ELIMINA`. When it is not, no edit control SHALL render.

Activating `MAPPA` SHALL switch to the `MAPPA` tab focused on that place, per `pipboy-map-tab`.

#### Scenario: Image is contained and capped
- **GIVEN** an entry with a tall portrait image
- **WHEN** the detail opens
- **THEN** the image renders at the top uncropped, no taller than 40% of the viewport and no wider than the pane

#### Scenario: Broken image disappears
- **GIVEN** an entry whose `imageUrl` returns 404
- **WHEN** the detail opens
- **THEN** no image block or broken-image icon is shown, and the header is the first thing in the pane

#### Scenario: Linked place jumps to the map
- **GIVEN** an entry linked to a public place `Diamond City`
- **WHEN** the user activates `MAPPA`
- **THEN** the sheet switches to `MAPPA` with `Diamond City` focused and its popup open

#### Scenario: Hidden place offers no map button
- **GIVEN** an entry whose `mapPlaceSlug` names a non-public place
- **WHEN** the detail opens
- **THEN** no `Luogo:` line and no `MAPPA` button render

#### Scenario: Master entry is read-only
- **GIVEN** a visible entry with `isEditable: false`
- **WHEN** the owner opens it
- **THEN** neither `MODIFICA` nor `ELIMINA` is shown

#### Scenario: Back returns to the list
- **WHEN** the user activates `◀`
- **THEN** the list is shown again with its search, type filter, and group states preserved

### Requirement: Codex editor popup

`+ NUOVA VOCE` and `MODIFICA` SHALL open a popup in the same style as the quest editor, titled `NUOVA VOCE` or `MODIFICA VOCE`, with fields:

- **Tipo**: toggle buttons for the four types (required)
- **Nome** (required)
- **Immagine (URL)**
- **Descrizione** (multi-line)
- **Pubblica**: a toggle
- **Luogo sulla mappa**: shows the linked place's name or `Nessuno`. Activating it SHALL open the catalog picker over the places of the character's map, searchable by name and showing each place's name. Picking a place stores its `slug`. A clear control SHALL remove the link.

Persistence SHALL be explicit through `SALVA`. Saving SHALL be refused, with the popup kept open, while Nome is empty or Tipo is unset. Closing with unsaved changes SHALL ask first, as the quest editor does. Creating SHALL issue `POST …/codex`; editing SHALL issue `PATCH …/codex/:entryId` with only the changed fields. On success the popup closes and the entry is updated in place: a newly created entry's detail opens, and an edited entry's detail is repainted.

Turning `Pubblica` **off** on an entry the character does not create (`isOwn` false) SHALL first ask `Rendendola privata potresti non vederla più. Continuare?`. If the API answers HTTP 204, the client SHALL remove the entry from the list and return to it.

#### Scenario: Creating an entry
- **WHEN** the owner opens `+ NUOVA VOCE`, picks `Creatura`, types `Mirelurk`, and saves
- **THEN** the app issues `POST …/codex { type: "creatura", name: "Mirelurk", isPublic: false }` and opens the new entry's detail

#### Scenario: Name is required
- **WHEN** the user saves with an empty Nome
- **THEN** no request is issued and the popup stays open

#### Scenario: Linking a place through the picker
- **WHEN** the user activates Luogo sulla mappa and picks `Vault 111`
- **THEN** the field shows `Vault 111`, and saving sends that place's slug as `mapPlaceSlug`

#### Scenario: Making private someone else's public entry warns first
- **GIVEN** a public, editable entry created by another character
- **WHEN** the user turns `Pubblica` off and saves
- **THEN** a confirmation is shown, and only on confirm is the PATCH issued

### Requirement: Codex deletion is confirmed and soft

`ELIMINA` SHALL open the shared confirm dialog `Eliminare questa voce?`. Confirming SHALL issue `DELETE …/codex/:entryId`, remove the entry from the list, and return to the list. Cancelling SHALL leave the detail unchanged. The Pip-Boy SHALL NOT offer any restore. Restoring is a CMS operation.

#### Scenario: Delete asks first
- **WHEN** the user activates `ELIMINA` on an editable entry
- **THEN** the dialog `Eliminare questa voce?` opens, and only on confirm is the DELETE issued and the entry removed from the list

### Requirement: Codex can be opened on a given entry

The subtab SHALL accept a one-shot intent naming an entry id. It is passed by the sheet when another tab requests it, per `pipboy-sheet-navigation`. When the intent's entry is present in the fetched codex, the subtab SHALL open directly on its detail. When it is not present, the subtab SHALL show the list.

#### Scenario: Opening from the map
- **GIVEN** the map popup's `CODEX` button for entry `E`
- **WHEN** the user activates it
- **THEN** the sheet switches to `INFO › Codex` showing `E`'s detail, and `◀` returns to the codex list

### Requirement: Codex scripts are precached

`src/tabs/codex.js`, `src/tabs/codex-editor.js`, and `src/api/codex.js` SHALL be listed in the service worker's precached shell, so the subtab loads offline like the quest subtab.

#### Scenario: Codex shell is cached
- **WHEN** the service worker installs
- **THEN** the three codex scripts are in its shell cache

