## 1. Creation — prominent step instructions

- [x] 1.1 Add a `.pb-step-intro` style (larger, higher-contrast, more spacing than `.pb-hint`) in `apps/pip-boy/src/styles/pipboy.css`.
- [x] 1.2 In `apps/pip-boy/src/screens/create.js`, render each step's primary instruction line with `.pb-step-intro`; leave secondary footnotes (e.g. the equipment "Dotazione fissa" note) on `.pb-hint`.

## 2. Creation — empty Tag Skills list

- [x] 2.1 In `apps/pip-boy/src/screens/create.js` `stepSkills()`, remove the `— aggiungi abilità —` placeholder branch; when `draft.skills` is empty render an empty list (no placeholder row).
- [x] 2.2 Remove the now-dead `data-add-skill-row` handler in `bindSkills()`; the section-head `+` remains the sole add trigger.

## 3. Inventory — resources band above the footer

- [x] 3.1 In `apps/pip-boy/src/tabs/gear.js`, stop rendering the `.pb-resource-row` band inside `renderInvSubtab`.
- [x] 3.2 In `apps/pip-boy/src/screens/sheet.js`, render the resources band once as a fixed strip between the scrolling content and the footer, shown while the INV first-level tab is active; wire the resource steppers and numeric inputs to `PATCH .../resources`.
- [x] 3.3 In `apps/pip-boy/src/styles/pipboy.css`, restyle `.pb-resource-row` from an in-scroll sticky element to a fixed band above the footer (outside `.pb-screen-content`), preserving the three-box ≈360px-fit layout.

## 4. S.P.E.C.I.A.L. editor — remove FONTE PA

- [x] 4.1 In `apps/pip-boy/src/tabs/special.js` `editorMode`, remove the `FONTE PA` `<select>` and its `#pb-pa-source` change handler; keep the `MAX PA` stepper and its handler.
- [x] 4.2 Confirm the header `PA · <source>` line (`screens/sheet.js`) still renders from the stored `paTrackedBy`.

## 5. Tests

- [x] 5.1 Update `apps/pip-boy/tests/character-creation.spec.ts`: assert each step renders a `.pb-step-intro` instruction; assert the empty Tag Skills step shows no `— aggiungi abilità —` row while the `+` still opens the add-popup.
- [x] 5.2 e2e (Playwright): the INV resources band renders once outside the scrolling list and stays fixed above the footer while a long item list scrolls; a resource adjustment issues `PATCH .../resources`.
- [x] 5.3 e2e (Playwright): the S.P.E.C.I.A.L. editor shows no `FONTE PA` selector; the `MAX PA` stepper issues `PATCH .../action-points { paMax }`; the header `PA · <source>` line reflects the stored `paTrackedBy`.

## 6. Verify

- [x] 6.1 Run the pip-boy Playwright suite and confirm pass.
- [x] 6.2 Run `openspec validate polish-pipboy-creation-and-inventory --strict` and confirm no errors.
