# map-core

The rules and the style that the Pip-Boy **MAPPA** tab and the CMS campaign map must agree on. This folder is the only place they are edited.

| File | What it holds |
|---|---|
| `style.js` | `PHOSPHOR_THEMES`, the basemap tokens (`MAP_TONE`, `MAP_TINT_SAT`, `MAP_WATER_MASK_GAIN`), the SVG filter graph (`filterMarkup`, `filterOutput`, `toneTable`, `tintColour`) and `ensureTintFilter(doc, rgb)`, which writes the hidden `<filter id="pb-phosphor-tint">`. |
| `geometry.js` | Level of detail (`effectiveRadius`, `visible`, `isOpen`, `chain`, `containZoom`, `revealZoom`), and the declutter (`declutter`, `labelPass`, `separationZoom`, `effectiveMinZoom`). Pure: no DOM, no Leaflet. |
| `icons.js` | `ICONS`, `TYPE_DEFAULT_ICON`, `iconFor(place)`. |
| `marker-layer.js` | `createMarkerLayer(L, map, opts)`: the render plan, marker sync, bloom/collapse on zoom, the `+N` badge and the label pass. |
| `markers.css` | Marker structure: icon box, label offset, badge, hidden label. Colours only through `--mk-icon`, `--mk-label`, `--mk-halo` and `--mk-glow`. |
| `*.d.ts` | Types for the CMS. |

## Rules

- Plain ES modules with no dependencies and no build step: the Pip-Boy loads them as they are.
- Leaflet is passed in by the caller (`createMarkerLayer(L, …)`), never imported. The Pip-Boy passes its vendored ESM build, the CMS its npm `leaflet`, both 1.9.4.
- What is app-specific stays in the app: the Pip-Boy's popup, breadcrumb, search, immersive mode and zoom floor (`src/tabs/map.js`) and its CSS custom properties (`src/engine/theme.js`); the CMS's selection, dragging, radius and bounds handles.
- `effectiveRadius` has one other implementation, the API's `campaign-map.service.ts`. Change both together.

## The sync

Each app builds, serves and tests from its own folder only (per-app Docker contexts, the dev nginx mount, the Playwright static server, the CMS `tsconfig`). So the package is **copied** into each app, and the copies are committed:

- `apps/pip-boy/src/shared/map-core/`
- `apps/cms/src/app/shared/map-core/`

Every copied file starts with a header naming its source here. Never edit a copy.

After editing anything in this folder, from the repo root:

```sh
node scripts/sync-map-core.mjs
```

`node scripts/sync-map-core.mjs --check` exits non-zero and names every copy that differs from the package (missing, changed, or no longer in the package). Both apps' suites run it: `tests/map-core-drift.spec.ts` in the Pip-Boy, `map-core-drift.spec.ts` in the CMS. An unsynced edit, or a hand edit to a copy, fails them.

This README is not copied.
