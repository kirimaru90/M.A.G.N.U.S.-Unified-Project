## 1. Build plumbing for the key

- [x] 1.1 `docker-compose.yml`: add `CARTO_BASEMAP_KEY: ${CARTO_BASEMAP_KEY:-}` to the `args` of `cms` and `pip-boy`, with a one-line comment pointing to carto.com/basemaps/apikey and the domain lock
- [x] 1.2 `apps/pip-boy/Dockerfile`: `ARG CARTO_BASEMAP_KEY=` and `sed` `__CARTO_BASEMAP_KEY__` → value in `/usr/share/nginx/html/src/tabs/basemap.js` (next to the existing `__BUILD_ID__` stamp)
- [x] 1.3 `apps/cms/Dockerfile`: `ARG CARTO_BASEMAP_KEY=` and `sed` `cartoBasemapKey: 'CARTO_KEY_TODO'` → value in `src/environments/environment.ts` before `npm run build`
- [x] 1.4 Note `CARTO_BASEMAP_KEY` in `docker-compose.override.yml.example` (unstamped live-edit → watermarked tiles; rebuild to get keyed tiles) and wherever the server `.env` variables are documented (`deploy/`, `start.sh`)

## 2. Pip-Boy basemap key

- [x] 2.1 Create `apps/pip-boy/src/tabs/basemap.js`: placeholder constant `__CARTO_BASEMAP_KEY__`, `globalThis.__PB_CARTO_KEY__` test override, exported `tileUrl()` that appends `?key=` only for a non-empty, non-placeholder key, and exported attribution markup (`© OpenStreetMap contributors, © CARTO`, both linked, `target="_blank" rel="noopener noreferrer"`)
- [x] 2.2 `map.js`: replace `TILE_URL` with `tileUrl()` from `basemap.js`
- [x] 2.3 `sw.js`: add `./src/tabs/basemap.js` to the precache list; bump `TILE_CACHE` to `pipboy-tiles-v3`; leave `TILE_HOST_SUFFIX` classification unchanged
- [x] 2.4 Test (Playwright): with `__PB_CARTO_KEY__` seeded, intercepted tile requests carry `key=<value>`; with no override (placeholder in source), tile URLs have no `key` param and no `__CARTO` text
- [x] 2.5 Test (Playwright): update `tile-cache-cap.spec.ts` (and any other spec naming `pipboy-tiles-v2`) to `v3`; assert a keyed tile URL lands in the tile cache and that a pre-existing `pipboy-tiles-v2` is deleted on activation

## 3. Pip-Boy attribution (permanent by default, configurable collapse)

- [x] 3.1 `basemap.js`: export `ATTRIBUTION_COLLAPSE_MS = null` with the comment from design D3 (`null` = permanent, CARTO-compliant; `5000` = previous OSM-style collapse, not CARTO-compliant). Move it out of `map.js`
- [x] 3.2 `map.js`: `showAttribution` renders the linked markup from `basemap.js`; `attributionDelay()` reads `__PB_MAP_ATTRIBUTION_MS__ ?? ATTRIBUTION_COLLAPSE_MS` and the `setTimeout` removal runs only for a positive number; rewrite the surrounding comments to describe both modes
- [x] 3.3 `pipboy.css` `.pb-map-attr`: keep container `pointer-events: none`, add `.pb-map-attr a { pointer-events: auto; color: inherit; }`, raise text contrast so it is legible over the filtered tiles; update the comment
- [x] 3.4 Confirm the line sits inside the map canvas and is visible in immersive mode
- [x] 3.5 Test (Playwright): rewrite `map-attribution.spec.ts`, seeding `__PB_MAP_ATTRIBUTION_MS__` per test. Default (`null`, plus one test with no override at all to pin the shipped default): present on entry; still present after >5 s and after pan/zoom; still present in immersive mode. Collapse (e.g. `250`): gone after the delay; does not reappear on pan/zoom; present again on re-entering the tab. Both modes: text contains "OpenStreetMap contributors" and "CARTO"; hrefs are `https://www.openstreetmap.org/copyright` and `https://carto.com/attribution` with `target="_blank"` and `rel~=noopener`; no `.leaflet-control-attribution` before/after zoom; a pan started on the line's non-link area moves the map

## 4. Pip-Boy credits

- [x] 4.1 `settings-popup.js`: keep the `CREDITI` view; link OpenStreetMap and CARTO in it; update the `openCreditsPopup` comment — it is the always-reachable fallback that makes collapse mode OSM-acceptable, it does not by itself satisfy CARTO, see `ATTRIBUTION_COLLAPSE_MS`
- [x] 4.2 Test (Playwright): `settings-credits.spec.ts` still finds OSM, CARTO, Leaflet; OSM and CARTO entries are links; credits are reachable with the map's attribution in either mode

## 5. CMS basemap key and attribution

- [x] 5.1 `environment.ts`: add `cartoBasemapKey: 'CARTO_KEY_TODO'`; `environment.development.ts`: add `cartoBasemapKey: ''`
- [x] 5.2 `campaign-map-page.ts`: add exported pure `cartoTileUrl(style, key)` (omits `key` for empty/placeholder); build both variants through it from `environment.cartoBasemapKey`, including the labels-toggle `setUrl` effect
- [x] 5.3 `campaign-map-page.ts`: set tile-layer `attribution` to `© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>, © <a href="https://carto.com/attribution" target="_blank" rel="noopener noreferrer">CARTO</a>`
- [x] 5.4 Test (Vitest, `campaign-map-page.spec.ts`): `cartoTileUrl` appends `?key=` for both styles with a key and omits it for `''` and the placeholder; the rendered attribution control contains both linked names and "contributors", and is unchanged after toggling labels

## 6. Verification

- [x] 6.1 Run `npx playwright test` from `apps/pip-boy` — all pass
- [x] 6.2 Run `npm test` from `apps/cms` — all pass, changed files ≥ 70% line coverage
- [ ] 6.3 With a real key in `.env`, `docker compose up -d --build pip-boy cms`: tiles render with no watermark in both apps, attribution visible and linked, and DevTools shows `pipboy-tiles-v2` gone after the SW activates
