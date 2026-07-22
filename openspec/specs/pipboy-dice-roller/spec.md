# pipboy-dice-roller Specification

## Purpose

The `apps/pip-boy` `DADI` tab: a client-side d6 pool roller with approach picker, Vantaggio/Svantaggio, situational modifier, tumble animation, outcome resolution, per-die reroll-for-PA, an ephemeral roll register, and action-point refunds — resolved entirely client-side with no server-recorded roll history.
## Requirements
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

During a reroll's tumble animation, **only the rerolled (selected) dice** SHALL flicker; every die not being rerolled SHALL hold its settled face steady for the duration. During an initial roll, all dice in the pool SHALL animate.

The reroll SHALL preserve display stability: the dice's **rendered order and positions from the just-settled roll SHALL be held for the entire duration of the reroll tumble** — every die, rerolled or kept, stays in the cell it already occupied, so kept dice do not move at all and rerolled dice flicker in place. Re-sorting the pool highest→lowest SHALL happen **only after** the reroll has settled, never mid-animation. (An initial roll has no prior settled order to preserve.)

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

#### Scenario: Kept dice do not move during the reroll, pool re-sorts only after settling
- **GIVEN** a settled pool displayed highest→lowest and one die selected for reroll
- **WHEN** the reroll tumble plays
- **THEN** every die keeps its current displayed position for the whole tumble (the kept dice do not shift), and only after the reroll settles is the pool re-sorted highest→lowest

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

### Requirement: Haptic feedback while the dice tumble

While the tumble animation plays, the roller SHALL emit a **vibration pulse once per tumble tick**
— one pulse per re-randomisation of the displayed faces, for the animation's nine ticks — so the
rumble is felt for the duration of the tumble and stops when the dice settle. This applies to both
an initial roll and a reroll.

The pulse SHALL be emitted from the same loop that drives the visual re-randomisation, rather than
being scheduled up front as a single multi-pulse pattern handed to the operating system. The
tumble is driven by a timer whose ticks drift under load; a pattern executed on the OS clock would
keep its own accurate time and therefore drift out of alignment with the faces the player is
watching, ending before or after the flicker does. Emitting per tick binds the rumble to the same
clock as the visuals, so the two stay aligned however the timer actually fires. It also requires no
teardown: an in-flight pulse simply expires if the roller is dismissed mid-tumble, whereas a
queued pattern would have to be explicitly cancelled.

Pulse duration SHALL scale with the number of dice **in flight** — the whole pool on a roll, and
only the selected dice on a reroll — so that a larger pool rattles more strongly than a smaller
one. Pulse duration is the only available dimension: the vibration API exposes no amplitude
control. Duration SHALL remain short enough that each pulse completes within its tick, so
consecutive pulses do not cancel one another.

The tumble's duration SHALL NOT change with pool size: the animation remains nine ticks regardless
of how many dice are rolled, so pool size varies the strength of each pulse and never the length
of the rattle.

All haptic output SHALL be gated on the vibration preference defined by `pipboy-settings`: when
that preference is off, a roll and a reroll SHALL each issue no vibration request whatsoever.
Haptics SHALL be a side effect only — they SHALL NOT affect roll resolution, outcome
classification, action-point refunds, reroll cost, dice selection, or display ordering, and a
failure or absence of vibration support SHALL NOT interrupt the animation or the roll.

#### Scenario: A roll pulses once per tumble tick
- **GIVEN** the vibration preference is on
- **WHEN** the player rolls and the tumble animation plays to settling
- **THEN** one vibration pulse is requested per tumble tick, for the animation's nine ticks, and
  none after the dice settle

#### Scenario: A larger pool rattles more strongly
- **GIVEN** the vibration preference is on
- **WHEN** a roll of a five-die pool is compared with a roll of a two-die pool
- **THEN** the five-die roll's per-tick pulse duration is longer than the two-die roll's

#### Scenario: A reroll pulses for the dice actually in flight
- **GIVEN** a settled pool of five dice with two selected for reroll, and the vibration preference
  on
- **WHEN** the reroll's tumble plays
- **THEN** the pulse duration corresponds to the two dice being rerolled, not to the full pool of
  five

#### Scenario: Pool size does not change the rattle's length
- **GIVEN** the vibration preference is on
- **WHEN** a two-die roll and a five-die roll are each played to settling
- **THEN** both emit the same number of pulses, one per tick, over the same tumble duration

#### Scenario: Vibration preference off suppresses all pulses
- **GIVEN** the vibration preference is off
- **WHEN** the player rolls, and separately rerolls
- **THEN** no vibration request is issued by either

#### Scenario: Haptics do not perturb roll resolution
- **GIVEN** a seeded roll
- **WHEN** the roll is played with the vibration preference on and again with it off
- **THEN** the settled faces, resolved outcome, action-point refund, and display order are
  identical in both cases

#### Scenario: Absent vibration support does not break the roll
- **GIVEN** an environment with no vibration support
- **WHEN** the player rolls
- **THEN** the tumble animation plays, the roll settles, and the outcome resolves normally

