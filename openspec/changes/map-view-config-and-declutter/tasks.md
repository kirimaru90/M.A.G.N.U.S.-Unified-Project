## 1. API — startZoom range validation

- [x] 1.1 Add a `StartZoomWithinRange` cross-field validator next to `MinZoomNotAboveMaxZoom` in `apps/api/api/src/campaign-map/dto/campaign-map.dto.ts`, applied to `MapConfigDto.startZoom`
- [x] 1.2 Unit specs in `campaign-map.dto.spec.ts`: reject startZoom below minZoom and above maxZoom; accept startZoom equal to either edge
- [x] 1.3 E2E in `test/campaign-map.e2e-spec.ts`: PUT with out-of-range startZoom → 400 and stored map unchanged
- [x] 1.4 Update the `startZoom` ApiProperty description, regenerate `openapi.json` / CMS `openapi-types.ts` if the description is emitted

## 2. CMS — start view, labels, validation

- [x] 2.1 Add `applyStartView(cfg)` in `campaign-map-page.ts` and call it from `load()`'s `next` handler after `config.set(...)` (no effect on `config()`)
- [x] 2.2 Rename the zoom labels to "Zoom minimo (più lontano)" / "Zoom massimo (più vicino)"
- [x] 2.3 Add a `configError` computed (minZoom > maxZoom, startZoom outside range) with an Italian message under the zoom fields; disable **Salva** while it is non-null
- [x] 2.4 Vitest in `campaign-map-page.spec.ts`: map built before load resolves ends on the loaded start view; editing start fields does not move the view; campaign switch re-frames; labels present; out-of-range startZoom disables save

## 3. Pip-Boy — pure geometry

- [x] 3.1 In `map-geometry.js` add `TYPE_RANK` and `declutter(items, { focused, box, pad })` returning `{ placed, absorbedBy, groups }` per design D4
- [x] 3.2 Add `labelPass(placedItems, sizes, order)` returning the set of hidden-label slugs (design D6)
- [x] 3.3 Add `separationZoom(points, zoom, range, box, pad)` (design D5) and `effectiveMinZoom(configMin, configMax, boundsZoom)` (design D3)
- [x] 3.4 Unit specs in `tests/map-geometry.spec.ts`: priority order and tie-breaks; focused wins; absorbed places take no space (A–B–C chain); label pass hides lower priority and labels over icons; separation zoom incl. identical coordinates and clamp; effective min zoom clamp

## 4. Pip-Boy — effective zoom range

- [x] 4.1 Replace the `zoomRange` constant in `map.js` with `zoomRangeNow()` using the map's current min zoom; route `containZoom` / `revealZoom` through it
- [x] 4.2 Compute and apply the bounds floor (`getBoundsZoom` + `effectiveMinZoom`) after the first `invalidateSize`, on Leaflet `resize`, and in `revalidateAfterResize`
- [x] 4.3 Playwright: zoom clamp with non-default `minZoom`/`maxZoom` (e.g. 8–12); zoom-out stops at the bounds floor; entering immersive recomputes the floor

## 5. Pip-Boy — marker declutter, badge, popup

- [x] 5.1 Introduce `renderPlan(zoom, centre)` (visible → declutter → labelPass, items projected with `map.project(latlng, zoom)`) and replace every `visibleSet` use (`syncMarkers`, `zoomanim`, `zoomend`, resize)
- [x] 5.2 Keep the previous plan; in `zoomanim` use the absorber (before/after) as bloom source / collapse target, falling back to `nearestVisibleAncestor`
- [x] 5.3 Track `focusedSlug`: set in `focusPlace` before `setView`, cleared on `popupclose` followed by a re-plan at the current zoom
- [x] 5.4 Add the `+N` badge span to the divIcon; update it in place after each plan; call `setPopupContent` with the "Nelle vicinanze:" line when a winner's group changes
- [x] 5.5 Badge tap: stop propagation, compute `separationZoom` for the group, `setView` on the group's bounds centre with animation, no popup
- [x] 5.6 Label measurement cache (after `document.fonts.ready`) and `is-label-hidden` toggling from the plan
- [x] 5.7 Badge and hidden-label styles in `pipboy.css`
- [x] 5.8 Playwright: overlapping top-level places → one marker with `+N`; popup lists names; badge tap separates; searched absorbed place renders with popup; pan does not change absorption; overlapping labels hidden while icons remain; absorption animates
- [x] 5.9 Re-run existing map specs; spread fixture coordinates where fixtures overlap by accident rather than weakening the declutter

## 6. Pip-Boy — theme-driven tint and marker colour

- [x] 6.1 In `engine/theme.js` add `markerRgb` per theme (green→amber, amber→green, white→green) and write `--map-marker-rgb`
- [x] 6.2 In `applyPhosphorTheme` ensure the hidden SVG `<filter id="pb-phosphor-tint">` node exists and update its `feColorMatrix` values from the theme rgb and `MAP_TINT_GAIN` (design D7)
- [x] 6.3 In `pipboy.css` replace the fixed tile filter chain with `url(#pb-phosphor-tint)`; add a `--map-marker-rgb` default in `:root`; switch marker stroke, glow, label and badge to the marker colour, keep popup/breadcrumb/search on `--phosphor`
- [x] 6.4 Tune `MAP_TINT_GAIN` (and an optional trailing `contrast()`) by eye so the green theme matches the previous look
- [x] 6.5 Playwright: replace the `sepia(1)`/`hue-rotate(90deg)` assertion with "filter references `#pb-phosphor-tint` and the node exists"; matrix changes VERDE→AMBRA without remount; marker stroke amber on VERDE, green on AMBRA and BIANCO; popup stays in the phosphor colour
- [ ] 6.6 Profile pan/zoom on a low-end Android device; record the outcome (keep the SVG filter, or fall back per design Risks and amend the spec)

## 7. Wrap-up

- [x] 7.1 Run API unit + e2e, CMS Vitest, and the Pip-Boy Playwright suite; all green
- [ ] 7.2 Manual check across the three themes on a real campaign: start view parity CMS ↔ Pip-Boy, zoom-out floor, declutter readability
