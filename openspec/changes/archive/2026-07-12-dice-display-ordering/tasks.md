# Tasks

## 1. Sort settled dice for display (identity-preserving)

- [x] 1.1 In `apps/pip-boy/src/tabs/dice.js` `diceGrid()`, when rendering settled dice
      (`s.result && !s.rolling`), build the render list from `s.result.classified` carrying each
      die's original index, then sort a copy by `value` descending. Render each cell with `data-die`
      set to the **original** index, not the sorted position.
- [x] 1.2 Leave the mid-tumble branch (flickering faces) rendering in place, unsorted.
- [x] 1.3 Verify `s.selected`, `droppedIndex`, and the reroll `map` continue to operate on original
      indices — no display-order value leaks into them.

## 2. Animate only rerolled dice

- [x] 2.1 Add an optional `animating` (index `Set`) parameter to `tumble`; a tick re-randomises only
      those indices and holds the rest at their settled `finalFaces` value. `animating == null` keeps
      today's "all dice flicker" behaviour.
- [x] 2.2 In `reroll()`, capture the selected index set **before** calling `tumble` (which clears
      `s.selected`) and pass it as `animating`. Leave `roll()` calling `tumble` with no `animating`
      set.

## 3. Tests

- [x] 3.1 Playwright: seed `window.__PB_DICE_RANDOM__` so a roll yields a known unordered pool; assert
      the rendered dice read highest→lowest.
- [x] 3.2 Playwright: with `SVANTAGGIO` active, assert the dropped (highest) die renders
      struck-through at the front of the sorted row and is not selectable.
- [x] 3.3 Playwright: select one die and reroll; assert mid-tumble only the selected die's face
      changes while the others hold steady, and the settled outcome resolves over the full pool.
- [x] 3.4 Run `npx playwright test` from `apps/pip-boy`; confirm the existing dice engine unit tests
      (outcome, drop, refund) still pass unchanged.
