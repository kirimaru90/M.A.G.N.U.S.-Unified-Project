## 1. Result box: reserve space, decouple from `s.rolling`

- [x] 1.1 In `apps/pip-boy/src/tabs/dice.js`, change the `draw()` template so `#pb-dice-result` is rendered unconditionally (no more `s.result && !s.rolling ? ... : ''` ternary hiding the element entirely).
- [x] 1.2 Give the element an empty/populated content branch and an "empty" state marker (e.g. a modifier class or `data-` attribute) driven purely by `s.result` truthiness — text is empty when `s.result` is null, `OUTCOME[s.result.outcome]` otherwise. Do **not** gate on `s.rolling`.
- [x] 1.3 In `apps/pip-boy/src/styles/pipboy.css`, add the empty-state rule for `.pb-result-box` (`opacity: 0`), keeping border/padding/height identical to the populated state so no layout shift occurs when it toggles.

## 2. Idle placeholder dice

- [x] 2.1 In `diceGrid()` (`apps/pip-boy/src/tabs/dice.js`), add a branch for `!s.faces` that renders `size()` placeholder dice showing `6`, as non-button elements (following the existing `dieCell` `dropped`-span precedent) with no click handler and no `data-die` reroll semantics.
- [x] 2.2 Add a new CSS modifier in `pipboy.css` for placeholder dice (e.g. `.pb-die--placeholder`) that is dimmed, with no strikethrough — visually distinct from `.pb-die--full` (bright settled six) and `.pb-die.dropped` (struck-through).
- [x] 2.3 Verify (manually or via the tests in section 3) that changing approach, `VANTAGGIO`/`SVANTAGGIO`, or the modifier before the first roll updates the placeholder count immediately, since `draw()` already re-runs on each of those interactions.

## 3. Tests: `apps/pip-boy/tests/dice-roller.spec.ts`

- [x] 3.1 Update the existing "no result box is rendered before the first roll" test: assert `#pb-dice-result` is present with empty text and computed `opacity: 0`, instead of `toHaveCount(0)`.
- [x] 3.2 Update the same test's `.pb-die` assertion: before any roll, assert `poolSize()` placeholder dice are present (matching the selected approach's `{n}d6`) instead of `toHaveCount(0)`.
- [x] 3.3 Add a test that placeholder dice are non-interactive: tapping one does not change any reroll-selection state and leaves the placeholder styling in place.
- [x] 3.4 Add a test that the placeholder count tracks pool-size changes pre-roll (e.g. activating `VANTAGGIO` before rolling increases the shown placeholder count by one, matching the updated `{n}d6` readout).
- [x] 3.5 Add a test that after a roll settles, `#pb-dice-result` opacity becomes `1` with the resolved outcome text (existing settle assertions can stay, plus an explicit opacity check).
- [x] 3.6 Add a test that placeholder dice never reappear after the first roll, even if the approach/modifier changes afterward (grid keeps showing the previous roll's real dice).
- [x] 3.7 Add a test that a reroll's tumble keeps the previous outcome visible in `#pb-dice-result` (opacity `1`, previous text) for the duration of the tumble, updating only once the reroll settles.
- [x] 3.8 Run `npm test` (Playwright) from `apps/pip-boy` and confirm the full suite passes, including all updated and new dice-roller assertions.

## 4. Spec/documentation

- [x] 4.1 Confirm `openspec/changes/pipboy-dice-idle-placeholder/specs/pipboy-dice-roller/spec.md` accurately reflects the shipped behavior before archiving (result-box visibility rule, reroll-holds-previous-outcome scenario, idle placeholder requirement).
