## Why

Since late August 2026 CARTO serves every keyless raster basemap tile as a grey "API KEY REQUIRED" placeholder (still HTTP 200, ETag `wm-…`), so both the Pip-Boy `MAPPA` tab and the CMS campaign map render no basemap at all. Using a key binds us to the CARTO Basemaps Terms, whose attribution rule — "© OpenStreetMap contributors, © CARTO, both linked, visible on the map itself … Not hidden, faded or behind a click" — the Pip-Boy's five-second collapse and both apps' unlinked, "contributors"-less text do not meet; CARTO may suspend a key on maps without the credit.

## What Changes

- Both apps append a CARTO basemap key (`?key=…`) to every tile URL. The key is supplied at image-build time from a `CARTO_BASEMAP_KEY` environment variable (`.env` → `docker-compose.yml` build arg → stamped into the source), the same mechanism already used for `API_BASE_URL` and `BUILD_ID`. It is never committed.
- When no key is stamped (unstamped local source, a build without the variable), tile URLs carry no `key` parameter rather than a literal placeholder — the map degrades to CARTO's watermarked tiles instead of erroring.
- **BREAKING (spec)**: Pip-Boy basemap attribution becomes **permanent by default**. A small corner line reading `© OpenStreetMap contributors, © CARTO`, each name a link, stays on the map for the whole visit, in normal and immersive mode. The five-second collapse is kept as an opt-in mode behind one exported constant, `ATTRIBUTION_COLLAPSE_MS` (`null` = permanent, the shipped default; `5000` = the previous behaviour), so reverting is a one-line change.
- CMS campaign-map attribution text changes to the same linked wording (Leaflet's control already keeps it permanently visible).
- The Pip-Boy tile cache version is bumped (`pipboy-tiles-v2` → `pipboy-tiles-v3`) so watermarked tiles cached by installed clients are purged on the next service-worker activation.
- The Pip-Boy `CREDITI` view stays unchanged in role — the always-reachable full attribution in either mode — and its OpenStreetMap/CARTO entries gain the same links.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pipboy-map-tab`: the basemap requirement adds the key-bearing tile URL and its keyless fallback; the attribution requirement changes from "shows briefly, then collapses to Credits" to "linked, CARTO-compliant wording, permanent by default, with the timed collapse as a configurable mode; Credits always reachable".
- `pipboy-pwa-installability`: a key-bearing tile request is still classified as a map tile, and the tile-cache version is bumped to purge watermarked tiles.
- `cms-campaign-map`: adds a requirement that the authoring map's basemap uses the build-stamped key and shows the linked, permanent CARTO/OSM attribution.

## Impact

- **Code**: `apps/pip-boy/src/tabs/map.js` (tile URL, attribution line), new `apps/pip-boy/src/tabs/basemap.js` (key + URL + attribution markup, added to the `sw.js` precache list), `apps/pip-boy/sw.js` (tile cache name), `apps/pip-boy/src/styles/pipboy.css` (`.pb-map-attr` links), `apps/pip-boy/src/engine/settings-popup.js` (credits links, comment), `apps/cms/src/app/features/campaign-map/campaign-map-page.ts`, `apps/cms/src/environments/*.ts`.
- **Build/deploy**: `apps/pip-boy/Dockerfile`, `apps/cms/Dockerfile`, `docker-compose.yml` gain a `CARTO_BASEMAP_KEY` build arg; the server's `.env` must define it. The key must be locked to the production domain(s) (and `localhost` if wanted) in the CARTO key settings.
- **Quota**: free tier is 5M requests/month non-commercial (1M commercial), counted across all keys on the account. Pip-Boy cache-first tiles keep repeat traffic low.
- **Users**: installed Pip-Boy clients re-download tiles once after the update (cache purge).
- **Local dev**: the bind-mounted live-edit override serves unstamped source → keyless, watermarked tiles, unless the developer rebuilds the image with the key set.

## Testing

- **Pip-Boy — e2e (Playwright, `apps/pip-boy/tests`)**:
  - `map-attribution.spec.ts` rewritten for both modes (selected via the test override). Default mode: the line is present on entering the tab, **still present** well after five seconds and after pan/zoom, and survives immersive mode. Collapse mode: the line disappears after the configured delay, does not reappear on pan/zoom, and reappears on re-entry. Both modes: the line reads "OpenStreetMap contributors" and "CARTO", both are links to `openstreetmap.org/copyright` and `carto.com/attribution`, and a pan starting beneath it still reaches the map. Leaflet's own control remains absent.
  - Tile URL: with a stamped key (seeded via an init-script override, as the attribution delay is today), intercepted tile requests carry `key=<value>`; with the unstamped placeholder they carry no `key` parameter.
  - `tile-cache-cap.spec.ts` / installability: the tile cache is named `pipboy-tiles-v3`; a key-bearing tile URL is cached in the tile cache, not treated as shell or API traffic.
  - `settings-credits.spec.ts`: credits still name OSM, CARTO, and Leaflet; OSM/CARTO entries are links.
- **CMS — unit (Vitest, `campaign-map-page.spec.ts`)**: the tile-URL builder appends `?key=` when a key is configured and omits it when empty, for both labelled and label-free styles; the tile layer's attribution contains both linked names and the word "contributors".
