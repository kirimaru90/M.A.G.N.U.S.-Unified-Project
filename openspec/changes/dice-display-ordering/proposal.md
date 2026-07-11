## Why

Two rough edges in the DADI roller make a settled roll harder to read than it should be:

- **Unordered dice.** After a roll settles, faces render in roll order (`[3, 6, 1, 5]`), so the
  player has to scan the whole pool to judge the result. Sorting them **highest → lowest** puts the
  successes (6s, then 4/5s) up front where the outcome is decided.
- **Everything re-animates on a reroll.** A reroll re-randomises only the *selected* dice, but the
  tumble animation currently flickers **every** die on the way to settling
  (`s.faces.map(() => tumbleFace())`). The dice the player chose to keep visibly "spin" for no
  reason, which reads as if they too were rerolled.

## What Changes

- **Sort settled dice highest → lowest for display only.** The underlying roll order is preserved;
  only the rendered order changes. Crucially, each die keeps its **original identity** so that
  reroll selection and the `SVANTAGGIO` drop keep pointing at the right die (both are currently
  keyed by array index).
- **Animate only the rerolled dice.** During a reroll's tumble, the selected dice flicker and the
  unselected dice hold their settled face. During an initial roll, all dice animate as today.

Client-only, in `apps/pip-boy/src/tabs/dice.js` (and its `tumble` helper). No API, no dice-math
change: outcome resolution, PA refunds, `SVANTAGGIO` drop, and the reroll cost are all untouched.

## Capabilities

### Modified Capabilities

- `pipboy-dice-roller`:
  - "Rolling and outcome resolution" gains a display-ordering rule (settled dice render sorted
    highest→lowest) with an explicit note that selection and drop identity are independent of display
    order.
  - "Rerolling selected dice" gains an animation-scope rule (only rerolled dice animate).

## Testing

- **pip-boy (Playwright, `apps/pip-boy/tests`)** — seed the injectable random source
  (`window.__PB_DICE_RANDOM__`) so a roll yields a known unordered pool; assert the rendered dice
  read highest→lowest. Select a die, reroll, and assert (a) the outcome still resolves over the full
  resulting pool, and (b) mid-tumble only the selected die's face changes while the unselected dice
  hold steady. Add a regression assertion: with `SVANTAGGIO` active on a sorted display, the dropped
  (highest) die is the struck-through one and is not selectable.
- Because ordering is display-only, the existing engine unit tests in `apps/pip-boy` (outcome, drop,
  refund) must continue to pass unchanged — they assert on roll semantics, not render order.

## Impact

- **Code**: `apps/pip-boy/src/tabs/dice.js` — the settled-dice render path sorts a *copy* of the
  classified dice by value descending while emitting each cell's original index as `data-die`; the
  `tumble` helper takes the set of animating indices (captured before selection is cleared) and holds
  non-animating faces static.
- **Risk**: low, but concentrated in the index-aliasing seam — if display order ever leaks into the
  selection or drop logic, the wrong die gets rerolled/dropped. The design pins "identity ≠ display
  order" and the tests assert it directly.
- **Dependencies**: none. Independent of `fix-partial-patch-field-clobber`.
