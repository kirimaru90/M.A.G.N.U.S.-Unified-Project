## Why

Authoring and playing the campaign map have drifted apart in three ways that surfaced together. The CMS editor never opens on the campaign's configured start view, so the author frames the map against a default that the player never sees. The zoom-range fields read backwards to anyone who doesn't know Leaflet's convention — an admin set "Zoom max" to 4 expecting to limit how far the player can zoom *out*, and saw no effect. And on the Pip-Boy, zooming out piles the top-level places on top of each other: they have no ancestors, so the level-of-detail rule keeps them all visible at every zoom. Separately, the map ignores the player's phosphor colour — the tile filter is hard-wired green — and its markers share the map's colour, so they don't stand out from it.

## What Changes

- **CMS opens on the campaign's start view.** Once the map document loads, the editor applies `startLat`/`startLng`/`startZoom` once. Today the Leaflet instance is built from the default config before the load resolves and never re-framed.
- **CMS zoom fields say which way they go.** "Zoom min"/"Zoom max" become "Zoom minimo (più lontano)" / "Zoom massimo (più vicino)".
- **`startZoom` must lie in `[minZoom, maxZoom]`.** Validated by the API DTO and surfaced in the CMS form. Today only `minZoom <= maxZoom` is checked, and an out-of-range start zoom is silently clamped by Leaflet.
- **The Pip-Boy cannot zoom out past the bounds.** The effective minimum zoom becomes `max(config.minZoom, zoom at which the bounds fill the viewport)`, recomputed when the canvas resizes. Today `maxBounds` only resists panning.
- **Colliding markers are decluttered by type priority.** After the level-of-detail rule picks the visible places, markers that overlap on screen are resolved greedily by priority: regione > insediamento = vault > punto di riferimento = punto di interesse > edificio > stanza. Ties go to the larger effective radius, then the name. A losing marker is absorbed by the winner, which shows a `+N` badge. The winner's popup lists the hidden places under "Nelle vicinanze". Tapping the badge zooms to the level at which the group separates. The focused place always wins while its popup is open. Absorption animates with the existing collapse/bloom.
- **Colliding labels are hidden.** A second pass, after markers are placed, hides any label that would overlap another marker or label, using the same priority. The icon stays.
- **The map follows the phosphor theme, and markers contrast with it.** The tile filter becomes an SVG `feColorMatrix` generated from the active theme's colour, so a green, amber or white Pip-Boy shows a green, amber or white map. Icons, labels and badges take a contrasting colour: amber on the green theme, green on the amber and white themes. Popup, breadcrumb and search stay in the theme colour. A theme change re-tints the mounted map live. **BREAKING (spec):** the literal CSS filter chain that `pipboy-map-tab` pins as a design token is replaced.

## Capabilities

### New Capabilities

_None._ Every change refines an existing capability.

### Modified Capabilities

- `cms-campaign-map`: the editor opens on the loaded start view; the zoom-range fields are labelled by direction; the form rejects a start zoom outside the range.
- `api-campaign-map`: the write DTO rejects a `startZoom` outside `[minZoom, maxZoom]`.
- `pipboy-map-tab`: the effective min zoom is derived from the bounds; colliding markers are decluttered by type priority with a `+N` badge, a "Nelle vicinanze" popup line and a separate-on-tap action; colliding labels are hidden; the basemap tint follows the phosphor theme through an SVG filter, replacing the pinned CSS chain; markers use a contrasting colour.
- `pipboy-settings`: choosing a `COLORE` also re-tints the map basemap and switches the map-marker colour.

## Impact

- **CMS** — `apps/cms/src/app/features/campaign-map/campaign-map-page.ts`: the load re-frames the map, labels change, and the form validates the start zoom.
- **API** — `apps/api/api/src/campaign-map/dto/campaign-map.dto.ts`: a new cross-field validator, and the OpenAPI description is updated (no shape change, so no client regeneration is needed).
- **Pip-Boy** — the changes touch these files:
  - `src/tabs/map-geometry.js`: new pure functions for collision resolution, separation zoom and bounds-derived min zoom.
  - `src/tabs/map.js`: the marker sync runs through the declutter, plus badge/popup wiring and min-zoom recompute on resize.
  - `src/engine/theme.js`: per-theme marker colour and SVG filter matrix.
  - `src/styles/pipboy.css`: tile filter via `url(#…)`, marker/label/badge colour from `--map-marker-rgb`, badge styles.
  - `index.html` (or a runtime-injected node): hosts the SVG `<filter>` definition. Prefer injection from `theme.js` so no markup change is needed.
- **Existing behaviour preserved**: hierarchy-driven level of detail, bloom/collapse timing, breadcrumb, search, immersive mode, attribution.

## Testing

- **API — unit** (`campaign-map.dto.spec.ts`): rejects a `startZoom` below `minZoom` and above `maxZoom`, and accepts one at either edge.
- **API — e2e** (`test/campaign-map.e2e-spec.ts`, in-memory Mongo): a PUT with an out-of-range `startZoom` returns HTTP 400 and leaves the stored map unchanged.
- **CMS — Vitest** (`campaign-map-page.spec.ts`; the runner is already wired by `cms-testing`):
  - after `load()` resolves with a non-default config, the Leaflet map's centre and zoom equal the loaded start view;
  - a later config edit does not re-frame the map;
  - the zoom fields carry the directional labels;
  - an out-of-range start zoom marks the form invalid.
- **Pip-Boy — unit** (`tests/map-geometry.spec.ts`, pure functions):
  - priority ordering, including the tie rules;
  - greedy absorption;
  - the focused place always wins;
  - separation zoom for a group, clamped to `maxZoom`;
  - bounds-derived min zoom;
  - label collision pass.
- **Pip-Boy — Playwright** (`tests/map-tab.spec.ts` and siblings, live DOM):
  - zoom is clamped for a **non-default** `minZoom`/`maxZoom`;
  - zooming out stops at the bounds-derived minimum;
  - overlapping top-level places render one marker with a `+N` badge, and its popup lists the absorbed names;
  - tapping the badge separates the group;
  - a searched place absorbed at its reveal zoom still renders and opens;
  - overlapping labels are hidden while their icons remain;
  - the tile pane's filter references the SVG filter, and that filter's matrix changes when the theme switches from VERDE to AMBRA;
  - marker colour is amber on VERDE and green on AMBRA and BIANCO.
  - The existing assertion on `sepia(1)` / `hue-rotate(90deg)` is replaced.
