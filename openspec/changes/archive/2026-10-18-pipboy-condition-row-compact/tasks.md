## 1. Compact row markup

- [x] 1.1 In `apps/pip-boy/src/tabs/health.js`, rewrite `conditionRow()` to emit only a `.pb-cond-value` span (`−1`/`−2` with U+2212, or `+1`/`+2`, derived from `conditionWeight`) and the `.pb-cond-name` span. Drop `.pb-cond-sign`, `.pb-cond-tag` and `.pb-cond-remove`, and delete the now-unused `weightTag()`.
- [x] 1.2 Add `title="{name}"` and `aria-label="{value} {name}"` (escaped with `esc()`) to both the editable `<button>` and the read-only `<div>` variants. Add `data-name` and `data-value` on the button for the confirm handler.

## 2. Single-line ellipsis styling

- [x] 2.1 In `apps/pip-boy/src/styles/pipboy.css`, change `.pb-cond-name` to `flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (removing `overflow-wrap: anywhere`).
- [x] 2.2 Add a `.pb-cond-value` rule (`flex: none`, display font, sized for two characters) and remove the dead `.pb-cond-sign`, `.pb-cond-tag` and `.pb-cond-remove` rules. Grep `apps/pip-boy` to confirm nothing else uses them.
- [x] 2.3 Scope `cursor: pointer` and the hover backgrounds to `button.pb-cond-row`, so read-only `<div>` rows don't look clickable.
- [x] 2.4 Test: in `apps/pip-boy/tests/health-margin.spec.ts`, replace the long-name **wrap** test with an **ellipsis** test. Render a column with a short name and a long unbroken name, then assert that the long name's computed `text-overflow` is `ellipsis` and `white-space` is `nowrap`, that it overflows its box (`scrollWidth > clientWidth`), that the row doesn't overflow horizontally, that `.pb-cond-value` is visible, that both rows have equal heights (±1px), and that the long row's `title` equals the full name.
- [x] 2.5 Test: a `major` negative row shows `−2` (U+2212) and a `minor` positive row shows `+1`, and no row's text contains `BASE`, `MODERATA`, `×2` or `✕`. Confirm the existing `.pb-cond-name` text assertions in `sheet-layout.spec.ts` and `health-margin.spec.ts` still pass unchanged.
- [x] 2.7 Update `sheet-layout.spec.ts`: the SALUTE two-column test now asserts the `−2`/`+1` value instead of `MODERATA ×2`/`BASE`, and the tap-to-remove test clicks through the confirm before expecting the `PATCH`.
- [x] 2.6 Test (regression guard): a long catalog-picker row name still wraps onto several lines, proving the ellipsis is scoped to SALUTE condition rows. Already covered by the existing `health-margin.spec.ts` test "a long catalog-entry name wraps in the picker…", kept unchanged.

## 3. Confirm before removal

- [x] 3.1 In `health.js`, import `openConfirm` from `./confirm-dialog.js` and change the `[data-remove-condition]` click handler to open `openConfirm({ message: \`Rimuovere ${name} (${value})?\`, confirmLabel: 'RIMUOVI', cancelLabel: 'ANNULLA', danger: true, onConfirm })`. Move the existing project-and-`commit()` logic into `onConfirm` unchanged.
- [x] 3.2 Test: in `apps/pip-boy/tests/delete-confirmations.spec.ts`, tapping a condition row opens the dialog with `Rimuovere {name} ({value})?`, and no `PATCH .../status` has fired yet.
- [x] 3.3 Test: `ANNULLA` closes the dialog, issues no `PATCH`, and leaves the row present. A backdrop tap does the same.
- [x] 3.4 Test: `RIMUOVI` issues `PATCH .../status` with the condition's id in the matching collection's `deletedIds`.
- [x] 3.5 Test: for a viewer who may not write the character, the rows render the signed value and the name, and tapping one opens no `.pb-confirm-dialog` and issues no `PATCH`.

## 4. Verify

- [x] 4.1 Run `npx playwright test` from `apps/pip-boy` and confirm the whole suite passes.
