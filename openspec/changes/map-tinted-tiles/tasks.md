## 0. Prerequisite

- [ ] 0.1 Archive `map-view-config-and-declutter` first: this change's delta specs modify the requirements that change introduces (`map-shared-core`) or rewrites (`pipboy-map-tab` basemap, `cms-campaign-map` preview)

## 1. Tint maths in map-core (design D3)

- [ ] 1.1 `apps/packages/map-core/style.js`: add `tintTables(rgb, { tone, sat })` (256-entry `level` over 8-bit luminance, 511-entry `mask` over `b − r`, the desaturated tint triplet, `tone.water`) and `tintPixels(data, tables)` (in place on RGBA bytes; `tables = null` leaves pixels untouched); `.d.ts` updated
- [ ] 1.2 Test (new `apps/pip-boy/tests/map-tint.spec.ts`, pure like `map-geometry.spec.ts`): `tintPixels` matches `filterOutput` within 2/255 for land `#0e0e0e`, water `#2c353c`, minor/major road greys, black, white and land/water mixes, in all three themes; water < land < road in output luminance; `null` tables pass pixels through. Run only this spec

## 2. Tinted tile layer and worker (design D1, D2, D4)

- [ ] 2.1 `apps/packages/map-core/tint-worker.js`: receives `{ type: 'tables', key, tables }` and `{ id, key, bitmap }` (transferred), draws on an `OffscreenCanvas`, runs `tintPixels`, and posts back the `ImageBitmap` (transferred) or `{ id, error }`
- [ ] 2.2 `apps/packages/map-core/tint-tiles.js` (+ `.d.ts`): `createTintedTileLayer(L, url, { tint, createWorker, ...tileLayerOptions })` subclassing `L.TileLayer`. `createTile` builds a `canvas.leaflet-tile`, loads with `crossOrigin = 'anonymous'`, tints, draws, and calls `done` only after drawing; errors call `done(err, canvas)`
- [ ] 2.3 `setTint(rgb | null, { tone, sat })`: re-decodes each loaded tile from its recorded URL and repaints the same canvas; a per-canvas generation counter drops results from a superseded tint; old pixels stay until replaced
- [ ] 2.4 Worker lifecycle: created lazily on the first tile, tables sent once per tint key, terminated on `onRemove`; main-thread fallback (same `tintPixels`) when `createWorker` is absent or throws, the worker errors, or `OffscreenCanvas` is missing
- [ ] 2.5 Remove `ensureTintFilter`, `filterMarkup` and `MAP_TINT_FILTER_ID` from `style.js` and its `.d.ts`; update the map-core README (contents, worker factory contract, the CORS requirement on the tile host)
- [ ] 2.6 Run `node scripts/sync-map-core.mjs`; both apps' copies gain `tint-tiles.js`, `tint-worker.js` and their `.d.ts` files
- [ ] 2.7 Test (Pip-Boy Playwright, extend `map-tint.spec.ts` with an in-page layer on a blank map page or the map fixture): a tile canvas holds the expected tinted pixel; `setTint` to another theme repaints the same canvas node; `setTint(null)` shows the source colour; with `createWorker` omitted the result is the same. Run only this spec and `map-core-drift.spec.ts`

## 3. Pip-Boy integration (design D5, D7)

- [ ] 3.1 `tests/fixtures.ts`: the CARTO tile stub serves a known-colour opaque PNG (e.g. CARTO land `#0e0e0e`) with `Access-Control-Allow-Origin: *`
- [ ] 3.2 `src/engine/theme.js`: drop `ensureTintFilter`; keep the current triplet behind `currentPhosphorRgb()`; dispatch `pb-phosphor-change` (`{ rgb }`) on `document`; update the header comment
- [ ] 3.3 `src/tabs/map.js`: build the layer with `createTintedTileLayer(L, tileUrl(), { tint: currentPhosphorRgb(), createWorker, minZoom, maxZoom })`, with `createWorker` resolving `../shared/map-core/tint-worker.js` via `import.meta.url`; listen for `pb-phosphor-change` → `setTint`, removed on `unload`
- [ ] 3.4 `src/styles/pipboy.css`: remove the tile-pane `filter: url(#pb-phosphor-tint)` rule and its comment ("1. The Fallout filter"); keep the `text-shadow` reset; renumber the section's comments
- [ ] 3.5 `sw.js`: `TILE_CACHE = 'pipboy-tiles-v4'` with a v4 note in the comment; `tileCacheFirst` caches only `response.ok`; precache `tint-tiles.js` and `tint-worker.js`; bump `CACHE_VERSION` as the deploy rules require
- [ ] 3.6 Tests:
  - `map-tab.spec.ts`: replace the filter-reference assertion with "tiles are canvases with the VERDE-tinted pixel, the pane's computed `filter` is `none`, `text-shadow` is still reset".
  - `map-theme.spec.ts`: replace the `feColorMatrix` assertions with "a COLORE change repaints the same tile canvases to the amber/white pixel, no remount".
  - `map-basemap-key.spec.ts`: still green with CORS requests.
  - `tile-cache-cap.spec.ts`: v4 name; an opaque response is not cached; a pre-existing `pipboy-tiles-v3` is deleted on activate.
  - Run only these specs.

## 4. CMS integration (design D4, D6)

- [ ] 4.1 Spike: confirm the Angular builder bundles `new Worker(new URL('../../shared/map-core/tint-worker.js', import.meta.url), { type: 'module' })` from `campaign-map-page.ts` (`ng build`, worker chunk emitted and loads in `ng serve`). If not, add the worker as an `angular.json` asset and pass its asset URL instead
- [ ] 4.2 `campaign-map-page.ts`: build the tiles with `createTintedTileLayer` (labels URL, attribution, `createWorker`); the labels effect keeps calling `setUrl`; `applyPreview` calls `setTint(on ? PHOSPHOR_THEMES.green.rgb : null)` and keeps the marker variables; remove the pane `style.filter` and the `ensureTintFilter` / `MAP_TINT_FILTER_ID` imports
- [ ] 4.3 CMS Vitest (`campaign-map-page.spec.ts`): preview on → `setTint` with VERDE's triplet, off → `setTint(null)`; the tile pane never has a `filter` style; labels on with the preview on → `setUrl` with the labelled URL and the tint unchanged; replace the existing `url(#pb-phosphor-tint)` assertions. Run only this spec and `map-core-drift.spec.ts`

## 5. Map lab (design D8)

- [ ] 5.1 `tools/map-lab/map-lab.html`: replace the `<filter>` built from `filterMarkup` with the tinted layer; theme, preset and slider input call `setTint(rgb, { tone, sat })`; contrast figures keep using `filterOutput`
- [ ] 5.2 `tools/map-lab/README.md`: describe the tinted layer instead of the SVG filter. Verify by running `npm run map-lab` and moving each slider (manual; the lab is dev-only and not under test)

## 6. Wrap-up

- [ ] 6.1 Search both apps and map-core for `pb-phosphor-tint`, `ensureTintFilter`, `filterMarkup` and `MAP_TINT_FILTER_ID`; none left outside archived openspec changes
- [ ] 6.2 Run the full Pip-Boy Playwright suite (`npx playwright test` in `apps/pip-boy`) and the CMS suite (`npm test` in `apps/cms`, ≥ 70% line coverage on changed files); both drift checks green; all green before archiving
- [ ] 6.3 Manual, on an Android phone: pinch and animated zoom (tap a place, search, Vedi mappa) are smooth; side by side with the previous build the map looks the same in VERDE, AMBRA and BIANCO at the "Costa ovest", "Baia di SF" and "Los Angeles" zooms; a theme switch repaints without a flash; offline after the update, previously cached areas are refetched once and then work offline
- [ ] 6.4 Manual, CMS: preview on matches the Pip-Boy VERDE map; preview off is plain CARTO; labels plus preview tints the labelled basemap
