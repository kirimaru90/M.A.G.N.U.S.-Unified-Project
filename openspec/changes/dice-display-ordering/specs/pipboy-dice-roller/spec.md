## MODIFIED Requirements

### Requirement: Rolling and outcome resolution

A full-width `TIRA` control SHALL roll the pool. The roll SHALL play a tumble animation — re-randomising the displayed faces roughly every 60ms for 9 ticks (~540ms) before settling — during which dice SHALL NOT be selectable.

Outcome SHALL be resolved as: any die showing `6` → `SUCCESSO PIENO`; otherwise any die showing `4` or `5` → `SUCCESSO CON COSTO`; otherwise → `FALLIMENTO`.

When `SVANTAGGIO` is active, the single highest-value die SHALL be dropped **before** the outcome is evaluated. A dropped die SHALL render dimmed and struck-through, and SHALL be ineligible for reroll.

Once a roll has **settled**, the dice SHALL render sorted from highest face value to lowest. This ordering is a display concern only: each die's identity for the purposes of reroll selection and the `SVANTAGGIO` drop SHALL remain tied to the die itself, independent of its rendered position — sorting the display SHALL NOT change which die is selected, dropped, or rerolled. While the tumble animation is playing, faces SHALL render in place and SHALL NOT be sorted.

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

#### Scenario: Settled dice render highest to lowest
- **GIVEN** a roll settles on faces `[3, 6, 1, 5]`
- **WHEN** the dice grid renders the settled roll
- **THEN** the dice are shown in the order `6, 5, 3, 1`

#### Scenario: Display order does not change reroll identity
- **GIVEN** a settled roll displayed highest→lowest, and the player selects the die showing `3`
- **WHEN** the reroll is performed
- **THEN** the die that is rerolled is the one showing `3`, regardless of its position in the sorted display

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

### Requirement: Rerolling selected dice

After a roll has settled, tapping a die SHALL toggle its selection for reroll; a selected die renders with a thicker solid border and a tinted background. Dice dropped by `SVANTAGGIO` SHALL NOT be selectable.

A `RILANCIA CON` `<select>` SHALL list the character's Tag Skills, and a `RITIRA SELEZIONATI −1 PA` control SHALL reroll the selected dice. That control SHALL be disabled unless **all** of: no roll is in progress, `paCurrent > 0`, a Tag Skill is chosen, and at least one die is selected.

A reroll SHALL cost exactly `1` PA regardless of outcome, applied via `PATCH .../action-points`, and SHALL **never** grant PA back — the six-refund rule applies only to rolls. The outcome SHALL be re-resolved over the resulting faces.

During a reroll's tumble animation, **only the rerolled (selected) dice** SHALL flicker; every die not being rerolled SHALL hold its settled face steady for the duration. During an initial roll, all dice in the pool SHALL animate.

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

#### Scenario: Only rerolled dice animate
- **GIVEN** a settled pool of four dice with exactly one die selected for reroll
- **WHEN** the reroll is activated and the tumble animation plays
- **THEN** only the selected die's face changes during the animation and the other three hold their settled faces

#### Scenario: Reroll never refunds PA
- **GIVEN** a reroll of two dice yields two `6`s
- **WHEN** the outcome re-resolves
- **THEN** the result reads `SUCCESSO PIENO` and no PA is refunded — only the `1` PA cost was applied

#### Scenario: Dropped dice cannot be selected
- **GIVEN** `SVANTAGGIO` dropped the highest die
- **WHEN** the user taps that die
- **THEN** it is not selected and the selected-count hint is unchanged
