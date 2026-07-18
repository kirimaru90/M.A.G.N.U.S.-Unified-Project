# Tasks

Order: the pure geometry lands first (everything else calls it), then the popup, then the action and focus primitive it enables, then search on top of focus, and the breadcrumb change last since it is independent. Each group carries its own test task; the change is not done while any Playwright or unit spec is red.

All of this is one file's worth of behaviour (`src/tabs/map.js`) plus two pure helpers (`src/tabs/map-geometry.js`) and styling (`src/styles/pipboy.css`). No API, CMS, service-worker, or navigation change.

## 1. Geometry: derived zooms

- [x] 1.1 Add `containZoom(place, radii, viewportPx, zoomRange)` to `src/tabs/map-geometry.js`: the least zoom at which `vr(zoom) ≤ R(place)`, i.e. the inverse of `viewportRadius`, clamped to `[minZoom, maxZoom]`. Pure — no DOM, no Leaflet.
- [x] 1.2 Add `revealZoom(place, places, radii, viewportPx, zoomRange)`: a zoom whose `vr` lies within `( R(place), R(parent) ]` so the place's marker renders (ancestors `APERTA`, place not). For a place with no parent, target a `vr` a step larger than `R(place)`. Clamp to the range.
- [x] 1.3 Unit-test both in the existing `map-geometry` spec: `containZoom` makes `isOpen` true at its zoom and false one integer step further out; a larger effective radius yields a lower contain zoom; `revealZoom` makes `visible` include the place (ancestors open, place closed) for a deep leaf.

## 2. Marker popups

- [x] 2.1 In `mountMap` (`src/tabs/map.js`), bind a popup to each marker in `addMarker`: content is the place `name`, a type line, and `esc(place.desc)`, in the existing `.leaflet-popup-*` phosphor styling. Use Leaflet's `bindPopup`/`L.popup` so the popup is torn down with the marker on `removeMarker` — this is what closes it when the place opens or pans off.
- [x] 2.2 On marker `click`, centre the place (`focusPlace`, §4) and open its popup. Ensure the click does not also trigger a pan/no-op that closes it.
- [x] 2.3 Style: extend `src/styles/pipboy.css` for the popup's type line and (in §3) the *Vedi mappa* button, reusing the popup wrapper rules already present. Keep the phosphor tokens; add no new colours.
- [x] 2.4 `apps/pip-boy/tests/map-place-focus.spec.ts`: tapping a marker centres its place and shows a popup with its name and `desc`; the popup closes when the place is zoomed open (marker removed) and when panned out of the visible set. Drive zoom through `globalThis.__PB_MAP__`.

## 3. Vedi mappa

- [x] 3.1 In the popup content, render a **Vedi mappa** action iff `place.hasLocalMap && kids(places, place.slug).length > 0`.
- [x] 3.2 Wire the action to `focusPlace(place, { open: true })`, which sets the view to `containZoom(place)` (§1.1) — the place opens, its children bloom via the existing `zoomanim` path, and its marker (with popup) leaves the set.
- [x] 3.3 Extend `map-place-focus.spec.ts`: a place with a local map shows the action and a leaf does not; activating it raises the zoom until the place is `APERTA` and its children render; the popup is gone afterward.

## 4. Focus primitive

- [x] 4.1 Add `focusPlace(place, { open })` to `mountMap`: compute the target zoom — `containZoom` when `open`, else `revealZoom` — and `map.setView([place.lat, place.lng], zoom)`, reusing the existing animation/bloom path. When the target marker is not yet present (hidden place), defer opening the popup to `map.once('moveend')`/`zoomend`, then open it on the now-rendered marker.
- [x] 4.2 Route the marker `click` (§2.2) through `focusPlace(place, { open: false })` so tap and search share one path.
- [x] 4.3 Extend `map-place-focus.spec.ts`: focusing a place whose marker is currently hidden (ancestor closed) moves the view until the marker renders and opens its popup; the centre + popup state matches a direct marker tap for a visible place.

## 5. Search

- [x] 5.1 Add a lens control mounted in a corner of `.pb-map-canvas` (absolutely positioned, above tiles, within the `data-pb-no-swipe` region), toggling an expanding search field with an autocomplete list. Style in `src/styles/pipboy.css` on existing tokens.
- [x] 5.2 Match the typed text against `place.name` across the received `places`, case- and accent-insensitively (`normalize('NFD')`, strip combining marks, case-fold); rank earliest-match-first; cap the list. `Escape` and the lens dismiss the field; arrow keys + `Enter` move and commit.
- [x] 5.3 On selection, call `focusPlace(place, { open: false })` (§4) and dismiss the field.
- [x] 5.4 `apps/pip-boy/tests/map-search.spec.ts`: the lens toggles the field; an accent-folded partial name lists the matching place; selecting a currently-hidden result reveals its marker and opens its popup (same end state as a tap); a non-admin session whose response omitted a non-public place never lists it (index is the received set); `Escape` closes the field.

## 6. Breadcrumb

- [x] 6.1 In `renderZone` (`src/tabs/map.js`), change the root label constant to `Terre contaminate` and show it only when the chain is empty.
- [x] 6.2 Cap the rendered chain to the last three levels; when the chain is longer, lead with a `…` marker. Keep the deepest entry emphasised and the existing left-truncation-by-width as the width fallback.
- [x] 6.3 Extend `apps/pip-boy/tests/map-tab.spec.ts`: the root reads `Terre contaminate` when inside no open place; a four-deep chain renders `… › B › C › D`; the root label never appears beside a named level.

## 7. Verify

- [x] 7.1 Run `npx playwright test` from `apps/pip-boy` and confirm all specs pass, including the extended `map-tab.spec.ts` and the new `map-place-focus.spec.ts` / `map-search.spec.ts`.
- [x] 7.2 By eye against the prototype: the *Vedi mappa* framing fits the interior, the search field's expand reads cleanly, and the popup sits above its marker. Record any settled offsets/timings in design.md.
