# pipboy-quests Specification

## Purpose

The Pip-Boy quest log under `INFO › Quest`: a per-character quest list grouped by current status with milestone and shared indicators, a quest detail view with the current stage and an expandable stage log, and a device-local `AGGIORNATA` badge for unseen public stages.

## Requirements

### Requirement: Quest list under INFO › Quest

The `INFO › Quest` subtab SHALL render the character's quests from `GET /campaigns/:cid/characters/:id/quests`, following the per-tab lazy-fetch pattern: render synchronously, paint a skeleton, and fill in when the fetch resolves. The client SHALL NOT filter by visibility, because the API returns only what the character may see.

Quests SHALL be grouped by `current.status`, in this order: `IN CORSO`, `STANDBY`, `COMPLETATE`. Empty groups SHALL NOT render. `COMPLETATE` SHALL be collapsed by default, with its head showing the count (`▸ COMPLETATE (4)`), and SHALL expand when its head is activated. Within a group, quests SHALL be ordered by `updatedAt`, most recent first.

Each row SHALL show:

- `current.title`
- a `★` marker when `current.isMilestone` is true
- a kind label: `STORIA` or `PERSONALE`
- a `CONDIVISA` marker when the quest is personal and `involved` is non-empty
- an `AGGIORNATA` badge per the badge requirement

Activating a row SHALL open the quest detail.

With no quests, the subtab SHALL show `Nessuna quest attiva`. A failed fetch SHALL show a CRT-consistent Italian error message, never a crash or blank pane.

#### Scenario: Quests are grouped by current status
- **GIVEN** one `in_corso`, one `standby`, and two `completata` quests
- **WHEN** the user opens `INFO › Quest`
- **THEN** an `IN CORSO` group with one row, a `STANDBY` group with one row, and a collapsed `▸ COMPLETATE (2)` head are shown

#### Scenario: Completed group expands on demand
- **WHEN** the user activates the `COMPLETATE` head
- **THEN** its two rows are shown

#### Scenario: Milestone and kind markers
- **GIVEN** a story quest whose current stage is a milestone
- **WHEN** the list renders
- **THEN** its row shows `★` and `STORIA`

#### Scenario: Shared personal quest is marked
- **GIVEN** a personal quest whose `involved` lists another character
- **WHEN** the list renders
- **THEN** its row shows `PERSONALE` and `CONDIVISA`

#### Scenario: Empty state
- **WHEN** the API returns no quests
- **THEN** the subtab shows `Nessuna quest attiva`

### Requirement: Quest detail with stage log

The quest detail SHALL replace the list in the content pane and offer a back control (`◀`) returning to the list. It SHALL show, in order:

1. **Header**: `current.title`, a status chip (`IN CORSO` / `STANDBY` / `COMPLETATA`), `★ MILESTONE` when `current.isMilestone`, and the kind
2. **Involved line** (personal quests with a non-empty `involved` only): `Condivisa con: <names>`, listing only the **other** characters, from `involved`
3. **Current stage**: `current.description` rendered as text, and a `RICOMPENSA` section with `current.reward` when present. Sections whose value is absent SHALL NOT render.
4. **REGISTRO**: every stage in `stages`, newest first, as a vertical timeline. Each entry shows the stage title, its `revealedAt` date, `★` when it was a milestone, and its status. The current entry SHALL be visually distinguished and expanded. Past entries SHALL be collapsed, and activating one SHALL expand it to show that stage's description and reward as they were.

Stages SHALL NOT display ordinal numbers, so the log never suggests a missing position.

The `involved` names SHALL be rendered as the API provides them. The client SHALL NOT fetch other characters.

#### Scenario: Detail shows current stage and reward
- **GIVEN** a quest whose current stage has a description and a reward
- **WHEN** the user opens it
- **THEN** the description and a `RICOMPENSA` section with the reward are shown under the header

#### Scenario: Absent reward is not shown
- **GIVEN** a quest whose current stage has no reward
- **WHEN** the user opens it
- **THEN** no `RICOMPENSA` section renders

#### Scenario: Shared quest names the other characters only
- **GIVEN** a personal quest assigned to the viewer's character and to Nick
- **WHEN** the viewer opens it
- **THEN** `Condivisa con: Nick` is shown, and the viewer's own character is not listed

#### Scenario: Past stage expands to its own content
- **GIVEN** a quest with three visible stages
- **WHEN** the user activates the oldest entry in REGISTRO
- **THEN** that entry expands to show its own description and reward, independent of the current stage

#### Scenario: Lost milestone remains visible in the log
- **GIVEN** a quest whose previous stage was a milestone and whose current stage is not
- **WHEN** the user opens it
- **THEN** the header shows no `★ MILESTONE`, and the previous entry in REGISTRO shows `★`

#### Scenario: Back returns to the list
- **WHEN** the user activates `◀` in the detail
- **THEN** the quest list is shown again with its group expansion state preserved

### Requirement: AGGIORNATA badge for unseen stages

The app SHALL remember, per device and per character, which stage ids of each quest the user has seen. It SHALL store them in `localStorage` with every read and write wrapped so that storage failure degrades silently.

A quest's row SHALL show `AGGIORNATA` when its `stages` contains any stage id not in the seen set. Opening a quest's detail SHALL mark all of that quest's current stage ids as seen, and the badge SHALL be gone on return to the list.

On the very first load for a character on a device (no stored record at all), every quest SHALL be treated as already seen, and the app SHALL seed the record without showing badges, so a fresh install is not flooded with badges.

#### Scenario: New public stage raises the badge
- **GIVEN** the user has opened a quest, then the master publishes a new stage for it
- **WHEN** the user next loads `INFO › Quest`
- **THEN** that quest's row shows `AGGIORNATA`

#### Scenario: Opening the quest clears the badge
- **GIVEN** a row showing `AGGIORNATA`
- **WHEN** the user opens its detail and goes back
- **THEN** the row no longer shows `AGGIORNATA`

#### Scenario: First load seeds without badges
- **GIVEN** no stored seen record for this character on this device
- **WHEN** the quest list loads
- **THEN** no row shows `AGGIORNATA`

#### Scenario: Storage unavailable
- **GIVEN** `localStorage` access throws
- **WHEN** the quest list loads
- **THEN** the list renders normally without badges and without errors
