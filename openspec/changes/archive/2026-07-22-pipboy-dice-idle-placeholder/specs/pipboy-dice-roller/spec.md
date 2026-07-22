## MODIFIED Requirements

### Requirement: Rolling and outcome resolution

A full-width `TIRA` control SHALL roll the pool. The roll SHALL play a tumble animation — re-randomising the displayed faces roughly every 60ms for 9 ticks (~540ms) before settling — during which dice SHALL NOT be selectable.

Outcome SHALL be resolved as: any die showing `6` → `SUCCESSO PIENO`; otherwise any die showing `4` or `5` → `SUCCESSO CON COSTO`; otherwise → `FALLIMENTO`.

When `SVANTAGGIO` is active, the single highest-value die SHALL be dropped **before** the outcome is evaluated. A dropped die SHALL render dimmed and struck-through, and SHALL be ineligible for reroll.

Once a roll has **settled**, the dice SHALL render sorted from highest face value to lowest. This ordering is a display concern only: each die's identity for the purposes of reroll selection and the `SVANTAGGIO` drop SHALL remain tied to the die itself, independent of its rendered position — sorting the display SHALL NOT change which die is selected, dropped, or rerolled. While the tumble animation is playing, faces SHALL render in place and SHALL NOT be sorted.

Dice faces SHALL render as bordered squares: a `6` glows bright with a tinted background, `4` and `5` render plain green, and `1`–`3` render dim green. The result box (`#pb-dice-result`) SHALL always be present in the DOM at full opacity, reserving its layout space. Its content SHALL be driven purely by whether a result exists: with no result it renders a `-` placeholder; once a result exists it renders the resolved outcome (`SUCCESSO PIENO` / `SUCCESSO CON COSTO` / `FALLIMENTO`). This content SHALL depend only on whether a result exists, not on whether the tumble animation is currently playing — so during a reroll's tumble the box SHALL continue showing the previous result until the new one settles, rather than reverting to `-` mid-animation.

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

#### Scenario: Result box shows a dash before the first roll
- **WHEN** the `DADI` tab opens before any roll
- **THEN** the `#pb-dice-result` element is present in the DOM at full opacity, showing `-`, reserving its layout space

#### Scenario: Result box shows the outcome once a roll settles
- **GIVEN** the `DADI` tab was opened with no roll yet, so the result box shows `-`
- **WHEN** the player rolls and the tumble settles
- **THEN** the result box shows the resolved outcome label

#### Scenario: Result box holds the previous outcome through a reroll's tumble
- **GIVEN** a settled roll whose outcome is showing in the result box
- **WHEN** the player rerolls selected dice and the reroll's tumble animation plays
- **THEN** the result box continues showing the previous outcome, unchanged, until the reroll settles, at which point it updates to the newly resolved outcome

## ADDED Requirements

### Requirement: Idle dice-pool preview

Before any roll has happened on a `DADI` tab mount, the dice grid SHALL render exactly `poolSize()` decorative placeholder dice, each showing face value `6`. These placeholder dice SHALL NOT be produced by the random source and SHALL NOT be selectable or clickable — they carry no reroll semantics.

Placeholder dice SHALL render visually dimmed and SHALL be distinguishable from both a real settled `6` (which glows bright) and a `SVANTAGGIO`-dropped die (which is struck-through) — a placeholder die is dimmed only, with no strikethrough.

The number of placeholder dice SHALL track the live pool size: changing the selected approach, toggling `VANTAGGIO`/`SVANTAGGIO`, or adjusting the modifier before the first roll SHALL immediately change the placeholder count to match the current `{n}d6` readout.

Once the first roll occurs on a mount, placeholder dice SHALL NOT be shown again for the remainder of that mount — the grid shows only real dice (tumbling, then settled) from that point on, even if the pool size is subsequently changed.

#### Scenario: Idle grid previews the pool size
- **GIVEN** the `DADI` tab opens with the selected approach valued at `3` and no roll has occurred
- **WHEN** the dice grid renders
- **THEN** exactly `3` placeholder dice are shown, each displaying `6`

#### Scenario: Placeholder dice are dimmed and non-interactive
- **GIVEN** the idle placeholder dice are shown
- **WHEN** the player taps one
- **THEN** nothing is selected and no reroll state changes; the die renders dimmed, distinct from a bright settled `6` and from a struck-through dropped die

#### Scenario: Placeholder count tracks pool-size changes before rolling
- **GIVEN** the idle grid shows `3` placeholder dice
- **WHEN** the player activates `VANTAGGIO` before rolling
- **THEN** the idle grid now shows `4` placeholder dice, matching the updated `{n}d6` readout

#### Scenario: Placeholder dice never return after the first roll
- **GIVEN** a roll has settled on the current mount
- **WHEN** the player changes the approach or modifier afterward, before rolling again
- **THEN** the dice grid continues showing the previous roll's real dice, not placeholder dice, regardless of the new pool size
