## MODIFIED Requirements

### Requirement: S.P.E.C.I.A.L. approaches tab

The `S.P.E` tab SHALL present, in **view** mode, the header `▸ APPROCCI · TOCCA PER TIRARE` and the hint `Il valore = numero di d6 nel pool`, followed by seven full-width approach rows. Each row SHALL show the approach's display letter, its name, its one-line description, and a five-slot pip row rendering that attribute's value (`1..5`).

Activating an approach row SHALL switch to the `DADI` tab with that approach preselected as the dice-pool source.

Beneath the rows, a bordered legend box SHALL render the dice-outcome reference: `6 = Successo Pieno · 4/5 = Successo con Costo · 1/2/3 = Fallimento. Ogni 6 oltre il primo restituisce 1 PA.`

In **editor** mode the tab SHALL instead show the header `▸ MODIFICA S.P.E.C.I.A.L.` and seven stepper rows (letter · name · `[−] value [+]`) bounded `1..5`, writing through `PATCH .../special`; followed by a `FONTE PA` selector writing `paTrackedBy` and a `MAX PA` stepper writing `paMax`. The `MAX PA` stepper's bounds SHALL be independent of the SPECIAL range — narrowing SPECIAL to `1..5` SHALL NOT lower the reachable `paMax`, which retains its `0..8` range.

#### Scenario: Approach rows render with pips
- **WHEN** the `S.P.E` tab renders in view mode
- **THEN** seven rows are shown, each with a display letter, name, description, and a pip row reflecting that attribute's value

#### Scenario: Tapping an approach jumps to the dice tab preselected
- **WHEN** the user activates the `PERCEZIONE` row
- **THEN** the `DADI` tab is shown with `PERCEZIONE` preselected as the pool source

#### Scenario: Owner edits an attribute
- **WHEN** the owning player increments `FORZA` in editor mode
- **THEN** the app issues `PATCH .../special { strength: <new value> }` and the persisted value reflects the change

#### Scenario: Attribute steppers are bounded 1..5
- **GIVEN** an attribute at value `5`
- **WHEN** the sheet renders its stepper in editor mode
- **THEN** the `+` control is disabled, and at value `1` the `−` control is disabled

#### Scenario: MAX PA stepper is decoupled from the SPECIAL range
- **GIVEN** a character with `paMax` at `6`
- **WHEN** the owner raises `MAX PA` in editor mode
- **THEN** the stepper continues past `5` toward its own `0..8` bound, unaffected by the SPECIAL maximum of `5`

#### Scenario: Owner changes the PA source
- **WHEN** the owning player selects `Resistenza` in the `FONTE PA` selector
- **THEN** the app issues `PATCH .../action-points { paTrackedBy: "endurance" }` and the header's `PA · <source>` line updates

### Requirement: Abilities tab

The `ABIL` tab SHALL present two editable sections and one read-only reference block.

- `▸ TAG SKILLS · MAESTRIA`: one row-card per entry in `skills`, showing the skill's catalog name and, to the right of the name, a three-slot competence square row rendering its maestria as `COMPETENTE`=1 filled, `ESPERTO`=2, `MAESTRO`=3 — in the same visual language as the SPECIAL pip row. In editor mode the level becomes a `<select>` (`COMPETENTE` / `ESPERTO` / `MAESTRO`) and a `✕` remover appears, with a dashed `+ ABILITÀ` action adding a row backed by the skills catalog. Writes go through `PATCH .../skills`.
- `▸ TALENTI`: one row-card per entry in `perks`, showing name and description. In editor mode both become inputs, a `✕` remover appears, and a dashed `+ TALENTO` action adds a row. Writes go through `PATCH .../perks`.
- A view-only `▸ SPESA PA` block listing three dashed-divider lines: `RITIRA FALLITI` (1 PA, requires the relevant Tag Skill), `RUBA LA SCENA` (1 PA, act out of turn or again), and `V.A.T.S.` (1 PA, exploit an advantage or targeted effect).

The competence squares are a display of the existing maestria enum, not a new stored field. Maestria tiers remain **narrative**: `COMPETENTE` raises the Risk a GM applies by one grade, `ESPERTO` leaves it unchanged, and `MAESTRO` lowers it by one grade. The app SHALL NOT apply any mechanical dice effect from maestria.

#### Scenario: Skill renders maestria as competence squares
- **GIVEN** a skill at maestria `ESPERTO`
- **WHEN** the `ABIL` tab renders in view mode
- **THEN** a three-slot square row with two of three slots filled is shown to the right of the skill name

#### Scenario: Owner adds a tag skill
- **WHEN** the owning player activates `+ ABILITÀ`, picks a catalog skill and a level, and confirms
- **THEN** the app issues `PATCH .../skills { items: [{ id: <slug>, level: <level> }] }` and the row appears

#### Scenario: Owner changes a maestria level
- **WHEN** the owning player changes a skill's level select in editor mode to `MAESTRO`
- **THEN** the app issues `PATCH .../skills` with that skill's slug and the new level, and the competence squares fill all three slots

#### Scenario: Owner removes a talent
- **WHEN** the owning player activates a talent row's `✕`
- **THEN** the app issues `PATCH .../perks { deletedIds: [<id>] }` and the row disappears

#### Scenario: SPESA PA block is never editable
- **WHEN** editor mode is on
- **THEN** the `▸ SPESA PA` block presents no inputs, removers, or add actions

#### Scenario: Maestria has no mechanical dice effect
- **GIVEN** a character with a `MAESTRO` tag skill
- **WHEN** a dice pool is computed for any approach
- **THEN** the pool size is unaffected by that skill's maestria tier
