## ADDED Requirements

### Requirement: Codex list page reads the current campaign

The route `/codex` SHALL render the codex list. It SHALL NOT carry the campaign id in the URL. Following the quests list (`cms-quests`), the page SHALL host the in-page campaign selector at the top and resolve the active campaign from `CurrentCampaignService.currentCampaign()`. When no campaign is selected, it SHALL render a select-a-campaign empty state and no table.

With a campaign selected, the page SHALL render a PrimeNG `<p-table>` of the entries from `GET /campaigns/:cid/codex`, with these columns in order:

1. **Nome**: opens the entry dialog in edit mode
2. **Tipo**: `Personaggio`, `Luogo`, `Fazione`, `Creatura`
3. **Visibilità**: `Pubblica` badge when `isPublic`, otherwise the names of the characters in `visibleToCharacterIds` (deleted characters visibly marked), or `Nessuno` when empty
4. **Modificabile**: a marker when `isEditable`
5. **Autore**: the creating character's name, or `Master` when `createdByCharacterId` is null
6. **Mappa**: the linked place's name, `—` when unlinked, or a `non trovato` marker when the slug resolves to no place
7. **Aggiornata il**: `updatedAt`
8. **Azioni**: edit and delete, or restore and permanent delete for a deleted entry

Every data column SHALL be sortable, and **Azioni** SHALL NOT be. The page SHALL show a loading state while fetching, and the empty-state message `Nessuna voce nel codex` when nothing matches. The page-head row SHALL carry, aligned right per `cms-backoffice-table-conventions`, the actions `Esporta`, `Importa`, and the primary `Nuova voce`.

#### Scenario: List loads the selected campaign's entries
- **WHEN** campaign `c1` is selected and the admin is on `/codex`
- **THEN** one row per non-deleted entry from `GET /campaigns/c1/codex` is shown with the columns above

#### Scenario: No campaign selected
- **WHEN** the admin is on `/codex` with no current campaign
- **THEN** a select-a-campaign empty state is shown and no table is rendered

#### Scenario: Visibility column names listed characters
- **GIVEN** a private entry visible to `Piper` and `Nick`
- **WHEN** the list renders
- **THEN** its Visibilità cell reads `Piper, Nick`

### Requirement: Codex list filters

The list toolbar SHALL offer:

- a text filter matching `name`, case- and accent-insensitively
- a **Tipo** select with `Tutti i tipi` (default) and the four types
- a **`Mostra eliminate`** checkbox, **unchecked by default**

Filtering SHALL happen client-side over the fetched list. With `Mostra eliminate` unchecked, soft-deleted entries SHALL NOT be shown. With it checked, they SHALL be shown alongside the others, visibly dimmed with an `Eliminata` badge, and with the deleting character's name and `deletedAt` (`Eliminata da Piper · 21/10/2026`).

#### Scenario: Deleted entries hidden by default
- **GIVEN** a campaign with three entries, one soft-deleted
- **WHEN** the list first renders
- **THEN** two rows are shown and `Mostra eliminate` is unchecked

#### Scenario: Showing deleted entries
- **WHEN** the admin checks `Mostra eliminate`
- **THEN** the deleted entry appears dimmed with its `Eliminata` badge and who deleted it

#### Scenario: Type filter narrows the list
- **WHEN** the admin selects `Creatura` in the Tipo select
- **THEN** only `creatura` entries are shown

### Requirement: Codex entry dialog

A single dialog SHALL serve both creation (`Nuova voce`) and editing, with fields:

- **Tipo** (required, select)
- **Nome** (required)
- **Immagine (URL)**, with a contained preview below the field that hides itself if the image fails to load
- **Descrizione** (multi-line, visible to players)
- **Descrizione segreta** (multi-line, labelled as visible only to the master)
- **Pubblica** (toggle)
- **Visibile a**: a multi-select of the current campaign's characters from `GET /campaigns/:cid/characters`, with deleted characters already listed shown marked and removable
- **Modificabile dai giocatori** (toggle, default off on creation)
- **Luogo sulla mappa**: a searchable select over every place from `GET /campaigns/:cid/map` showing each place's name and type, storing its `slug`, with a clear action; a stored slug that matches no place SHALL be shown as `Luogo non trovato (<slug>)`

Submit SHALL be disabled while Nome is empty or Tipo is unset. Creation SHALL issue `POST /campaigns/:cid/codex`; editing SHALL issue `PATCH /campaigns/:cid/codex/:entryId` with only the changed fields. On success the dialog closes and the list refreshes. Textareas SHALL resize only vertically.

#### Scenario: Name is required
- **GIVEN** the create dialog with an empty Nome
- **THEN** the submit action is disabled

#### Scenario: Revealing to specific characters
- **WHEN** the admin selects two characters in Visibile a and saves
- **THEN** the app issues a PATCH carrying `visibleToCharacterIds` with those two ids

#### Scenario: Linking a map place
- **WHEN** the admin picks `Diamond City` in Luogo sulla mappa and saves
- **THEN** the request carries `mapPlaceSlug` set to that place's slug

#### Scenario: Dangling map link is shown
- **GIVEN** an entry whose `mapPlaceSlug` matches no place
- **WHEN** the dialog opens
- **THEN** the field reads `Luogo non trovato (<slug>)` and can be cleared

### Requirement: Delete, restore, and permanent delete

For a non-deleted entry, the **delete** action SHALL open a ConfirmDialog naming the entry and stating that the deletion is permanent. On confirm it SHALL issue `DELETE /campaigns/:cid/codex/:entryId`.

For a soft-deleted entry, the row SHALL offer:

- **Ripristina**: issues `PATCH /campaigns/:cid/codex/:entryId { isDeleted: false }` with no confirmation
- **Elimina definitivamente**: opens a ConfirmDialog, and on confirm issues `DELETE /campaigns/:cid/codex/:entryId`

The edit action SHALL NOT be offered on a soft-deleted entry.

#### Scenario: Permanent delete requires confirmation
- **WHEN** the admin activates delete on an entry
- **THEN** a confirmation opens, and only on confirm is the DELETE issued

#### Scenario: Restoring a player-deleted entry
- **GIVEN** `Mostra eliminate` is checked and a deleted entry is shown
- **WHEN** the admin activates `Ripristina`
- **THEN** the app issues `PATCH … { isDeleted: false }` and the row is shown as a normal entry

### Requirement: Codex export and import

`Esporta` SHALL call `GET /campaigns/:cid/codex/export` and save the result as a pretty-printed JSON file named `codex-<campaign-name>.json`.

`Importa` SHALL open a dialog that accepts a `.json` file. The file SHALL contain a JSON array of entries, the same shape as the export. On confirm, the dialog SHALL issue `POST /campaigns/:cid/codex/import { entries }`. It SHALL then show the summary: `N voci aggiunte, M saltate.` followed by one line per skipped item with its name and reason (`non valida`, `già presente`, `duplicata nel file`). A file that is not valid JSON or not an array SHALL show an error and issue no request. Closing the dialog after an import SHALL refresh the list.

#### Scenario: Export downloads every entry
- **WHEN** the admin activates `Esporta`
- **THEN** a JSON file with every entry of the campaign, deleted ones included, is downloaded

#### Scenario: Import shows the summary
- **WHEN** the admin imports a file in which two entries are new and one already exists
- **THEN** the dialog reports `2 voci aggiunte, 1 saltate.` and names the skipped entry as `già presente`

#### Scenario: Malformed file is rejected locally
- **WHEN** the admin picks a file containing a JSON object instead of an array
- **THEN** an error is shown and no request is issued

### Requirement: Sidebar exposes a Codex entry

The sidebar SHALL include an always-enabled `Codex` entry, placed directly after `Quest`, linking to `/codex` whether or not a campaign is selected.

#### Scenario: Sidebar link is always enabled
- **WHEN** the shell renders with or without a selected campaign
- **THEN** the `Codex` entry is enabled and navigates to `/codex`

### Requirement: Codex API service

A `CodexApiService` SHALL wrap every admin codex endpoint (`list`, `get`, `create`, `update`, `remove`, `restore`, `export`, `import`). It SHALL map responses to typed `CodexEntry` models and expose the campaign-characters lookup and the campaign-places lookup the dialog needs.

#### Scenario: Service calls the campaign-scoped endpoint
- **WHEN** `list("c1")` is invoked
- **THEN** a GET is issued to `/campaigns/c1/codex` and the typed array is returned

#### Scenario: Restore is a PATCH
- **WHEN** `restore("c1", "e1")` is invoked
- **THEN** a PATCH is issued to `/campaigns/c1/codex/e1` with `{ isDeleted: false }`
