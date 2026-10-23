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
- [x] 6.6 Profile pan/zoom on a low-end Android device with the **D8** filter graph (not the old single matrix); record the outcome (keep it, drop the water mask, or fall back per design Risks and amend the spec)

> 6.1, 6.4 and the marker half of 6.3/6.5 are superseded by sections 7 and 8 (design D8, D9).

## 7. Pip-Boy — basemap tone curve (design D8)

- [x] 7.1 In `engine/theme.js` replace `MAP_TINT_GAIN` and `tintMatrix` with the `MAP_TONE`, `MAP_TINT_SAT` and `MAP_WATER_MASK_GAIN` tokens, plus pure helpers: `toneTable(tone)` (256 values), `tintColour(rgb, sat)`, `filterMarkup(rgb)`
- [x] 7.2 Build the filter graph in the injected `<filter id="pb-phosphor-tint">`: luminance → table → water mask → flood/composite → merge → tint; rebuild it on theme change without remounting
- [x] 7.3 Unit specs (`tests/theme.spec.ts`): the table passes through the curve points; for each theme, the output order is water < land < road on the measured colours (`#2c353c`, `#0e0e0e`, `#494949`); the mask is ≈1 on water and ≈0 on land
- [x] 7.4 Update `map-theme.spec.ts`: the filter references `#pb-phosphor-tint` and contains the table and mask primitives; the tint changes VERDE → AMBRA without remount

## 8. Pip-Boy — monochrome markers (design D9)

- [x] 8.1 Remove `markerRgb` from `PHOSPHOR_THEMES`, the `--map-marker-rgb` write in `applyPhosphorTheme` and its `:root` default
- [x] 8.2 In `pipboy.css`: icon stroke `--phosphor-bright` 1.9 with the `screen-bg` knockout + phosphor glow; label in `--phosphor` with `opacity: .8` and a `screen-bg` halo; badge in `--phosphor-bright` on `--screen-bg`
- [x] 8.3 Unit spec: for each theme, WCAG contrast of `--phosphor-bright` ≥ 4.5:1 against the filter output for land, water and roads
- [x] 8.4 Replace the "amber on VERDE / green on AMBRA and BIANCO" Playwright test: the stroke is the theme's bright triplet on all three themes; the label opacity is < 1; markers recolour in place on theme change

## 9. Map lab tool (design D10)

- [x] 9.1 Create `apps/pip-boy/tools/map-lab/map-lab.html` from the exploration prototype in `openspec/changes/map-view-config-and-declutter/assets/map-lab.prototype.html`. Keep the `__CARTO_KEY__` placeholder; load Leaflet from the vendored `src/vendor/leaflet/` (ESM); add a "Scelta" preset with the D8/D9 tokens; add a header comment naming `engine/theme.js` as the source of truth
- [x] 9.2 Create `apps/pip-boy/tools/map-lab/serve.mjs` with no dependencies (`node:http`, `node:fs`, `node:path`). It reads `CARTO_BASEMAP_KEY` from the repo-root `.env`, serves the page with the key replaced in memory, serves `src/vendor/leaflet/`, binds to `localhost` only, prints the URL and opens the browser. With no key it still serves and warns in the console
- [x] 9.3 Add `"map-lab": "node tools/map-lab/serve.mjs"` to `apps/pip-boy/package.json`, and `tools` to `apps/pip-boy/.dockerignore`
- [x] 9.4 Write `apps/pip-boy/tools/map-lab/README.md`, covering:
  - what the lab is for;
  - how to run it (`npm run map-lab`, the `.env` key, CARTO's domain lock and `localhost`);
  - what each control means;
  - the measured CARTO colours;
  - how to bring a result back: "Copia parametri" → the tokens in `theme.js` → update the "Scelta" preset;
  - why it is a server and not a file (no key on disk, ESM Leaflet).
- [x] 9.5 Verify: `npm run map-lab` opens a page with real tiles; the "Scelta" preset matches the Pip-Boy MAPPA tab side by side; `docker build` of pip-boy does not contain `tools/`

## 11. CMS — start view race (design D1 revision)

- [x] 11.1 In `applyStartView`, replace `setMinZoom`/`setMaxZoom` with direct `map.options.minZoom`/`maxZoom` assignment, then `setView(…, { animate: false })`, then `fire('zoomlevelschange')`
- [x] 11.2 Vitest: with a map at zoom 6 and a loaded range 8–16, `applyStartView` calls none of `setZoom`/`setMinZoom`/`setMaxZoom`/`flyTo`, and ends on the loaded centre and zoom
- [x] 11.3 Manual, real browser: a campaign with `minZoom` > 6 opens on its start view and is still there after one second

## 12. Shared map core (design D11)

- [x] 12.1 Create `apps/packages/map-core/` with `style.js` (the tokens, themes and filter helpers now in `theme.js`, plus `ensureTintFilter(doc, rgb)`), `geometry.js` (move `map-geometry.js`), `icons.js` (move `ICONS`, `TYPE_DEFAULT_ICON`, `iconFor` from `map.js`), `.d.ts` files, and `README.md`
- [x] 12.2 Write `scripts/sync-map-core.mjs`: copy into `apps/pip-boy/src/shared/map-core/` and `apps/cms/src/app/shared/map-core/` with a "generated, edit apps/packages/map-core" header; `--check` exits non-zero and names differing files
- [x] 12.3 Pip-Boy: import from the copy in `theme.js` and `map.js`, delete `src/tabs/map-geometry.js`, update `sw.js` `REQUIRED_SHELL_URLS`, and repoint `tests/map-geometry.spec.ts` / `tests/theme.spec.ts` at the copy
- [x] 12.4 Map lab: `serve.mjs` exposes `/src/shared/map-core/` in place of `/src/engine/theme.js`; `map-lab.html` builds its filter with `filterMarkup(rgb, { tone, sat })` from the slider values and drops its hand-mirrored graph; README names the package as the source of truth
- [x] 12.5 Drift check in both suites: a Playwright spec in the Pip-Boy and a Vitest spec in the CMS that run `sync-map-core.mjs --check`
- [x] 12.6 CMS: `place-tree.ts#effectiveRadius` re-exports the core's; `place-tree.spec.ts` stays green; update the "three implementations" comment in `geometry.js` to two (core + API)

## 13. Shared marker layer (design D12)

- [x] 13.1 Extract `createMarkerLayer(L, map, opts)` into `marker-layer.js`: render plan (visible → include → focused → declutter → labelPass), marker sync, bloom/collapse on `zoomanim`, badge in place, label measurement cache, separate-on-tap default. Move the structural marker CSS from `pipboy.css` to `markers.css`, with `--mk-icon`, `--mk-label` and `--mk-halo`
- [x] 13.2 Pip-Boy: `map.js` builds on the layer with no behaviour change (popup, focus, search, breadcrumb, zoom floor stay in `map.js`). `pipboy.css` maps `--mk-*` to the phosphor variables. `index.html` links `markers.css`. All existing map Playwright specs green before moving on
- [x] 13.3 CMS: replace `syncMarkers` and the `.cm-marker*` styles with the layer: `focused` = selected slug, `include` = name filter, `markerOptions` = draggable, `onClick` = select, `onDragEnd` = the current drag handler; add `markers.css` to `angular.json` `styles`
- [x] 13.4 CMS Vitest: Pip-Boy icon per type; child absent until its parent is open; the selected place is always present and draggable; public and non-public places overlap into one `+N`; badge tap zooms in; colliding labels are hidden; the name filter hides non-matching markers without changing open places; tree collapse leaves markers unchanged

## 14. CMS colours and filter preview (design D13)

- [x] 14.1 CMS palette: public `--mk-icon`/`--mk-label` `#66bb6a`, non-public (hidden or inherited) `#ef5350` through an `is-hidden` marker class
- [x] 14.2 Preview on: call `ensureTintFilter(document, PHOSPHOR_THEMES.green.rgb)`, set the tile pane to `url(#pb-phosphor-tint)`, and switch public markers to the VERDE `--phosphor-bright` / `--phosphor` values; red stays. Preview off: no tile filter. Remove the old `.cm-filtered` chain and its "exact token" comment
- [x] 14.3 CMS Vitest: the preview toggles the `url(#pb-phosphor-tint)` reference and the filter carries the VERDE tint; a non-public marker has the red class in both preview states; an inherited marker is red too

## 10. Wrap-up

- [x] 10.1 Run API unit + e2e, CMS Vitest, and the Pip-Boy Playwright suite; all green (before the D8–D10 revision)
- [x] 10.2 Re-run the Pip-Boy unit and Playwright suites after sections 7–9; all green
- [x] 10.4 Re-run API, CMS Vitest and the Pip-Boy suites after sections 11–14, including both drift checks; all green
- [x] 10.3 Manual check across the three themes on a real campaign: CMS (preview on) ↔ Pip-Boy VERDE look the same, with the same markers collapsed at the same zoom, start view parity CMS ↔ Pip-Boy, zoom-out floor, declutter readability, sea/land/coast legibility at the "Costa ovest", "Baia di SF" and "Los Angeles" zooms
