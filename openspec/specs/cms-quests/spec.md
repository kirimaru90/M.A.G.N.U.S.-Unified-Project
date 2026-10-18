# cms-quests Specification

## Purpose

The CMS Quest section, modelled on Terminali: a quests list bound to the current campaign, a sidebar entry, quest creation, a detail page editing the quest header and its stages through a stage dialog, delete with confirmation, and the `QuestsApiService`.

## Requirements

### Requirement: Quests list page reads the current campaign

The route `/quests` SHALL render the quests list. It SHALL NOT carry the campaign id in the URL. Following the terminals list (`cms-terminals-crud`), the page SHALL host the in-page campaign selector at the top and resolve the active campaign from `CurrentCampaignService.currentCampaign()`. When no campaign is selected, it SHALL render an empty state prompting the admin to select a campaign, and SHALL NOT render the table.

With a campaign selected, the page SHALL render a PrimeNG `<p-table>` of every quest from `GET /campaigns/:cid/quests`, with these columns in order:

1. **Titolo**: the title of the quest's **last** stage, whether public or not, linking to the detail page
2. **Tipo**: `Storia` or `Personale`
3. **Personaggi**: for personal quests, the assigned characters' names (deleted ones visibly marked); `—` for story quests
4. **Stato**: the last stage's status (`In corso`, `Standby`, `Completata`)
5. **Milestone**: a ★ marker when the last stage has `isMilestone`
6. **Pubblica**: the quest-level public badge for story quests; `—` for personal quests
7. **Stadi**: stage count, with the number of hidden (draft) stages when any, e.g. `3 (1 bozza)`
8. **Aggiornata il**: the quest's `updatedAt`
9. **Azioni**: open detail, delete

Every data column SHALL be sortable, and **Azioni** SHALL NOT be. The page SHALL show a loading state while the fetch is in flight and an empty-state message (`Nessuna quest in questa campagna`) for an empty list. A `Nuova quest` primary action SHALL sit in the page-head row, aligned right, per `cms-backoffice-table-conventions`.

#### Scenario: List loads the selected campaign's quests
- **WHEN** campaign `c1` is selected and the admin is on `/quests`
- **THEN** one row per quest from `GET /campaigns/c1/quests` is shown with the columns above

#### Scenario: No campaign selected
- **WHEN** the admin is on `/quests` with no current campaign
- **THEN** a select-a-campaign empty state is shown and no table is rendered

#### Scenario: List reflects the latest stage, not the player view
- **GIVEN** a quest whose last stage is a hidden draft titled `Il tradimento`
- **WHEN** the list renders
- **THEN** its Titolo is `Il tradimento` and its Stadi cell mentions the draft

#### Scenario: Columns are sortable
- **WHEN** the admin clicks the Stato header
- **THEN** rows reorder by status, toggling direction on repeated clicks

### Requirement: Sidebar exposes a Quest entry

The sidebar SHALL include an always-enabled `Quest` entry linking to `/quests`, regardless of whether a campaign is selected.

#### Scenario: Sidebar link is always enabled
- **WHEN** the shell renders with or without a selected campaign
- **THEN** the `Quest` entry is enabled and navigates to `/quests`

### Requirement: Create a quest

`Nuova quest` SHALL open a dialog collecting the header and the first stage:

- **Tipo**: `Storia` / `Personale`
- **Pubblica**: shown only for `Storia`
- **Personaggi**: a multi-select of the current campaign's characters, from `GET /campaigns/:cid/characters`, shown and required only for `Personale`
- the first stage's fields: Titolo (required), Descrizione, Ricompensa (multi-line free text), Stato (default `In corso`), Milestone, Stadio pubblico

On submit, the dialog SHALL call `POST /campaigns/:cid/quests` for the current campaign. On success it SHALL close and navigate to the new quest's detail page. Submit SHALL be disabled while the title is empty, or while `Personale` is chosen with no character selected.

#### Scenario: Creating a personal quest requires characters
- **GIVEN** the create dialog with `Personale` selected and no character chosen
- **THEN** the submit action is disabled

#### Scenario: Public toggle only for story quests
- **WHEN** the admin switches Tipo to `Personale`
- **THEN** the quest-level Pubblica control is hidden and the Personaggi multi-select appears

#### Scenario: Successful creation opens the detail
- **WHEN** the admin submits a valid story quest
- **THEN** the app issues `POST /campaigns/:cid/quests` and lands on that quest's detail page

### Requirement: Quest detail page

The route `/quests/:questId` SHALL show a title header with the last stage's title and a delete action, then two sections.

**Intestazione** edits `kind`, `isPublic` (story only), and `characterIds` (personal only, same multi-select as creation, with deleted assignees shown marked and removable). It saves through `PATCH /campaigns/:cid/quests/:qid`.

**Stadi** lists the stages **newest first**. Each row shows its position number, title, status, ★ when milestone, a `Bozza` badge when hidden, `createdAt`, and `revealedAt` when set. Each row offers `Modifica`, and only the last stage also offers `Elimina`, and only when the quest has more than one stage. A `+ Nuovo stadio` action opens the stage dialog.

#### Scenario: Stages are listed newest first with draft badges
- **GIVEN** a quest with three stages, the last of which is hidden
- **WHEN** the detail page renders
- **THEN** stage 3 appears first with a `Bozza` badge, followed by stages 2 and 1

#### Scenario: Delete offered only on the last stage
- **GIVEN** a quest with three stages
- **WHEN** the detail page renders
- **THEN** only stage 3's row offers `Elimina`

#### Scenario: Single-stage quest offers no stage delete
- **GIVEN** a quest with one stage
- **WHEN** the detail page renders
- **THEN** no stage row offers `Elimina`

#### Scenario: Header changes are saved
- **WHEN** the admin adds a character to a personal quest's Personaggi and saves
- **THEN** the app issues `PATCH /campaigns/:cid/quests/:qid { characterIds }` with the updated list

### Requirement: Stage dialog

A single stage dialog SHALL serve both creation and editing, with fields Titolo (required), Descrizione, Ricompensa, Stato, Milestone, and Stadio pubblico.

- **New stage**: the dialog SHALL open **pre-filled with the last stage's** title, description, reward, status, and milestone. `Stadio pubblico` SHALL default to `false`, so a new stage starts as a draft. Saving issues `POST .../stages`.
- **Edit**: the dialog SHALL open with that stage's values. Saving issues `PATCH .../stages/:sid` with only the changed fields.

Turning `Stadio pubblico` off on the stage that is currently the **last public** one SHALL ask for confirmation (`I giocatori torneranno a vedere lo stadio precedente. Continuare?`) before saving.

#### Scenario: New stage is pre-filled from the last one
- **GIVEN** a quest whose last stage reads `La porta si apre`, status `In corso`, milestone on
- **WHEN** the admin opens `+ Nuovo stadio`
- **THEN** the dialog shows those values with `Stadio pubblico` off

#### Scenario: Unpublishing the current stage asks first
- **GIVEN** stage 3 is the last public stage
- **WHEN** the admin edits it, turns `Stadio pubblico` off, and saves
- **THEN** a confirmation appears, and the PATCH is issued only on confirm

#### Scenario: Publishing a draft
- **WHEN** the admin edits a draft stage, turns `Stadio pubblico` on, and saves
- **THEN** the app issues `PATCH .../stages/:sid { isPublic: true }`, and the row loses its `Bozza` badge and shows `revealedAt`

### Requirement: Delete with confirmation

Deleting a quest (from the list or the detail header) SHALL open a ConfirmDialog naming the quest. Confirming SHALL issue `DELETE /campaigns/:cid/quests/:qid` and return to the list. Deleting the last stage SHALL open a ConfirmDialog. Confirming SHALL issue `DELETE .../stages/:sid` and refresh the stage list.

#### Scenario: Quest delete requires confirmation
- **WHEN** the admin activates delete on a quest
- **THEN** a confirmation opens, and only on confirm is `DELETE /campaigns/:cid/quests/:qid` issued

### Requirement: Quests API service

A `QuestsApiService` SHALL wrap `HttpClient` (or the generated client) for every quest and stage endpoint, map responses to typed `Quest` and `QuestStage` models, and expose a campaign-characters lookup for the multi-select.

#### Scenario: Service calls the campaign-scoped endpoint
- **WHEN** `list("c1")` is invoked
- **THEN** a GET is issued to `/campaigns/c1/quests` and the typed array is returned
