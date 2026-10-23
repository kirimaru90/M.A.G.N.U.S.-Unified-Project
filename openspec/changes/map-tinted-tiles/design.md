## Context

The phosphor tint is an SVG filter graph built by `apps/packages/map-core/style.js` (`filterMarkup`, `ensureTintFilter`) and referenced from CSS on the Leaflet tile pane:

- **Pip-Boy:** `pipboy.css` always applies it, and `engine/theme.js#applyPhosphorTheme` rebuilds the graph whenever the theme changes.
- **CMS:** `campaign-map-page.ts#applyPreview` sets `tilePane.style.filter` while "Anteprima filtro Pip-Boy" is on.
- **Map lab:** builds its own `<filter>` from `filterMarkup` with slider values.

The graph cannot be merged into one step: luminance → 256-entry tone table, a second branch from `SourceGraphic` for the water mask (alpha = 18·(B−R)), a flood at the water level, composite, merge, tint matrix. It sits on an element whose content changes on every frame of a pinch or an animated zoom (Leaflet transforms the tile container), so it runs again every frame over the full pane. On Android that saturates the GPU's fill-rate and the zoom stutters. A merged CSS chain was fast, but it cannot express the tone curve or the water mask, so going back to it would bring back the bright sea that the previous change fixed.

`style.js` already holds the same maths as plain JS: `toneLevel`, `tintColour` and `filterOutput(pixel, rgb, { tone, sat })`. These are what the tests and the map lab's contrast figures use.

Other constraints:
- CARTO serves tiles with `Access-Control-Allow-Origin: *` (checked: `dark_nolabels`, `@2x`, `dark_all`, `?key=`).
- Leaflet is 1.9.4, vendored in the Pip-Boy and from npm in the CMS.
- The Pip-Boy has no build step, and map-core must stay plain ES modules with Leaflet passed in.
- Neither app sets a Content-Security-Policy.

## Goals / Non-Goals

**Goals:**
- Zoom and pan never run a per-frame filter: tiles are tinted once, when they load.
- The tinted map is the same as today's within ±2/255 per channel on flat colours, in every theme.
- The Pip-Boy, the CMS preview and the map lab run one implementation.
- Changing the tint (theme, preview toggle, lab sliders) repaints the tiles on screen in place, with no network request and no flash of untinted tiles.
- No untinted tile is ever shown on the Pip-Boy, not even for one frame.

**Non-Goals:**
- The CRT overlays (`crtFlicker`, `scanSweep`, the scanline and vignette layers) and per-marker `will-change`. These are possible follow-ups once tile tinting is measured on a device.
- WebGL tile rendering.
- Changing any tone token or the look of the map.
- Tinting markers, popups or any other non-tile layer.

## Decisions

### D1 — A `TileLayer` subclass that paints into canvases, in map-core

`tint-tiles.js` exports `createTintedTileLayer(L, url, options)`. It returns a subclass of `L.TileLayer`, so `setUrl`, `{r}`/retina, `minZoom`/`maxZoom`, `keepBuffer`, attribution and fade-in all keep working. Only `createTile(coords, done)` changes:

1. Create a `<canvas class="leaflet-tile">` sized to the tile in CSS pixels.
2. Load `getTileUrl(coords)` into an `Image` with `crossOrigin = 'anonymous'`, then `createImageBitmap(img)`.
3. Set the canvas's pixel size to the bitmap's (512 for `@2x`), tint it (D3), draw the result, and call `done(null, canvas)`.

Leaflet starts the tile's fade-in only on `done`, so a tile first appears already tinted. Load errors call `done(err, canvas)`, which matches Leaflet's own `tileerror` path, and the canvas stays blank as an image tile would.

API:
- `layer.setTint(rgb | null, { tone, sat } = {})`: `rgb` is the theme triplet string, as in `PHOSPHOR_THEMES`. `tone` and `sat` default to `MAP_TONE` and `MAP_TINT_SAT`; the lab passes its slider values here. `null` means untinted.
- `options.tint`: the initial tint (same shape).
- `options.createWorker`: see D4.

*Alternatives:*
- Tint in the service worker and cache the tinted PNGs. Rejected: it only works in the Pip-Boy, not in the CMS or the lab, and it doubles the cache per theme.
- `L.GridLayer` from scratch. Rejected: it would reimplement URL templating, retina and `setUrl`.
- Keep the SVG filter and drop it only during zoom. Rejected: it shows the raw grey-blue basemap on every gesture.

### D2 — Re-tinting decodes the tile again; no untinted copy is kept

`setTint` stores the new tint, then for each loaded tile (`this._tiles`) loads its URL again (`src` recorded on the canvas). That request is served by the HTTP cache or, on the Pip-Boy, the tile cache. The tile is tinted again and drawn into the **same** canvas. Old pixels stay until the new ones are ready, so nothing flashes. A generation counter on each canvas discards results from a superseded tint when the user switches quickly.

*Alternative:* keep each tile's untinted `ImageBitmap` and re-tint instantly. Rejected for memory: a retina tile is 1 MB decoded, and with the visible tiles plus `keepBuffer` that is about 40–60 MB extra on a phone, held all the time to speed up an action that is rare (a theme change, a preview toggle). Re-decoding a cached PNG takes a few milliseconds per tile.

### D3 — Tint by lookup table, implemented once next to `filterOutput`

`style.js` gains `tintTables(rgb, { tone, sat })` and `tintPixels(data, tables)`, both pure:

- `level[256]`: `toneLevel(i/255, tone)` for each 8-bit luminance index, where `i = round(0.2126·R + 0.7152·G + 0.0722·B)`.
- `mask[511]`: `clamp(MAP_WATER_MASK_GAIN · (b − r) / 255, 0, 1)`, indexed by `b − r + 255`.
- per pixel: `v = level[i]·(1 − m) + tone.water·m`, then each channel is `round(255 · min(1, tint_c · v))`. Alpha passes through.

This is `filterOutput` with the luminance rounded to 8 bits, the same rounding the SVG `lum` result has today. The tone curve is steepest between 0 and land (slope ≈ 3.6), which can turn half a step of luminance rounding into almost 2/255 of output. Hence the ±2/255 tolerance against the unrounded `filterOutput` in the tests. `filterOutput` stays as the reference and keeps feeding the lab's contrast figures.

The functions take the RGB string the themes use, so callers don't change formats.

### D4 — Tinting runs in a worker the app supplies, with a main-thread fallback

At the end of a zoom, around 20 retina tiles (262k pixels each, about 1–3 ms on a phone) land together. That is 20–60 ms of main-thread work exactly when the eye is following the zoom. So the pixels are processed in a worker:

- map-core ships `tint-worker.js`. It receives `{ id, bitmap, tables }` with the bitmap transferred, draws it on an `OffscreenCanvas`, runs `tintPixels`, and transfers back `transferToImageBitmap()`.
- map-core does **not** create the worker itself. Worker URLs resolve differently with no build step (Pip-Boy) and in the Angular bundler (CMS), so each app passes `options.createWorker`:
  - Pip-Boy: `() => new Worker(new URL('../shared/map-core/tint-worker.js', import.meta.url), { type: 'module' })`
  - CMS: the same expression in TypeScript, which Angular's builder recognises and bundles.
  - map lab: the same as the Pip-Boy, through its import of the Pip-Boy copy.
- One worker per layer, created lazily on the first tile and terminated on `onRemove`. The tables are sent once per tint and cached in the worker by a tint key, not sent with every tile.
- **Fallback:** if `createWorker` is missing, throws, or the worker errors, or `OffscreenCanvas` is unavailable, tinting runs on the main thread with the same `tintPixels`. This covers old WebViews and the Vitest/jsdom environment. The fallback is the same code, so it cannot drift from the worker.

*Alternative:* main thread only. It's simpler, and it's the fallback anyway. Rejected as the default because the stutter this change removes could come back as a hitch at the end of each zoom. If profiling shows the hitch is negligible, the worker can be dropped without changing the API.

### D5 — The Pip-Boy theme reaches the map through the theme choke point

`applyPhosphorTheme` stays the only place where a theme is applied. It loses the `ensureTintFilter` call. Instead it records the current triplet (exported as `currentPhosphorRgb()`) and dispatches a `pb-phosphor-change` event on `document` with `{ rgb }`. `map.js` creates the layer with `tint: currentPhosphorRgb()`, listens for the event while mounted, calls `layer.setTint(rgb)`, and removes the listener on `unload`. The spec's "a theme change re-tints a mounted map without remounting" still holds, and theme.js doesn't need to know a map exists.

### D6 — The CMS preview toggles the tint, not a filter

The CMS always builds the tinted layer:
- preview on: `setTint(VERDE.rgb)`, plus the Pip-Boy marker variables as today;
- preview off: `setTint(null)`, which draws the decoded bitmap as is.

The labels toggle keeps calling `setUrl`, and the new tiles come in with the current tint. `MAP_TINT_FILTER_ID` and the pane `style.filter` assignment are removed. Even with the preview off, tiles go through canvases. That costs little and means the CMS has only one code path.

### D7 — The service worker caches only `ok` tile responses, under a new cache name

`tileCacheFirst` drops `response.type === 'opaque'`. CORS tile responses are `basic`/`cors` with `ok`, so the cache keeps working. `TILE_CACHE` becomes `pipboy-tiles-v4`. The activate sweep already deletes unknown cache names, which purges every opaque v3 entry. Without that purge, `cache.match` would return an opaque response for a CORS request, the browser would treat it as a network error, and every previously visited area would go blank. The logout flush keeps the tile cache whatever its name, since it compares against the current constant. `crossOrigin` image requests send no credentials, so the cache key does not change in a way that matters.

### D8 — `ensureTintFilter` and `filterMarkup` leave map-core; the lab moves to the layer

Nothing ships the SVG graph any more. Keeping `filterMarkup` as a test oracle would mean testing the new code against a second implementation that no product path runs. `filterOutput` is the better reference: it is the documented maths, and the lab already uses it. The lab replaces its `<filter>` with the tinted layer and calls `setTint(rgb, { tone, sat })` on slider input. That runs D2's re-decode path, which is fine for a dev tool. The lab README is updated.

## Risks / Trade-offs

- [Pip-Boy players have opaque v3 tiles cached] → The v4 bump purges them on activate. The first map visit after the update fetches tiles again, a one-time cost already accepted for the v3 bump.
- [A tile host that stops sending CORS headers would leave the map blank (canvas reads fail)] → Tile load errors go through Leaflet's `tileerror`, so the tab doesn't break and the markers stay, as the offline spec already requires. The CORS check is one curl; note it in the README next to the tile URL coupling comment in `sw.js`.
- [Edge pixels differ slightly from today at fractional zoom (tint before scaling instead of after)] → Accepted. Flat colours are identical within tolerance, and only antialiased coastlines and roads during scaling change, arguably for the better. Compare side by side on a device.
- [Memory: each tile becomes a canvas backing store instead of a decoded image] → About the same size as the decoded `<img>` it replaces. No extra untinted copies (D2).
- [Re-tinting many tiles at once on a theme change] → Requests go to cache, tinting runs in the worker, and old pixels stay until replaced. Worst case, the repaint spreads over a few frames.
- [Angular may not bundle a `new Worker(new URL(…))` that points at a `.js` file in `src/app/shared`] → Verify early (task 1.x). If it doesn't, copy the worker as an asset in `angular.json` and use an asset URL instead.
- [Tests stub tiles with a transparent PNG and no CORS header] → The fixture serves a known-colour PNG with `Access-Control-Allow-Origin: *`, otherwise every map test sees failed tiles.

## Migration Plan

Ship the Pip-Boy (layer, theme hook, CSS removal, service worker v4) in one deploy; they depend on each other. The CMS and the lab can follow independently but share the same map-core sync. Rollback is a revert: the old SVG path has no persisted state. Going back would leave a v4 cache of CORS tiles, which the reverted v3 code doesn't read, so it starts with a fresh cache. Safe.

## Open Questions

- Should `crtFlicker` and `scanSweep` pause while the map tab is mounted? Decide after measuring this change on a device. It is a separate change.
- Should `keepBuffer` be lowered on the Pip-Boy to cap the canvas count on small devices? Measure first.
