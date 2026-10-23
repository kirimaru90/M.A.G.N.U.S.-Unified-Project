## 1. Sheet refresh handle

- [x] 1.1 In `apps/pip-boy/src/screens/sheet.js`, make `renderSheet` return `{ refresh(character) }`: merge the fresh data with `Object.assign` into the existing `character`, then redraw header, strip, footer and resource band
- [x] 1.2 In `refresh`, redraw the active tab only when `activeTop !== 'map'`, edit mode is off and no `.pb-popup-overlay, .pb-picker-overlay` is in the document; define the overlay selector once with a comment naming the popups it covers
- [x] 1.3 Around that redraw, save `contentEl.scrollTop` and restore it once the tab's content has settled (Decision 3: at once and in the next frame, then re-applied on `ResizeObserver` callbacks until it sticks, bounded to 2 s)
- [x] 1.4 In `apps/pip-boy/src/main.js`, store the handle on `mountedSheet` in `showSheet`, and make `onResume` call `handle.refresh(character)` (keeping the still-mounted guard) instead of `showSheet`; update the resume comment block to say "refresh in place"
- [x] 1.5 Extend the valid-token test in `apps/pip-boy/tests/auth-resume.spec.ts`: move to a non-default position (e.g. `INFO › Quest`, with `STATS` left on a non-first subtab), resume, and assert the renamed header **and** that both positions survived. Run `npx playwright test tests/auth-resume.spec.ts`

## 2. Safe-redraw rules under test

- [x] 2.1 New test in `auth-resume.spec.ts`: open the note editor, type text, resume with a valid token, and assert the editor is still open with the text; save, and assert the notes list on the sheet shows the saved note
- [x] 2.2 New test in `auth-resume.spec.ts`: turn ✎ edit mode on, type into an inline input without committing, resume, and assert edit mode is on, the typed value is still in the input, and the header shows the reloaded name
- [x] 2.3 New test in `auth-resume.spec.ts`: on `STATS › Salute`, scroll the content, have the server return changed data, resume, and assert Salute shows the reloaded value with the scroll position unchanged
- [x] 2.4 Run `npx playwright test tests/auth-resume.spec.ts`

## 3. Map view retained within a sheet

- [x] 3.1 In `sheet.js`, create a per-sheet `mapView = { center: null, zoom: null }` holder next to `diceState` and pass it to tabs as `ctx.mapView`
- [x] 3.2 In `apps/pip-boy/src/tabs/map.js`, start `L.map` from `mapView` when it has a centre and no `focusSlug` is pending (else from `config.start*`), re-apply that start view after the first frame's `invalidateSize`, and write centre/zoom back into it on every `moveend` and at the end of the first frame
- [x] 3.3 New test in `apps/pip-boy/tests/map-tab.spec.ts` (reusing its `openMap` helper): pan/zoom via `__PB_MAP__`, switch to another tab and back, assert the same centre/zoom; then tap PA +/- in the header and assert it again
- [x] 3.4 New test in `map-tab.spec.ts`: pan the map, return to the dossier, open another character, select `MAPPA`, and assert the campaign start view; also assert the sheet opened on `STATS › Salute`
- [x] 3.5 Extend `apps/pip-boy/tests/codex-map-link.spec.ts`: with a remembered view set, a codex `MAPPA` jump still focuses the place, and a later tab switch back to `MAPPA` resumes the focused view
- [x] 3.6 Extend `auth-resume.spec.ts`: on `MAPPA`, panned and in immersive mode, a resume leaves the same `__PB_MAP__` instance at the same centre/zoom and immersive still on
- [x] 3.7 Run `npx playwright test tests/map-tab.spec.ts tests/codex-map-link.spec.ts tests/auth-resume.spec.ts`

## 4. Wrap-up

- [x] 4.1 Run the full Pip-Boy suite once (`npx playwright test` from `apps/pip-boy`) and confirm everything passes
