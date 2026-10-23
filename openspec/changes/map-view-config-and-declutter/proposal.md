## Why

Authoring and playing the campaign map have drifted apart in three ways that surfaced together. The CMS editor never opens on the campaign's configured start view, so the author frames the map against a default that the player never sees. The zoom-range fields read backwards to anyone who doesn't know Leaflet's convention — an admin set "Zoom max" to 4 expecting to limit how far the player can zoom *out*, and saw no effect. And on the Pip-Boy, zooming out piles the top-level places on top of each other: they have no ancestors, so the level-of-detail rule keeps them all visible at every zoom. Separately, the map ignores the player's phosphor colour — the tile filter is hard-wired green — and its markers share the map's colour, so they don't stand out from it.

A first fix, a linear tint with amber/green complementary markers, was rejected on a real map. The sea came out as the brightest surface on screen, about 4× the land, because CARTO's water is lighter than its land and a linear gain multiplies that. The complementary markers broke the monochrome phosphor look and still had almost no luminance contrast against the sea (1.1:1 on green). This revision replaces both.

A second revision unifies the two maps. The CMS still drew coloured dots, showed every place at every zoom, and previewed a CSS filter chain that this change retires, so the author's map stopped resembling the player's. The tokens lived in Pip-Boy code the CMS can't import. Separately, the start-view fix (D1) worked in Vitest but not in a real browser: an animated zoom fired by `setMinZoom` sent the map back to the default view.

## What Changes

- **CMS opens on the campaign's start view.** Once the map document loads, the editor applies `startLat`/`startLng`/`startZoom` once. Today the Leaflet instance is built from the default config before the load resolves and never re-framed.
- **CMS zoom fields say which way they go.** "Zoom min"/"Zoom max" become "Zoom minimo (più lontano)" / "Zoom massimo (più vicino)".
- **`startZoom` must lie in `[minZoom, maxZoom]`.** Validated by the API DTO and surfaced in the CMS form. Today only `minZoom <= maxZoom` is checked, and an out-of-range start zoom is silently clamped by Leaflet.
- **The Pip-Boy cannot zoom out past the bounds.** The effective minimum zoom becomes `max(config.minZoom, zoom at which the bounds fill the viewport)`, recomputed when the canvas resizes. Today `maxBounds` only resists panning.
- **Colliding markers are decluttered by type priority.** After the level-of-detail rule picks the visible places, markers that overlap on screen are resolved greedily by priority: regione > insediamento = vault > punto di riferimento = punto di interesse > edificio > stanza. Ties go to the larger effective radius, then the name. A losing marker is absorbed by the winner, which shows a `+N` badge. The winner's popup lists the hidden places under "Nelle vicinanze". Tapping the badge zooms to the level at which the group separates. The focused place always wins while its popup is open. Absorption animates with the existing collapse/bloom.
- **Colliding labels are hidden.** A second pass, after markers are placed, hides any label that would overlap another marker or label, using the same priority. The icon stays.
- **The map follows the phosphor theme, with a luminance hierarchy.** The tile filter becomes an SVG filter generated from the active theme's colour, so a green, amber or white Pip-Boy shows a green, amber or white map. Inside it, a tone curve per surface replaces the linear gain, and water is separated from land by its colour cast. The result is a dark sea below the land, coastlines and roads as lines, and a slightly desaturated tint. A theme change re-tints the mounted map live. **BREAKING (spec):** the literal CSS filter chain that `pipboy-map-tab` pins as a design token is replaced.
- **Markers stay monochrome and stand out by luminance.** Icons and badges are drawn in the theme's bright phosphor colour, cut out of the map by a dark halo. Labels are a quieter tier, dimmed with opacity. No contrasting colour from another theme is introduced. Popup, breadcrumb and search stay in the theme colour.
- **One map core shared by the CMS and the Pip-Boy.** `apps/packages/map-core/` becomes the only place where the basemap tokens and filter graph, the place icons, the level-of-detail and declutter geometry, and the marker layer (render plan, bloom/collapse, `+N` badge, label pass) are edited. `scripts/sync-map-core.mjs` copies it into each app. A `--check` run in both apps' test suites fails on drift.
- **The CMS map behaves like the Pip-Boy's.** Same icons, same level of detail, same collision collapse with `+N` and separate-on-tap, same name labels hidden on collision, same bloom/collapse animation. Non-public and inherited places take part like any other and differ only in colour: red. The selected place is always shown.
- **The CMS keeps its own look, previewing the Pip-Boy on demand.** Unfiltered: CARTO dark with green (public) and red (not public) icons. With "Anteprima filtro Pip-Boy" checked: the shared SVG filter in the default VERDE theme and Pip-Boy marker colours, with non-public places still red.
- **The CMS really opens on the start view.** The zoom range is assigned without triggering an animated zoom before framing.
- **A map lab for tuning the basemap.** `apps/pip-boy/tools/map-lab/` is a dev-only page with a README, launched with `npm run map-lab`. It shows real CARTO tiles through the same filter, with themes, presets, sliders and live contrast figures. A local Node server reads the CARTO key from `.env`, so the key is never written into a file. The tool is excluded from the Docker image.

## Capabilities

### New Capabilities

- `map-shared-core`: the shared map package, its contents, and the sync-and-check rule that keeps each app's copy identical to it.

### Modified Capabilities

- `cms-campaign-map`: the editor opens on the loaded start view, with no animated zoom in between; the zoom-range fields are labelled by direction; the form rejects a start zoom outside the range; markers use the Pip-Boy icons, level of detail, declutter, labels and animation; non-public markers are red, and inherited ones are no longer told apart on the map; the filter preview uses the shared SVG filter in VERDE.
- `api-campaign-map`: the write DTO rejects a `startZoom` outside `[minZoom, maxZoom]`.
- `pipboy-map-tab`: the effective min zoom is derived from the bounds; colliding markers are decluttered by type priority with a `+N` badge, a "Nelle vicinanze" popup line and a separate-on-tap action; colliding labels are hidden; the basemap tint follows the phosphor theme through an SVG filter with a tone curve per surface, replacing the pinned CSS chain; markers stand out by luminance in the theme's own colours.
- `pipboy-settings`: choosing a `COLORE` also re-tints the map basemap and recolours the map markers.

## Impact

- **CMS** — `apps/cms/src/app/features/campaign-map/campaign-map-page.ts`: the load re-frames the map, labels change, and the form validates the start zoom.
- **API** — `apps/api/api/src/campaign-map/dto/campaign-map.dto.ts`: a new cross-field validator, and the OpenAPI description is updated (no shape change, so no client regeneration is needed).
- **Pip-Boy** — the changes touch these files:
  - `src/tabs/map-geometry.js`: new pure functions for collision resolution, separation zoom and bounds-derived min zoom.
  - `src/tabs/map.js`: the marker sync runs through the declutter, plus badge/popup wiring and min-zoom recompute on resize.
  - `src/engine/theme.js`: the SVG filter graph (tone curve, water mask, tint) and its tokens. `markerRgb` and `--map-marker-rgb` are removed.
  - `src/styles/pipboy.css`: tile filter via `url(#…)`; marker icon, halo, label and badge styles on `--phosphor-bright` / `--phosphor`.
  - `index.html` (or a runtime-injected node): hosts the SVG `<filter>` definition. Prefer injection from `theme.js` so no markup change is needed.
  - `tools/map-lab/` (new, dev only): `map-lab.html`, `serve.mjs`, `README.md`. Also `package.json` (a `map-lab` script) and `.dockerignore` (`tools`).
- **Shared core** — new `apps/packages/map-core/` and `scripts/sync-map-core.mjs`.
  - Pip-Boy: committed copy under `src/shared/map-core/`. `map-geometry.js` and the marker code in `map.js` move there, `theme.js` imports the style module, and `sw.js` and `index.html` list the new files. The map lab imports from the copy.
  - CMS: committed copy under `src/app/shared/map-core/`. `campaign-map-page.ts` replaces its `syncMarkers` and `.cm-marker*` styles with the shared layer, `place-tree.ts#effectiveRadius` re-exports the core's, and `angular.json` adds `markers.css`.
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
  - the tile pane's filter references the SVG filter, and that filter's tint changes when the theme switches from VERDE to AMBRA;
  - the marker stroke is the theme's bright phosphor colour on VERDE, AMBRA and BIANCO, and labels are dimmer than icons.
- **Pip-Boy — unit** (`tests/theme.spec.ts`, pure): for each theme, the filter's output order is water < land < road < marker on the measured CARTO colours, and the marker reaches 4.5:1 against each surface.
  - The existing assertion on `sepia(1)` / `hue-rotate(90deg)` is replaced.
- **Shared core — drift**: `sync-map-core.mjs --check` runs in the Pip-Boy Playwright suite and in CMS Vitest, and fails when a copy differs from the package.
- **CMS — Vitest**, unification:
  - `applyStartView` never calls `setZoom`/`setMinZoom`/`setMaxZoom` before framing (the race is invisible in jsdom, so the test pins the mechanism);
  - markers render the Pip-Boy icon for their type;
  - a child is absent until its parent is open, and the selected place is always present;
  - overlapping places render one marker with `+N`, whether or not they are public;
  - a non-public marker carries the red class;
  - the preview toggles `url(#pb-phosphor-tint)` with the VERDE tint.
- **CMS — real browser, manual (10.3)**: a campaign with `minZoom` above 6 opens and *stays* on its start view.
