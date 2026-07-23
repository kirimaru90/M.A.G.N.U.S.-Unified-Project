## 1. Character deletion (dossier)

- [x] 1.1 In `apps/pip-boy/src/screens/character-select.js`, wrap the `data-delete` button's click handler in `openConfirm` (imported from `../tabs/confirm-dialog.js`), with a message interpolating the character's name (e.g. `` `Eliminare ${esc(c.name)}?` ``); move the existing `deleteCharacter(...)` call and its try/catch into `onConfirm`. Do not pass `danger: true`.
- [x] 1.2 Verify the `data-delete` button already carries `pb-btn--danger` (it does today) — no markup change needed here.
- [x] 1.3 Add a Playwright test (in `apps/pip-boy/tests/`, following existing file/spec conventions) asserting: activating a dossier card's `✕` opens a confirm dialog naming the character; cancelling (cancel button and backdrop) leaves the character listed and issues no delete request; confirming removes it from the dossier.

## 2. Skill and talent/perk deletion (sheet editor mode)

- [x] 2.1 In `apps/pip-boy/src/tabs/skills.js`, wrap the `data-remove-skill` button's click handler in `openConfirm` with a generic message (e.g. `Rimuovere questa abilità?`); move the existing `pushSkills({ deletedIds: [...] })` call into `onConfirm`. Do not pass `danger: true`.
- [x] 2.2 In the same file, wrap the `data-remove-perk` button's click handler in `openConfirm` with a generic message (e.g. `Rimuovere questo talento?`); move the existing `pushPerks({ deletedIds: [...] })` call into `onConfirm`. Do not pass `danger: true`.
- [x] 2.3 Add `pb-btn--danger` to the `data-remove-skill` and `data-remove-perk` button markup in `skills.js` (currently plain `pb-btn pb-btn--icon`).
- [x] 2.4 Import `openConfirm` from `../tabs/confirm-dialog.js` in `skills.js` if not already imported.
- [x] 2.5 Add Playwright tests asserting: activating a skill row's `✕` opens a confirm dialog and issues no `PATCH` until confirmed; cancelling leaves the row; confirming issues the existing `deletedIds` patch and removes the row. Repeat for a talent/perk row.

## 3. Item/equipment deletion (sheet editor mode)

- [x] 3.1 In `apps/pip-boy/src/tabs/gear.js`, wrap the `data-remove-item` button's click handler in `openConfirm` with a generic message (e.g. `Rimuovere questo oggetto?`); move the existing `patchInv(section, { deletedIds: [...] })` call into `onConfirm`. Do not pass `danger: true`.
- [x] 3.2 Add `pb-btn--danger` to the `data-remove-item` button markup in `gear.js` (currently plain `pb-btn pb-btn--icon`) — both occurrences (the tag-bearing item row and the compact quantity row).
- [x] 3.3 Import `openConfirm` from `./confirm-dialog.js` in `gear.js` if not already imported.
- [x] 3.4 Confirm the `data-remove-tag` handler is left untouched (no confirm, no styling change) — this is the regression guard for the "tag removal stays instant" requirement.
- [x] 3.5 Add Playwright tests asserting: activating an item row's `✕` opens a confirm dialog and issues no `PATCH .../inventory` until confirmed; cancelling leaves the row; confirming issues the existing `deletedIds` patch and removes the row. Add a companion assertion that removing a tag from an item does NOT open any dialog.

## 4. Logout confirmation

- [x] 4.1 In `apps/pip-boy/src/main.js`, wrap the body of `doLogout()` in `openConfirm` with a message (e.g. `Uscire dalla sessione?`); move the existing `await logout(); showLogin();` sequence into `onConfirm`. Do not pass `danger: true`. Keep `doLogout` as the function passed to `setCaseNav({ exit: { onActivate: doLogout } })` at all three call sites (lines ~107, ~121, ~165) — only its internal body changes.
- [x] 4.2 Import `openConfirm` from `./tabs/confirm-dialog.js` in `main.js`.
- [x] 4.3 Confirm no change is needed to `#pb-nav-exit`'s critical-red glyph styling in `apps/pip-boy/src/styles/pipboy.css` — it stays as the trigger's danger cue.
- [x] 4.4 Add a Playwright test asserting: activating `ESCI` opens a confirm dialog and does not clear the session yet; cancelling leaves the sheet open and the session intact; confirming clears the session and returns to the login screen.

## 5. Verification

- [x] 5.1 Manually exercise all five flows in a running instance of `apps/pip-boy` (character delete, skill delete, talent delete, item delete, logout): confirm each opens a dialog, cancel leaves state unchanged, confirm performs the original action. (Verified via the Playwright suite driving a real Chromium browser through each flow — see `apps/pip-boy/tests/delete-confirmations.spec.ts`.)
- [x] 5.2 Manually verify tag removal and condition removal remain instant with no dialog. (Verified: `delete-confirmations.spec.ts`'s tag-removal test, and the pre-existing `sheet-layout.spec.ts` condition-removal test, both pass with no dialog.)
- [x] 5.3 Run `npm test` from `apps/pip-boy` (Playwright) and confirm all tests pass, including the new ones added in tasks 1.3, 2.5, 3.5, and 4.4.
