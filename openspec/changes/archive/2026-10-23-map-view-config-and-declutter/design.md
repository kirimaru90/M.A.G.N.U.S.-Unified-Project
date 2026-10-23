## Context

The campaign map spans three apps.

- **API**: `apps/api/api/src/campaign-map` holds the config and places DTO.
- **CMS**: `apps/cms/.../campaign-map-page.ts` is an Angular signals component with an imperative Leaflet instance.
- **Pip-Boy**: `apps/pip-boy/src/tabs/map.js` plus the pure `map-geometry.js`, with vanilla JS and vendored Leaflet.

The current state relevant to this change:

- **CMS framing.** `initMap()` builds `L.map` from `this.config()` as soon as the container appears. That is usually before `load()` resolves, so the map is built from `DEFAULT_CONFIG`. The only bridge from config to Leaflet afterwards is an effect calling `setMinZoom`/`setMaxZoom`, so the start view is never applied.
- **Pip-Boy zoom range.** The map passes `config.minZoom`/`maxZoom`/`maxBounds` to Leaflet. `maxBounds` resists panning but not zooming out, so a player can zoom out to a view far wider than the bounds.
- **Level of detail.** `visible(places, vr, radii)` picks the markers. Top-level places have no ancestors, so they are visible at every zoom. Zooming out piles them up.
- **Marker reconciliation.** `syncMarkers` diffs the marker set. On `zoomanim`, a diff of `before`/`after` drives `bloomIn`/`collapseInto` against the nearest visible ancestor.
- **Theme.** `engine/theme.js#applyPhosphorTheme` is the single choke point: it sets `--phosphor-rgb` and `--phosphor-bright-rgb`. The tile pane's filter is a fixed green CSS chain in `pipboy.css:1676`, and markers use `var(--phosphor)`.

## Goals / Non-Goals

**Goals:**
- The CMS opens where the Pip-Boy opens.
- The zoom fields can't be misread, and the stored config can't be self-contradictory.
- A player can't zoom out beyond the bounds.
- No two markers overlap. Hidden places are signalled (`+N`, "Nelle vicinanze") and reachable (tap to separate).
- The map takes the player's theme colour, and markers stand out from it by luminance, within the monochrome phosphor palette.
- The declutter and zoom math stay pure and unit-testable, in the style of `map-geometry.js`.

**Non-Goals:**
- Changing the hierarchy rule (`APERTA` / `DENTRO` / `visible`) or effective-radius math. The three implementations stay untouched.
- A generic clustering library (Leaflet.markercluster). It would fight the hierarchy, which is already the semantic grouping.
- A "player viewport preview" frame in the CMS. This was discussed but deferred.
- Overzoom (`maxNativeZoom`) and anything else about zooming *in* further.
- ~~Recolouring the CMS map.~~ Reversed by the unification revision (D11–D13): the CMS now shares the Pip-Boy's icons, render plan and basemap filter. What stays out of scope is the CMS adopting the *phosphor look* by default. Its unfiltered style stays, and the filter remains an opt-in preview.
- The bounds-derived zoom floor (D3) in the CMS. The author has to zoom out past the bounds to edit them.
- Popups in the CMS. A marker click selects the place in the side card, as today, so "Nelle vicinanze" has no CMS counterpart. The `+N` badge and its separate-on-tap action do.

## Decisions

### D1 — CMS re-frames in `load()`, not in an effect

The `next` handler of `load()` calls a private `applyStartView(cfg)` → `this.map?.setView([startLat, startLng], startZoom, { animate: false })` after `config.set(...)`. If the map isn't built yet, `initMap()` already reads the loaded config, so both orderings converge.

*Alternative:* an effect on `config()`. Rejected: it would re-frame on every keystroke in the start fields, which the spec forbids. `load()` already runs exactly on initial load, campaign switch and "Annulla", which are the three moments the spec names.

> **Revision — the first implementation still opens off the start view in a real browser.** `applyStartView` widens the range with `setMinZoom`/`setMaxZoom` and then calls `setView(…, { animate: false })`. When the current zoom lies outside the loaded range (the default `startZoom` 6 against a campaign with `minZoom` 8), `setMinZoom` calls `setZoom`, which starts an **animated** zoom toward the *old* centre. The `setView` that follows resets the view but leaves `_animatingZoom` set, and on `transitionend` Leaflet's `_onZoomTransitionEnd` moves the map back to the animation's target. Reproduced with Leaflet 1.9.4 in headless Chromium: the map lands on the start view and about 250 ms later is back on Rome at zoom 8. Vitest misses it because jsdom has no 3D transforms, so Leaflet disables zoom animation.
>
> **Fix.** Assign the range without side effects, then frame:
> ```
> map.options.minZoom = cfg.minZoom; map.options.maxZoom = cfg.maxZoom;
> map.setView([startLat, startLng], startZoom, { animate: false });
> map.fire('zoomlevelschange');   // keeps the zoom control's disabled state right
> ```
> Same headless check: the view stays on the start point at the start zoom. The zoom-range effect is then a no-op for a fresh load, because `setMinZoom` with an unchanged value does nothing. The rule: **nothing in the load path may trigger an animated zoom.**

### D2 — `startZoom` range validator follows the existing pattern

There is already a `MinZoomNotAboveMaxZoom` validator. Next to it goes a `StartZoomWithinRange` class-validator decorator on `MapConfigDto.startZoom` that reads the sibling fields. In the CMS, a `configError` computed signal returns an Italian message or `null`. When it isn't `null`, it disables **Salva** and renders under the zoom fields. No API shape changes, so there is no OpenAPI or client regeneration beyond descriptions.

Stored documents that already violate the rule keep reading fine. Only the next save is blocked, and the CMS shows why.

### D3 — Effective min zoom = `max(config.minZoom, map.getBoundsZoom(bounds))`

`getBoundsZoom(bounds, false)` returns the largest zoom at which the whole bounds fit the viewport. That answers "you can't zoom out past the bounds" with the bounds fully visible at the floor. The result is clamped to `≤ config.maxZoom`, then applied with `map.setMinZoom(...)`. Leaflet itself raises the current zoom if it is below the new floor.

The floor is recomputed in `revalidateAfterResize()` (immersive toggle) and on Leaflet's `resize` event, and once after the first `invalidateSize()` in the mount `requestAnimationFrame` (the pane has no size before that).

The `zoomRange` constant becomes a function `zoomRangeNow()` returning `{ minZoom: map.getMinZoom(), maxZoom: config.maxZoom }`, so `containZoom`, `revealZoom` and the new separation zoom clamp to the effective range. The tile layer keeps `minZoom: config.minZoom`, which is harmless because it is below the floor.

A pure helper `effectiveMinZoom(configMin, configMax, boundsZoom)` goes in `map-geometry.js` for the unit test. The Leaflet call stays in `map.js`.

### D4 — Declutter is a pure greedy pass over projected points

```
declutter(items, { focused, box = 26, pad = 4 })
  items: [{ slug, type, name, radius, x, y }]   // x,y = map.project(latlng, zoom)
  →      { placed: Set<slug>, absorbedBy: Map<slug, slug>, groups: Map<winner, slug[]> }

order = items sorted by (slug === focused ? -∞ : TYPE_RANK[type], -radius, name, slug)
for p in order:
  hit = first placed q (in placement order) with |p.x−q.x| < box+pad && |p.y−q.y| < box+pad
  if hit: absorbedBy[p] = hit; groups[hit].push(p)
  else:   placed.add(p)
```

The rules of the pass:

- **Ranks.** `TYPE_RANK = { region:1, settlement:2, vault:2, landmark:3, poi:3, building:4, room:5 }`.
- **Which marker absorbs.** Placement order equals priority order, so "first placed hit" is the highest-priority intersecting marker, as the spec requires.
- **Absorbed places take no space.** An absorbed place occupies nothing, so a chain A–B–C where only A–B and B–C overlap places both A and C. That is correct: C doesn't overlap anything that renders.
- **Coordinates.** `map.project(latlng, zoom)` gives absolute world pixels at that zoom. These are invariant under pan by construction, so there is no "pan doesn't change absorption" special case to maintain.
- **Cost.** O(n²) in visible markers. Visible sets are tens of places, because the hierarchy already prunes. A grid bucket is a drop-in optimisation if a campaign ever needs it, and isn't built now.

**Integration in `map.js`.** `visibleSet(vr)` is replaced by `renderPlan(zoom, centre)`, which returns `{ shown: Set, absorbedBy, groups, labelsHidden }` by running `visible()` → `declutter()` → `labelPass()`. Every place that consumed `visibleSet` now consumes `plan.shown`: `syncMarkers`, `zoomanim` (with `e.zoom`), `zoomend`, `revalidateAfterResize`. The previous plan is kept for the animation sources:

- **Bloom source** for a newly shown place: the marker that absorbed it in the *before* plan, if any; otherwise `nearestVisibleAncestor(before)`.
- **Collapse target**: the absorber in the *after* plan, if any; otherwise `nearestVisibleAncestor(after)`.

The same `bloomIn`/`collapseInto`/`deltaAt` functions run unchanged.

**Focus.** `focusPlace` sets `focusedSlug = place.slug` *before* `setView`, so the `zoomanim` plan already honours it. The existing `popupclose` handler clears it and calls `syncMarkers(...)` to re-run the plan at the current zoom, with no animation. That snap is acceptable because it is the same zoom.

### D5 — Badge and popup are updated in place, never by rebuilding the marker

The divIcon HTML gains a `<span class="pb-map-marker-badge" data-map-badge hidden>`. After each plan, every shown marker updates its badge in place (`hidden` + text `+N`). If its group membership changed, it also calls `marker.setPopupContent(popupContent(place, absorbedNames))`. Recreating the marker would kill its animation and close its popup.

The badge listener runs `L.DomEvent.stopPropagation` + `preventDefault` and then calls `separateGroup(winner)`:

```
separationZoom(groupPoints, zoom, range, box = 26, pad = 4)
  d = min over pairs of max(|dx|, |dy|)        // Chebyshev, matching the box test
  d == 0          → range.maxZoom
  else            → clamp(zoom + ceil(log2((box+pad) / d)), zoom+1, range.maxZoom)
```

The map then calls `setView(centre of group bounds, target, { animate: true })`, with no popup.

**Known limitation.** The target separates the group *pairwise*, but at the new zoom another place can open or appear and re-absorb a member. That is acceptable: the badge then shows the new state, and another tap goes deeper.

### D6 — Labels: a second pass on measured sizes

Label width depends on the font and the name, so the pure `labelPass(placedItems, sizes, order)` takes `sizes: Map<slug, {w, h}>`. The sizes are measured once per slug from the rendered label (`offsetWidth` / `offsetHeight`) the first time its marker is in the DOM, then cached for the mount's lifetime. The font is fixed, so the size can't change.

A label box is centred horizontally under the icon (`top: 27px`, from the CSS). It is tested against all placed icon boxes and the label boxes already shown, in priority order. A label that fails gets the class `is-label-hidden` (`visibility: hidden`). The icon stays clickable and the name stays available in the popup and in search.

A place whose size isn't measured yet (its first frame) is treated as shown and re-evaluated at the next plan. One frame of possible overlap on first appearance is accepted rather than pre-rendering off-screen.

### D7 — Theme tint: an SVG `feColorMatrix` injected by `theme.js`

`applyPhosphorTheme(color)` ensures there is a single hidden node in `document.body` holding the filter:

```html
<svg aria-hidden="true" width="0" height="0" style="position:absolute">
  <filter id="pb-phosphor-tint" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values="…"/>
  </filter>
</svg>
```

On every theme change it updates the `values` attribute. `pipboy.css` becomes:

```css
.pb-map-canvas .leaflet-tile-pane { filter: url(#pb-phosphor-tint); }
```

**Why inject instead of authoring the filter in `index.html`:** it keeps one choke point (theme rgb → matrix), needs no markup change, and the service-worker app shell already caches `theme.js`. **Why an SVG filter instead of per-theme CSS chains:** the user picked it. It also gives an exact colour per theme and works for any future theme without hand-tuning a hue-rotate.

> **Superseded (revision).** The first implementation used a single linear matrix, `k · c · L` with `MAP_TINT_GAIN = 4`, and amber/green complementary markers. Both were rejected after seeing them on a real map. D8 replaces the filter body and D9 replaces the marker colour. The injection, the id and the choke point above stay.

### D8 — Basemap: a tone curve per surface, not a linear gain

**Why the linear gain failed.** Measured on real `dark_nolabels` tiles:

| Surface | Colour | Luminance `L` |
|---|---|---|
| Land | `#0e0e0e` | 0.055 |
| Water | `#2c353c` | 0.202 |
| Roads | `#494949` | ≈ 0.29 |

Water is about 4× brighter than land. With gain 4 it reached about 81% of full phosphor (L\* 73 on green), so the sea became the brightest large surface on screen. The amber markers were then only 1.1:1 against it in luminance, and stood out by hue alone.

**The filter graph.** Water is set apart by its blue cast (`B − R` = 16/255; land is neutral), so its level is independent of land:

```
SourceGraphic ─▶ lum  (feColorMatrix: R=G=B=L, A=1)
             ─▶ base (feComponentTransfer, one 256-entry table on R, G, B: the curve below)
SourceGraphic ─▶ wm   (feColorMatrix: rgb 0, A = 18·(B − R))
feFlood(water level) ─ feComposite in wm ─▶ water
feMerge(base, water) ─▶ tint (feColorMatrix, diagonal c′) ─▶ out
```

Land and roads follow a piecewise-linear curve through `(0, 0)`, `(0.055, land)`, `(0.13, lineLo)`, `(0.5, lineHi)`, `(1, lineHi)`. Antialiased coastline pixels fall between 0.055 and 0.13, so `lineLo` also draws the coast as a line between land and sea.

The tint is the theme colour desaturated toward its own luminance: `c′ = Y + (c − Y) · sat`, with `Y = .2126·cR + .7152·cG + .0722·cB`. A full-saturation tint over a large area read as a highlighter.

**Tokens** (in `theme.js`, replacing `MAP_TINT_GAIN`), chosen in the map lab (D10):

| Token | Value | Meaning |
|---|---|---|
| `MAP_TONE.land` | 0.20 | land level, as a fraction of the phosphor colour |
| `MAP_TONE.water` | 0.05 | water level: the sea sits below the land, as on a Pip-Boy map |
| `MAP_TONE.lineLo` | 0.35 | coastlines and minor roads |
| `MAP_TONE.lineHi` | 0.55 | major roads, the ceiling of the basemap |
| `MAP_TINT_SAT` | 0.8 | tint saturation |
| `MAP_WATER_MASK_GAIN` | 18 | `B − R` → mask alpha; water ≈ 1, land ≈ 0 |

The resulting luminance budget (L\*) and WCAG contrast of the marker (`--phosphor-bright`) against each surface:

| Theme | Land / water / roads (L\*) | Marker on land | on water | on roads |
|---|---|---|---|---|
| VERDE | 17 / 3 / 40 | 12.1:1 | 16.7:1 | 5.5:1 |
| AMBRA | 15 / 3 / 35 | 10.7:1 | 14.0:1 | 5.5:1 |
| BIANCO | 20 / 3 / 44 | 13.2:1 | 19.6:1 | 5.5:1 |

Before, on VERDE: land 20 / water 73 / roads 89, and the amber marker at 1.1:1 on water and 1.4:1 on roads.

*Alternatives considered in the lab:* posterised levels (stepping at intermediate zooms, land collapsing to black), water as scanlines (needs the filter per tile, with `feImage` + `feTile`, which is heavier on low-end phones), and a lower linear gain (water stays brighter than land whatever the gain).

### D9 — Markers: monochrome, set apart by luminance

The complementary marker colour and `--map-marker-rgb` are removed. Markers use the theme's own colours, and the hierarchy comes from luminance and a knockout halo:

- **Icon**: stroke `--phosphor-bright`, width 1.9. Its filter is `drop-shadow(0 0 1px var(--screen-bg)) drop-shadow(0 0 1.5px var(--screen-bg))`, which cuts the icon out of the map, then `drop-shadow(0 0 4px rgba(var(--phosphor-rgb), .5))` for the glow.
- **Label**: a quieter second tier, in `--phosphor` with element `opacity: .8`. The opacity follows the `pipboy.css` header rule "dim text with element opacity, never a colour alpha". Its `text-shadow` is a triple `--screen-bg` halo, with no glow.
- **`+N` badge**: border and text in `--phosphor-bright` on `--screen-bg`.

Popup, breadcrumb, search and the immersive toggle keep `--phosphor`, as before. This is also what the `pipboy.css` header requires: "nothing outside this set may be introduced". The amber marker on the green theme was the one exception, and it is gone.

### D10 — The map lab: a dev tool for tuning the basemap

`apps/pip-boy/tools/map-lab/` holds a standalone page used to choose the D8/D9 tokens. It shows real CARTO tiles, the same filter graph, the real icon set and sample places on the US West Coast, with:

- the three themes and the presets compared during design;
- sliders for every token;
- a hold-to-compare with the original look;
- the L\* budget and WCAG ratios live;
- a copyable JSON of the parameters.

The folder holds three files:

```
apps/pip-boy/tools/map-lab/
├── README.md        what it is for, how to run it, how to bring a result back into theme.js
├── map-lab.html     the page; `__CARTO_KEY__` placeholder, never a real key
└── serve.mjs        dependency-free Node server (node:http, node:fs)
```

`npm run map-lab` (in `apps/pip-boy`) runs `serve.mjs`. The server:

- reads `CARTO_BASEMAP_KEY` from the repo-root `.env`;
- serves `map-lab.html` on `http://localhost:<port>` with the placeholder replaced in memory;
- serves the vendored `src/vendor/leaflet/` so the lab uses the app's Leaflet version, offline;
- opens the browser.

**Why a server instead of a generated file:** the browser cannot read `.env` from a page opened from disk. A generated `map-lab.local.html` would put the key on disk, where it can be committed or shared. The vendored Leaflet is ESM-only (`leaflet.esm.js`), and module scripts do not load from `file://`. Serving solves both, and the key exists only in memory. Without a key the page still loads and CARTO shows its "API KEY REQUIRED" tiles. This is the same honest signal the app gives.

**Not shipped.** `tools` is added to `apps/pip-boy/.dockerignore`, because the image does `COPY .` of the whole app into the nginx web root.

**Duplication.** The lab re-implements the filter graph instead of importing `theme.js`, so it can expose every token as a slider. Its header comment and the README name `engine/theme.js` as the source of truth. The "Scelta" preset imports the tokens from `theme.js` (the server exposes that one file), so it always shows what the app ships; only a change to the graph itself has to be mirrored by hand.

> **Revision (D11).** The tokens and `filterMarkup` move to the shared `map-core` package. The lab imports both from the Pip-Boy's synced copy (`src/shared/map-core/`, which the server now exposes in place of `engine/theme.js`). It builds its filter by calling `filterMarkup(rgb, { tone, sat })` with the slider values, so the hand-mirrored graph disappears. The README's source of truth becomes `apps/packages/map-core/style.js`.

### D11 — One map core, synced into each app

The rules and the style both apps must agree on move to `apps/packages/map-core/`, the single place they are edited:

```
apps/packages/map-core/
├── style.js         PHOSPHOR_THEMES, MAP_TONE, MAP_TINT_SAT, MAP_WATER_MASK_GAIN,
│                    MAP_TINT_FILTER_ID, toneTable, tintColour, filterOutput,
│                    filterMarkup, ensureTintFilter(doc, rgb)
├── geometry.js      today's map-geometry.js: effectiveRadius, visible, declutter,
│                    labelPass, separationZoom, effectiveMinZoom, revealZoom, …
├── icons.js         ICONS, TYPE_DEFAULT_ICON, iconFor(place)
├── marker-layer.js  createMarkerLayer(L, map, opts): render plan, marker sync,
│                    bloom/collapse, +N badge, label pass (D12)
├── markers.css      marker structure: box, label offset, badge, is-label-hidden,
│                    bloom classes; colours only through --mk-* custom properties
├── *.d.ts           types for the CMS
└── README.md        what lives here, the sync rule, how to run the check
```

**Sync, not a cross-context import.** `scripts/sync-map-core.mjs` copies the package into `apps/pip-boy/src/shared/map-core/` and `apps/cms/src/app/shared/map-core/`. Each copied file gets a header naming the package as the source and saying not to edit it. Both copies are committed. With `--check`, the script exits non-zero when a copy differs from the package. Each app's own suite runs the check (a Playwright spec in the Pip-Boy, a Vitest spec in the CMS), so a hand edit to a copy, or a package edit that was never synced, fails the build.

*Why copies.* Four consumers resolve files only inside their own app folder: the per-app Docker build contexts (`./apps/cms`, `./apps/pip-boy`), the dev override that mounts `./apps/pip-boy` as the nginx root, the Playwright static server, and the CMS's `tsconfig` include. A copy keeps all four unchanged.

*Alternative:* compose `additional_contexts` plus `COPY --from=map-core` in both Dockerfiles. Rejected: the dev mount and the Playwright static server would each need their own path mapping, so there would be three places to keep in step instead of one script.

**The Pip-Boy has no bundler**, so everything stays ES modules without dependencies. Leaflet is **injected** (`createMarkerLayer(L, …)`), never imported. The Pip-Boy passes its vendored ESM build and the CMS its npm `leaflet`, both 1.9.4. `sw.js`'s `REQUIRED_SHELL_URLS` lists the copied files in place of `src/tabs/map-geometry.js`, and `index.html` links `src/shared/map-core/markers.css`. The CMS adds the copy's `markers.css` to `angular.json` `styles`.

**What stays per app.** `theme.js#applyPhosphorTheme` (the CSS custom properties) calls `ensureTintFilter` from the core. `map.js` keeps the popup, breadcrumb, search, immersive mode and zoom floor. The CMS keeps selection, dragging, radius and bounds handles.

**Effective radius goes from three implementations to two.** `place-tree.ts#effectiveRadius` re-exports the core's, so the CMS circle and the CMS level of detail can't disagree. The API's `campaign-map.service.ts` stays separate, a different runtime, and the comment in `geometry.js` is updated to name two implementations.

### D12 — The CMS renders markers through the shared layer

`createMarkerLayer(L, map, opts)` owns what `map.js`'s `syncMarkers`/`zoomanim`/`zoomend` own today:

```
opts: {
  places, radii,                 // getters, read on each plan
  focused: () => slug | null,    // placed first, never hidden by LOD or declutter
  include: (place) => boolean,   // post-LOD filter (CMS name filter); default all
  markerClass: (place) => string,// e.g. 'is-hidden' for red
  markerOptions: (place) => {},  // e.g. { draggable: true }
  onClick(place, marker), onDragEnd(place, latlng),
  onBadge(group)                 // default: separate (D5)
}
→ { sync(), plan(), markerFor(slug), destroy() }
```

Pipeline per plan: `visible(places)` → `include` → force `focused` in → `declutter` → `labelPass`, with the bloom/collapse diff on `zoomanim`, exactly as D4–D6. The Pip-Boy builds on it and adds its popup and focus wiring.

**CMS mapping.**
- **Every place takes part, public or not.** Non-public and inherited places go through LOD and declutter like any other. Only the colour differs (D13).
- **The selected place is `focused`.** It is always rendered, whatever its zoom, and wins collisions, so it stays draggable and editable from the card or the table.
- **The name filter is `include`, applied after LOD.** It hides non-matching markers, as the spec already requires, without changing which places are open.
- **Tree collapse affects rows only, unchanged.**
- **Dragging an absorbed place isn't possible.** Its absorber's `+N` badge separates the group first. A drop re-runs the plan.
- **The CMS keeps the config zoom range.** No bounds floor (Non-Goals).

### D13 — CMS colours: the current look with Pip-Boy icons, green phosphor under the preview

The basemap and marker colours depend on the "Anteprima filtro Pip-Boy" checkbox:

| | Basemap | Public icon + label | Hidden or inherited icon + label |
|---|---|---|---|
| Preview off (default) | CARTO dark, unfiltered (as today) | CMS green `#66bb6a` | CMS red `#ef5350` |
| Preview on | `filter: url(#pb-phosphor-tint)`, built by `ensureTintFilter` with **VERDE** | VERDE `--phosphor-bright` / `--phosphor`, exactly as the Pip-Boy | CMS red `#ef5350` |

The greens and reds are the 400 shades of the hues the CMS uses today (`#2e7d32`, `#b71c1c`). Against CARTO's `#0e0e0e` land, the 800 shades reach only 3.8:1 and 2.9:1. The 400 shades reach 8.2:1 (green) and 5.5:1 (red). On water and roads, which are lighter, even the 400s fall below 4.5:1, so there the dark knockout halo from the shared `markers.css` (D9) does the separating, as it does on the Pip-Boy. The halo, label offset and badge come from the shared `markers.css`. Only the `--mk-icon`/`--mk-label` properties differ.

Hidden and inherited are **both red**, because the player sees neither. The table keeps the distinct "Nascosto" and "Ereditato" pills, but the map no longer tells them apart. This replaces the "inherited distinct again on the map" clause of `cms-campaign-map`.

The old `.cm-filtered` CSS chain (`sepia(1) hue-rotate(90deg)…`) and its "exact token" comment are removed.

## Risks / Trade-offs

- **SVG `url()` filters on HTML may rasterise on the CPU** in some engines. Chrome and Android WebView may skip the GPU path that CSS filter functions get, so pan and zoom could stutter on low-end phones. → Profile pan/zoom on a low-end Android device during implementation. Fallback: keep the per-theme matrix as the source of truth but emit an equivalent CSS chain per theme. The spec requirement "filter references the SVG filter" would then need amending, so decide before archive.
- **Tile edges and seams under the filter.** `color-interpolation-filters="sRGB"` avoids the linearRGB default washing out the dark basemap. → Covered by setting it explicitly.
- **The declutter changes what "visible" means for existing tests.** Specs that assume every `visible()` place has a marker can break when fixtures overlap. → Run the existing map specs. Where fixtures are dense by accident, spread their coordinates rather than weaken the declutter.
- **Measured label sizes are font-dependent.** VT323 may load late from Google Fonts or fall back. → Measure after `document.fonts.ready` resolves; until then labels are treated as shown.
- **Effective min zoom can trap the player at the start view.** If `startZoom` is below the bounds floor, Leaflet raises it on mount. → Expected and correct. The CMS still validates `startZoom` only against the config range, because the floor depends on the device.
- **Separation can bounce.** See D5: a tap may reveal a new absorber. → Accepted. Each tap makes progress (strictly higher zoom) and the zoom is bounded by `maxZoom`.
- **The water mask depends on CARTO's palette.** It keys on water's blue cast. If CARTO restyles `dark_nolabels`, water could read as land. → The lab shows it immediately, and its README records the measured colours to re-check. A Playwright check can assert the mask's matrix, not the tiles.
- **A heavier filter graph.** D8 adds a table transfer, a mask, a flood, a composite and a merge to the one matrix. This raises the stakes of the Android profiling (task 6.6). → Profile the D8 graph, not the old matrix. The fallback is to drop the water mask and keep only the curve.
- **Flat road hierarchy.** With `lineLo` 0.35 and `lineHi` 0.55, minor and major roads sit close together. → Accepted: on a game map they read as terrain texture, and nothing competes with the markers.
- **Synced copies can drift.** Someone may edit a copy instead of the package. → The `--check` runs in both apps' suites, and every copied file's header says where to edit.
- **LOD in the CMS hides places the author wants to touch.** A room isn't on the map until its building is open. → The selected place is always rendered (D12), and selecting a row in the table makes it appear. Zooming in is the authoring gesture, as it is for the player.
- **Extracting the marker layer from `map.js` can regress the Pip-Boy.** `mountMap` is one ~780-line closure. → Move the code first with no behaviour change and keep the existing Playwright map specs green, then wire the CMS.
- **The CARTO key's domain lock and `localhost`.** If the key is restricted to the production domain, the lab's tiles fail. → The README says so. Add `localhost` to the key's allowed domains, or use a dev key.

## Migration Plan

There is no data migration. The API validator applies only to new writes. Deploy order doesn't matter: the CMS validation is a subset of the API's, and the Pip-Boy reads the same document. Rollback is a redeploy of any app on its own.

## Open Questions

- ~~The exact `MAP_TINT_GAIN` and whether a trailing `contrast()` is needed.~~ Resolved by D8: the gain is replaced by the tone-curve tokens chosen in the map lab.
- The collision padding (`pad = 4 px`) and whether region markers, which are visually the "big" places, should use a larger box. Start with a uniform box and revisit after seeing a real campaign.
