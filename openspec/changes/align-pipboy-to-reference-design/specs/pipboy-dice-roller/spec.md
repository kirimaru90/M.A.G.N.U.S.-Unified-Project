## ADDED Requirements

### Requirement: Dice pool composition

The `DADI` tab SHALL present a `▸ POOL DI DADI` header with the currently selected approach's name right-aligned, a seven-segment approach picker (single-letter buttons, one per S.P.E.C.I.A.L. approach), a mutually-exclusive `VANTAGGIO` / `SVANTAGGIO` toggle row, and a `CONDIZIONI / BONUS — dadi ± al pool` stepper bounded `−6..+6`.

Pool size SHALL be computed as: the selected approach's S.P.E.C.I.A.L. value, plus `1` when `VANTAGGIO` is active, plus the situational modifier — clamped to a **minimum of 1**. The pool SHALL be displayed as a centred `{n}d6` readout.

Selecting an approach from `pipboy-character-sheet`'s S.P.E tab SHALL preselect it here.

`VANTAGGIO` and `SVANTAGGIO` are mutually exclusive: activating one SHALL deactivate the other.

#### Scenario: Pool equals the approach value by default
- **GIVEN** the selected approach has value `4`, no advantage, and a modifier of `0`
- **WHEN** the pool readout renders
- **THEN** it reads `4d6`

#### Scenario: Vantaggio adds one die
- **GIVEN** the selected approach has value `3` and `VANTAGGIO` is active
- **WHEN** the pool readout renders
- **THEN** it reads `4d6`

#### Scenario: Modifier adjusts the pool
- **GIVEN** the selected approach has value `3` and the modifier is `−2`
- **WHEN** the pool readout renders
- **THEN** it reads `1d6`

#### Scenario: Pool never drops below one die
- **GIVEN** the selected approach has value `1` and the modifier is `−6`
- **WHEN** the pool readout renders
- **THEN** it reads `1d6`

#### Scenario: Advantage and disadvantage are mutually exclusive
- **GIVEN** `VANTAGGIO` is active
- **WHEN** the user activates `SVANTAGGIO`
- **THEN** `VANTAGGIO` becomes inactive

#### Scenario: Approach preselected from the S.P.E tab
- **WHEN** the user taps the `CARISMA` approach row on the S.P.E tab
- **THEN** the `DADI` tab opens with `CARISMA` selected and the pool sized from its value

### Requirement: Rolling and outcome resolution

A full-width `TIRA` control SHALL roll the pool. The roll SHALL play a tumble animation — re-randomising the displayed faces roughly every 60ms for 9 ticks (~540ms) before settling — during which dice SHALL NOT be selectable.

Outcome SHALL be resolved as: any die showing `6` → `SUCCESSO PIENO`; otherwise any die showing `4` or `5` → `SUCCESSO CON COSTO`; otherwise → `FALLIMENTO`.

When `SVANTAGGIO` is active, the single highest-value die SHALL be dropped **before** the outcome is evaluated. A dropped die SHALL render dimmed and struck-through, and SHALL be ineligible for reroll.

Dice faces SHALL render as bordered squares: a `6` glows bright with a tinted background, `4` and `5` render plain green, and `1`–`3` render dim green. Before the first roll the result box SHALL read `— TIRA I DADI —`.

The roller's random source SHALL be injectable, so that automated tests can assert on seeded outcomes rather than on real randomness.

#### Scenario: Any six is a full success
- **GIVEN** a roll yields faces `[2, 6, 3]`
- **WHEN** the outcome resolves
- **THEN** the result reads `SUCCESSO PIENO`

#### Scenario: No six but a four or five is a costly success
- **GIVEN** a roll yields faces `[2, 5, 3]`
- **WHEN** the outcome resolves
- **THEN** the result reads `SUCCESSO CON COSTO`

#### Scenario: All low faces is a failure
- **GIVEN** a roll yields faces `[1, 2, 3]`
- **WHEN** the outcome resolves
- **THEN** the result reads `FALLIMENTO`

#### Scenario: Svantaggio drops the highest die before evaluation
- **GIVEN** `SVANTAGGIO` is active and a roll yields faces `[6, 4, 2]`
- **WHEN** the outcome resolves
- **THEN** the `6` is dropped, rendered dimmed and struck-through, and the result reads `SUCCESSO CON COSTO`

#### Scenario: Dice are not selectable mid-roll
- **WHEN** the tumble animation is playing
- **THEN** tapping a die does not select it for reroll

#### Scenario: Pre-roll result placeholder
- **WHEN** the `DADI` tab opens before any roll
- **THEN** the result box reads `— TIRA I DADI —`

### Requirement: Action-point refunds from sixes

On a **roll** (not a reroll), the character SHALL be refunded `max(0, sixes − 1)` action points — every `6` beyond the first returns 1 PA. The `FORTUNA` approach SHALL never grant PA from sixes.

Any resulting change SHALL be applied to `paCurrent` via the existing `PATCH .../action-points` endpoint — the same call path as the manual PA stepper — capped at `paMax`. No roll is ever recorded server-side.

When the `FORTUNA` approach is selected, a bordered note SHALL be shown reading `FORTUNA · il Rischio sale di un grado · nessun PA dai 6`.

Dice dropped by `SVANTAGGIO` SHALL NOT count toward the six-count.

#### Scenario: Roll refunds PA on multiple sixes
- **GIVEN** a non-Fortuna approach
- **WHEN** a roll of a 4-die pool yields three `6`s
- **THEN** the app computes a refund of `2` PA and issues `PATCH .../action-points { paCurrent: <current + 2, capped at paMax> }`

#### Scenario: A single six refunds nothing
- **WHEN** a roll yields exactly one `6`
- **THEN** no PA refund is computed and no `action-points` request is issued

#### Scenario: Fortuna never refunds PA
- **GIVEN** the `FORTUNA` approach is selected
- **WHEN** a roll yields three `6`s
- **THEN** no PA refund is computed and the Fortuna note box is displayed

#### Scenario: Refund is capped at paMax
- **GIVEN** a character with `paCurrent: 5` and `paMax: 6`
- **WHEN** a roll refunds `2` PA
- **THEN** the app issues `PATCH .../action-points { paCurrent: 6 }`

#### Scenario: A dropped six does not count
- **GIVEN** `SVANTAGGIO` is active and a roll yields `[6, 6, 2]`
- **WHEN** the refund is computed
- **THEN** one `6` is dropped, one `6` remains, and no PA is refunded

#### Scenario: Roll result is not persisted as history
- **WHEN** any roll is resolved
- **THEN** no request is made to store the roll itself; only the resulting `paCurrent` change, if any, is sent

### Requirement: Rerolling selected dice

After a roll has settled, tapping a die SHALL toggle its selection for reroll; a selected die renders with a thicker solid border and a tinted background. Dice dropped by `SVANTAGGIO` SHALL NOT be selectable.

A `RILANCIA CON` `<select>` SHALL list the character's Tag Skills, and a `RITIRA SELEZIONATI −1 PA` control SHALL reroll the selected dice. That control SHALL be disabled unless **all** of: no roll is in progress, `paCurrent > 0`, a Tag Skill is chosen, and at least one die is selected.

A reroll SHALL cost exactly `1` PA regardless of outcome, applied via `PATCH .../action-points`, and SHALL **never** grant PA back — the six-refund rule applies only to rolls. The outcome SHALL be re-resolved over the resulting faces.

A hint SHALL read `Tocca i dadi da ritirare · N selezionati`, and a footnote `Il ritiro richiede la Tag Skill pertinente.`

#### Scenario: Reroll is blocked without a selected skill
- **GIVEN** one die is selected and `paCurrent` is `3`
- **WHEN** no Tag Skill is chosen in `RILANCIA CON`
- **THEN** the `RITIRA SELEZIONATI −1 PA` control is disabled

#### Scenario: Reroll is blocked with no action points
- **GIVEN** a Tag Skill is chosen and one die is selected
- **WHEN** `paCurrent` is `0`
- **THEN** the reroll control is disabled

#### Scenario: Reroll is blocked with no selected dice
- **GIVEN** a Tag Skill is chosen and `paCurrent` is `3`
- **WHEN** no die is selected
- **THEN** the reroll control is disabled

#### Scenario: Reroll costs exactly one PA
- **GIVEN** `paCurrent` is `3`, a Tag Skill is chosen, and two dice are selected
- **WHEN** the user activates the reroll control
- **THEN** the app issues `PATCH .../action-points { paCurrent: 2 }` and the two selected dice are re-randomised

#### Scenario: Reroll never refunds PA
- **GIVEN** a reroll of two dice yields two `6`s
- **WHEN** the outcome re-resolves
- **THEN** the result reads `SUCCESSO PIENO` and no PA is refunded — only the `1` PA cost was applied

#### Scenario: Dropped dice cannot be selected
- **GIVEN** `SVANTAGGIO` dropped the highest die
- **WHEN** the user taps that die
- **THEN** it is not selected and the selected-count hint is unchanged

### Requirement: Roll register

The `DADI` tab SHALL present a `▸ REGISTRO` section: a scrolling history of the **last 8 rolls**, each row showing the dice expression (e.g. `P 4d6+1`) on the left and the outcome (`PIENO` / `COSTO` / `FALLIMENTO`) on the right.

The register is client-side and ephemeral; it SHALL NOT be persisted server-side and SHALL reset when the sheet is reopened, consistent with rolls not being recorded.

#### Scenario: A roll is appended to the register
- **WHEN** a roll of a `4d6` Percezione pool with a `+1` modifier resolves as a full success
- **THEN** the register's newest row reads an expression identifying the approach, pool, and modifier, and the outcome `PIENO`

#### Scenario: Register retains only the last eight rolls
- **WHEN** a ninth roll resolves
- **THEN** the register lists exactly eight rows and the oldest has been dropped

#### Scenario: Register is not persisted
- **GIVEN** several rolls are listed in the register
- **WHEN** the user leaves the sheet and reopens it
- **THEN** the register is empty and no roll-history request was issued
