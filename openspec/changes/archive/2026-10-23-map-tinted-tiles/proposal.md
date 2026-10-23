## Why

Zooming the Pip-Boy map on Android stutters badly. The basemap is tinted by an SVG filter on the Leaflet tile pane (`filter: url(#pb-phosphor-tint)`). The graph has seven primitives, and the browser cannot merge them into one step: a luminance matrix, a 256-entry tone table, a water mask built from B−R, a flood, a composite, a merge and a tint matrix. During a pinch or an animated zoom, the tile container's transform changes every frame, so the whole graph runs again every frame over the full screen, about 1080×2400 pixels plus the filter's 10% margin on a phone. Fill-rate runs out and the frame rate collapses. The previous commits made the filter progressively heavier: first a CSS chain the browser merged into one matrix, then a single `feColorMatrix`, now this graph. The tone curve and water mask are worth keeping, so the fix is to stop running them every frame.

## What Changes

- **Tiles are tinted once, when they load, not on every frame.** A new shared map-core module draws each CARTO tile into a canvas and applies the phosphor tint to its pixels, using the same maths the SVG filter encodes today (`filterOutput()` in `style.js`): a tone curve over luminance and a water mask over B−R, each precomputed as a lookup table. Zooming then transforms plain bitmaps, with no live filter. The visible result is meant to be identical to today's. The only difference is on antialiased edges at fractional zoom, where tinting now happens before scaling instead of after.
- **The tint can be changed or removed in place.** A theme change on the Pip-Boy or the preview toggle in the CMS re-tints the tiles already on screen. Each tile is decoded again from the browser or service-worker cache and repainted where it is, with no network request and no flash. Untinted copies are not kept in memory, which matters on phones.
- **Tile requests become CORS requests** (`crossOrigin: 'anonymous'`), which is required to read tile pixels. CARTO sends `Access-Control-Allow-Origin: *` on every variant used (`dark_nolabels`, `@2x`, `dark_all`, with `?key=`).
- **The Pip-Boy service worker stops caching opaque tile responses and purges the ones it holds.** A cached opaque response returned for a CORS request is a network error, so with CORS requests the map would go blank wherever tiles are already cached. `TILE_CACHE` moves to `pipboy-tiles-v4`, which the existing activate sweep purges, and only `response.ok` tiles are cached from now on.
- **The Pip-Boy, the CMS and the map lab all use the same tinted layer.**
  - Pip-Boy MAPPA: the tint follows the phosphor theme, applied through the layer instead of SVG filter markup.
  - CMS filter preview: on means VERDE tint, off means plain CARTO. It also works over the labelled `dark_all` basemap.
  - Map lab: uses the same module, so what is tuned is exactly what ships.
- **The SVG filter is removed.** The tile-pane `filter: url(#…)` goes from `pipboy.css` and from the CMS `applyPreview`. `ensureTintFilter` and `filterMarkup` leave map-core. `filterOutput()` stays as the reference the lookup tables are tested against. **BREAKING (spec):** `pipboy-map-tab`, `cms-campaign-map` and `map-shared-core` currently require the tile pane to reference the SVG filter by id.
- **Out of scope, as possible follow-ups:** the always-running `crtFlicker` and `scanSweep` animations above the map, and `will-change` on every marker. Both add GPU load but are not the cause of the stutter.

## Capabilities

### New Capabilities

None. The tinted layer belongs to the existing `map-shared-core` capability.

### Modified Capabilities

- `map-shared-core`: the package owns a tinted tile layer in place of the SVG filter graph, and the tile-pane-filter scenario becomes "no app filters the tile pane".
- `pipboy-map-tab`: the basemap is tinted per tile in the active theme's colour rather than by a CSS-referenced SVG filter, and a theme change re-tints mounted tiles in place. The tone curve, water mask and luminance order are unchanged.
- `cms-campaign-map`: the filter preview tints the tiles through the shared layer in VERDE, and turning it off restores the untinted tiles. Neither state uses a tile-pane filter.
- `pipboy-pwa-installability`: the tile cache stores only successful CORS tile responses, never opaque ones, and the cache version moves on so opaque entries from earlier versions are purged.

## Impact

- **Shared core** (`apps/packages/map-core/`):
  - new `tint-tiles.js` (+ `.d.ts`): `createTintedTileLayer(L, url, options)` with `setTint(rgb | null)`.
  - new worker module for tinting off the main thread, with a main-thread fallback.
  - `style.js`: lookup-table builders added; `ensureTintFilter` and `filterMarkup` removed.
  - all files synced into both apps by `scripts/sync-map-core.mjs`; the drift specs pick up the new files.
- **Pip-Boy** (`apps/pip-boy/`):
  - `src/tabs/map.js`: builds the tinted layer instead of `L.tileLayer`.
  - `src/engine/theme.js`: re-tints the mounted layer instead of calling `ensureTintFilter`.
  - `src/styles/pipboy.css`: tile-pane `filter` rule removed.
  - `sw.js`: tile cache `v4`, no opaque caching, new map-core files precached.
  - `tools/map-lab/map-lab.html`: uses the tinted layer.
  - `tests/fixtures.ts`: the tile stub sends a CORS header and a known-colour PNG.
- **CMS**: `campaign-map-page.ts` builds the tinted layer, and `applyPreview` calls `setTint` instead of setting a pane filter. The Angular build has to bundle the worker module.
- **Unchanged**: tone tokens and their values, marker styling, the basemap key stamping, attribution, the tile cache's cap and eviction.

## Testing

- **Map-core unit tests, run in the Pip-Boy Playwright suite** (`tests/map-tint.spec.ts`, new feature area, pure functions like `map-geometry.spec.ts`):
  - the lookup-table tint matches `filterOutput()` within ±2/255 for CARTO land (`#0e0e0e`), water (`#2c353c`), minor and major road greys, white, black, and half land/half water coastline mixes, in all three themes;
  - the luminance order holds: water < land < road;
  - with no tint, the source pixels pass through unchanged.
- **Pip-Boy Playwright, e2e**: the tile stub serves a known-colour PNG with CORS.
  - `map-tab.spec.ts`, which already mounts the map: tiles render as canvases whose sampled pixel equals the expected tinted colour, and the tile pane has no `filter`. This replaces the current filter-reference assertion.
  - `map-theme.spec.ts`: switching `COLORE` re-tints mounted tiles to the new theme's expected pixel with no remount, and the tile elements stay the same nodes. This replaces the `feColorMatrix` diagonal assertions.
  - `tile-cache-cap.spec.ts`: the cache name is `pipboy-tiles-v4`; an opaque tile response is not written to the cache; a v3 cache is deleted on activate.
  - `map-core-drift.spec.ts`: covers the new files.
- **CMS Vitest** (`campaign-map-page.spec.ts`):
  - turning the preview on calls `setTint` with VERDE's triplet, and off calls `setTint(null)`;
  - the tile pane never has a `filter` style;
  - the labels toggle still swaps the URL on the tinted layer;
  - `map-core-drift.spec.ts` passes.
- **Manual, on device:** pinch and animated zoom on an Android phone are smooth, and the map looks the same as before the change side by side. Smoothness can't be asserted reliably in CI.
