## ADDED Requirements

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
