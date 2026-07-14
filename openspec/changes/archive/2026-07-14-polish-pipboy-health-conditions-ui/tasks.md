## 1. pip-boy — catalog picker polarity accent is visible

- [x] 1.1 In `apps/pip-boy/src/styles/pipboy.css`, make `.pb-picker-row--neg` / `.pb-picker-row--pos` win over the base `.pb-picker-row` — either move the accent rules below the base rule or raise their specificity (e.g. `.pb-picker-row.pb-picker-row--neg`) — so a negative row renders in the muted-red negative accent and a positive row stays green. Verify no other picker (tags/equipment/skills) regresses.

## 2. pip-boy — list-row names fit their available width

- [x] 2.1 In `apps/pip-boy/src/styles/pipboy.css`, add `min-width: 0` (and `overflow-wrap: anywhere`) to `.pb-cond-name`, and make its fixed siblings `.pb-cond-sign`, `.pb-cond-tag`, `.pb-cond-remove` `flex: none` so only the name yields and wraps.
- [x] 2.2 In `apps/pip-boy/src/tabs/catalog-picker.js`, wrap each row's name in its own element (e.g. `<span class="pb-picker-name">`), leaving the trailing meta separate; add a `.pb-picker-name` rule (`flex: 1; min-width: 0; overflow-wrap: anywhere`) with the meta staying right-aligned (`margin-left: auto`). Name-only rows (no meta/accent) SHALL still render exactly as before.
- [x] 2.3 Sanity-check the other list rows already using `min-width: 0` (skills, talents, consumables) still fit and wrap; adjust only if a fixed sibling is found compressing the name.

## 3. pip-boy — MARGINE stepper only in editor mode

- [x] 3.1 In `apps/pip-boy/src/tabs/health.js`, compute `const inEditor = canEdit && editMode;` (destructure `editMode` from ctx) and gate the `MARGINE` stepper block on `inEditor` instead of `canEdit`. Leave `+ AGGIUNGI CONDIZIONE` and the condition remove `✕` on plain `canEdit`. Keep the `if (!canEdit) return` handler-wiring guard.

## 4. pip-boy — tests

- [x] 4.1 e2e (Playwright): the add-condition catalog picker's negative row is rendered in the negative (red) colour (assert computed `color`/border colour, not just the class) while the positive row stays green.
- [x] 4.2 e2e (Playwright): a long condition name wraps within its column with the `−` sign, weight tag, and `✕` still visible and un-overlapped; a long catalog-entry name wraps in the picker with its trailing meta right-aligned and visible.
- [x] 4.3 e2e (Playwright): the `MARGINE` stepper is absent on the SALUTE tab with editor mode off and present after the `✎` toggle is activated; the existing margin-write scenario still passes in editor mode.
- [x] 4.4 Run `npx playwright test` from `apps/pip-boy` and confirm all pass.

## 5. Verify

- [x] 5.1 Run `openspec validate polish-pipboy-health-conditions-ui --strict` and confirm no errors.
