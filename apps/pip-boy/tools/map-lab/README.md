# Map lab

A dev-only page for tuning how the Pip-Boy **MAPPA** tab looks: the phosphor filter over the CARTO basemap, and the marker style on top of it.

It shows real `dark_nolabels` tiles through the app's own SVG filter graph (built by `filterMarkup` from the shared map core), with the app's icons and sample places on the US West Coast. Every parameter is a slider, and the contrast figures update as you move them. That lets you judge a change by eye and by numbers before touching the app.

The lab is not part of the app. `tools` is listed in `apps/pip-boy/.dockerignore`, so it never reaches the nginx image.

## Running it

From `apps/pip-boy`:

```sh
npm run map-lab
```

This starts a small local server on `http://localhost:5180/` and opens the browser. Stop it with Ctrl+C.

- **The CARTO key** comes from `CARTO_BASEMAP_KEY`. The server checks the process environment first, then the repo-root `.env`, the same variable the Docker build stamps into `src/tabs/basemap.js`. With no key the page still loads, but CARTO serves "API KEY REQUIRED" tiles and the server prints a warning.
- **Domain lock.** CARTO keys can be restricted to domains. If the tiles fail with a key set, allow `localhost` on the key, or use a dev key.
- **Port.** Set `MAP_LAB_PORT` to change it. Set `MAP_LAB_NO_OPEN=1` to skip opening the browser.

### Why a server and not just a file

- A page opened from disk cannot read `.env`. Stamping the key into a generated HTML file would put the key on disk, where it can be committed or shared. `serve.mjs` replaces the `__CARTO_KEY__` placeholder in memory, per request.
- The vendored Leaflet (`src/vendor/leaflet/leaflet.esm.js`) is ESM-only, and browsers do not load module scripts from `file://`.

The server only exposes the lab page, `src/vendor/leaflet/` and `src/shared/map-core/` (the Pip-Boy's synced copy of `apps/packages/map-core`), and it binds to `127.0.0.1`.

## Files

| File | What it is |
|---|---|
| `map-lab.html` | The page. Keeps the `__CARTO_KEY__` placeholder; never commit a real key. |
| `serve.mjs` | The dependency-free Node server (`node:http`, `node:fs`). |
| `README.md` | This file. |

## The controls

**Theme**: VERDE, AMBRA, BIANCO. These are `PHOSPHOR_THEMES` from `apps/packages/map-core/style.js`.

**Presets**

| Preset | What it shows |
|---|---|
| **Scelta** | The tokens in `apps/packages/map-core/style.js`, read at load: what the app ships. |
| **Prima** | The first design: one linear gain ×4 and complementary markers (amber on green). Kept for comparison. |
| A · Curva tonale, A + C · Smorzata, Mare scuro | Some of the alternatives compared when the tokens were chosen. |

**Mappa di base**

| Control | Meaning |
|---|---|
| Lineare / Livelli per superficie | The old single gain, or the tone curve per surface. |
| Guadagno | Linear mode only: output = gain × theme colour × luminance. |
| Terra | The land level (`MAP_TONE.land`). |
| Mare | The sea level (`MAP_TONE.water`). Water is isolated by its blue cast, so it is set independently of land. |
| Strade, coste | Coastlines and minor roads (`MAP_TONE.lineLo`). |
| Strade maggiori | Major roads: the basemap's ceiling (`MAP_TONE.lineHi`). |
| Saturazione tinta | The theme colour pulled toward its own luminance (`MAP_TINT_SAT`). |

All levels are fractions of the phosphor colour, before the tint: 1.00 is full phosphor.

**Marker**: style (complementary, bright + halo, negative chip, frame), labels (same as the marker, quiet, none), glow, and the CRT scanline/vignette overlay.

**Tieni premuto per vedere com'era prima** swaps to the "Prima" preset while held, in the current theme.

**Budget di luminanza** shows the perceived lightness (L\*) of the background, land, water, roads and marker, and the WCAG contrast of the marker against each surface. Anything under 3:1 is red. The app's own unit test (`tests/theme.spec.ts`) requires at least 4.5:1.

## The measured basemap

The filter is tuned to these colours of CARTO's `dark_nolabels`. If CARTO restyles the basemap, re-measure them, because the water mask depends on water's blue cast.

| Surface | Colour | Luminance |
|---|---|---|
| Land | `#0e0e0e` | 0.055 |
| Water | `#2c353c` | 0.202 (`B − R` = 16/255) |
| Roads | `#494949` | ≈ 0.29 |

The same values are in `tests/theme.spec.ts`.

## Bringing a result back into the app

1. Tune the sliders until the map reads well in all three themes, and at several zooms (use the view buttons over the map).
2. Click **Copia parametri**.
3. Copy the values into `apps/packages/map-core/style.js`:
   - `land`, `water`, `lineLo` and `lineHi` go to `MAP_TONE`;
   - `sat` goes to `MAP_TINT_SAT`.

   A different marker style or label tier is a change to `apps/packages/map-core/markers.css`, and to the `--mk-*` values in `src/styles/pipboy.css`.
4. From the repo root, run `node scripts/sync-map-core.mjs`. That copies the package into the Pip-Boy (`src/shared/map-core/`, which the lab reads) and the CMS.
5. Reload the lab. "Scelta" now shows the new tokens, so you can check it against the app.
6. Run `npx playwright test tests/theme.spec.ts tests/map-theme.spec.ts`. The unit test checks the luminance order (water < land < roads) and the 4.5:1 marker contrast for every theme.

The lab builds its filter by calling the core's `filterMarkup(rgb, { tone, sat })` with the slider values, so it never mirrors the graph by hand: a change to the graph in `style.js` reaches the lab on the next sync. The only graph of its own is the linear "Prima" matrix, the rejected first design, kept as the comparison baseline.

The marker styles are still the lab's own CSS (`.ms-*`, `.lb-*` in `map-lab.html`), so they can be compared side by side. The one the apps ship is in `apps/packages/map-core/markers.css`.
