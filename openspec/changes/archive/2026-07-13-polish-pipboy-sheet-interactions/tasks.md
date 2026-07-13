# Tasks

## 1. Shared add popup component (foundation)

- [x] 1.1 Create `src/tabs/add-popup.js` exporting `openAddPopup({ title, catalog, custom, onAdd })` — hoist the overlay/`.pb-popup` chrome, inner-tab switching, `✕`/backdrop cancel, and the active-pane `OK` handler out of the existing popups. `catalog` = `{ entries, kindNoun, toItem(entry) }` (omit → "Scegli esistente" tab hidden); `custom` = `{ renderFields(paneEl), readItem(paneEl) }`.
- [x] 1.2 Refactor `src/tabs/add-item-popup.js` to configure `openAddPopup` (weapon/armor tag-shaped custom pane; consumable/misc name+description+quantity pane; catalog filtered by `kind`), preserving current behaviour.
- [x] 1.3 Refactor `src/tabs/condition-popup.js` to configure `openAddPopup` (custom pane = name + sign toggle + weight toggle; catalog = conditions presets with polarity routing), preserving current behaviour.
- [x] 1.4 Run the existing `add-item`/`catalog-picker` Playwright specs and confirm they stay green after the refactor.

## 2. Read-only item detail popup (item #5)

- [x] 2.1 Add `openInfoPopup({ title, body })` (new minimal modal, no tabs) — either in `add-popup.js` or a small `src/tabs/info-popup.js`.
- [x] 2.2 Add `.pb-info-popup` CSS: fixed ~80% of screen surface, internal `overflow-y:auto` body, `✕` + backdrop close, on-theme (square corners, phosphor).
- [x] 2.3 In `src/tabs/gear.js`, make consumable/misc names activatable to open the detail popup with the item's name + description (opens with empty body when no description).

## 3. Inventory quantity rows + sticky resources (items #4, #8)

- [x] 3.1 In `gear.js` `qtyItemRow`, remove the inline description (`withDesc`) branch and right-align the `[−][+]` quantity stepper.
- [x] 3.2 Update the CSS for `.pb-consumable-row` so the stepper sits hard-right (e.g. `margin-left:auto`), name on the left.
- [x] 3.3 Make `.pb-resource-row` `position: sticky; bottom: 0` with an opaque screen-bg backing; add bottom padding to the list equal to the resource row height so the last item clears it.
- [x] 3.4 Verify (Playwright) that with a long list the resource row stays in view after scrolling and the qty rows show no description.

## 4. Skill level square stepper (item #2)

- [x] 4.1 In `src/tabs/skills.js` `skillsEdit`, replace the `<select>` per row with a bounded `[−] ▪▪▫ [+]` stepper: name left (lateral label), `pips(SKILL_LEVELS.indexOf(level)+1, 3)` squares + `−`/`+` grouped right, `✕` remover; enum string retained as the lateral indicator.
- [x] 4.2 Wire `−`/`+` to clamp the level index to `SKILL_LEVELS` (COMPETENTE..MAESTRO) and PATCH `{ items: [{ id, level }] }`; disable `−` at COMPETENTE and `+` at MAESTRO.
- [x] 4.3 Add the CSS for the skill maestria stepper row (reusing `.pb-stepper`/`.pb-pips` vocabulary).
- [x] 4.4 Verify (Playwright) no `<select>` remains for skill level and the square count/enum/persist behave.

## 5. Unified add flow for skills & talents (items #7, #10)

- [x] 5.1 Add `getTalentsCatalog()` to `src/api/catalogs.js` returning `[]` on any failure; ensure a `400`/absent endpoint never surfaces an error banner.
- [x] 5.2 In `skills.js`, replace the inline `+ ABILITÀ` add row with a `+` trigger opening `openAddPopup`: "Scegli esistente" over the skills catalog (entries not already on the character, keyed by `slug`); "Aggiungi custom" = name + initial maestria, deriving a client-side slug for the custom skill.
- [x] 5.3 In `skills.js`, replace the inline `+ TALENTO` add row with a `+` trigger opening `openAddPopup`: "Scegli esistente" over `getTalentsCatalog()` (renders empty when unavailable); "Aggiungi custom" = name + description → PATCH `{ items: [{ name, description }] }`.
- [x] 5.4 Make the skills/talents `+` triggers available whenever the user may write the character (both view and editor mode), matching inventory; remove the dashed inline add rows.
- [x] 5.5 Verify (Playwright/unit) the talents catalog `400` degrades to an empty selection tab with no error, and custom add works for both.

## 6. Editor toggle in bezel + green LED (item #9)

- [x] 6.1 In `index.html`, move `#pb-editor-toggle` out of `#pb-statusbar-nav` into a new bottom-right slot in `.pb-bezel`, and add a sibling `#pb-editor-led` element.
- [x] 6.2 In `src/engine/chrome.js`, update `showSheetNav`/`hideSheetNav` to resolve the toggle from its new bezel location, and extend `setEditorChrome(on)` to toggle the LED's lit (`.on`) state.
- [x] 6.3 Add CSS: bezel toggle placement, and `#pb-editor-led` as a small round green LED (unlit by default, phosphor-green glow when `.on`); ensure the bezel height is unchanged and add the LED to the border-radius exception set.
- [x] 6.4 Verify (Playwright) the toggle renders in the bezel (not the status bar), the LED lights green with editor mode, and the amber critical dot/ring still coexist without sharing color.

## 7. Header PA-to-tabs spacing (item #3)

- [x] 7.1 Add a 2px margin between the header PA control and the tab bar (CSS on `.pb-pa-control`/`.pb-header` bottom, or the tab bar's top), without altering the PA control's internal layout.

## 8. Session re-verification on resume (item #1)

- [x] 8.1 Add `reverify()` to `src/api/session.js` wrapping `GET /auth/me`: resolve → refresh `_currentUser`; `401` → clear session; transport error (no `err.status`) → signal no-op. Reuse the existing 401-vs-transport discrimination.
- [x] 8.2 In `src/main.js`, register `visibilitychange` (visible) + `pageshow` listeners once at module scope; on resume with a token present, call `reverify()`; on `200` silently reload+re-render the mounted character (via the existing show-sheet path), on `401` route to `showLogin()`, on transport error no-op. Guard against overlapping/no-token calls.
- [x] 8.3 Verify (Playwright with a mocked `/auth/me`): valid→refresh in place (no login), `401`→login, offline→stays put, anonymous→no request.

## 9. Verification & cleanup

- [x] 9.1 Confirm the misc custom-add description box is present (item #6); add a regression assertion if missing.
- [x] 9.2 Run the full `apps/pip-boy` Playwright suite and fix any regressions.
- [x] 9.3 Sanity-sweep the terminal-chrome invariants: no new non-monospace fonts/colors, only the named elements are rounded (incl. the new editor LED), no emoji introduced.
