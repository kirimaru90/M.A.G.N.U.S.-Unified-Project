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
- The map takes the player's theme colour, and markers contrast with it.
- The declutter and zoom math stay pure and unit-testable, in the style of `map-geometry.js`.

**Non-Goals:**
- Changing the hierarchy rule (`APERTA` / `DENTRO` / `visible`) or effective-radius math. The three implementations stay untouched.
- A generic clustering library (Leaflet.markercluster). It would fight the hierarchy, which is already the semantic grouping.
- A "player viewport preview" frame in the CMS. This was discussed but deferred.
- Overzoom (`maxNativeZoom`) and anything else about zooming *in* further.
- Recolouring the CMS map. Its filter preview stays an authoring aid.

## Decisions

### D1 — CMS re-frames in `load()`, not in an effect

The `next` handler of `load()` calls a private `applyStartView(cfg)` → `this.map?.setView([startLat, startLng], startZoom, { animate: false })` after `config.set(...)`. If the map isn't built yet, `initMap()` already reads the loaded config, so both orderings converge.

*Alternative:* an effect on `config()`. Rejected: it would re-frame on every keystroke in the start fields, which the spec forbids. `load()` already runs exactly on initial load, campaign switch and "Annulla", which are the three moments the spec names.

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

The matrix maps Rec.709 luminance `L = .2126R + .7152G + .0722B` onto the theme colour `c = rgb/255` with gain `k`:

```
[ k·cR·.2126  k·cR·.7152  k·cR·.0722  0  0 ]
[ k·cG·.2126  k·cG·.7152  k·cG·.0722  0  0 ]
[ k·cB·.2126  k·cB·.7152  k·cB·.0722  0  0 ]
[ 0           0           0           1  0 ]
```

`MAP_TINT_GAIN` is a named constant in `theme.js`, the design token. It is tuned by eye so the green theme matches today's look. A brightness/contrast step can be appended in the CSS (`url(#…) contrast(…)`) if the by-eye match needs it.

**Why inject instead of authoring the filter in `index.html`:** it keeps one choke point (theme rgb → matrix), needs no markup change, and the service-worker app shell already caches `theme.js`. **Why an SVG filter instead of per-theme CSS chains:** the user picked it. It also gives an exact colour per theme and works for any future theme without hand-tuning a hue-rotate.

The marker colour is a new per-theme `markerRgb` in `PHOSPHOR_THEMES`, which `applyPhosphorTheme` writes to `--map-marker-rgb`:

| Theme | Marker colour |
|---|---|
| green | the amber triplet `255, 176, 46` |
| amber | the green triplet `51, 255, 102` |
| white | the green triplet `51, 255, 102` |

The `:root` default is the amber triplet, matching the default green theme. Marker SVG stroke, glow, label colour and badge use `rgb(var(--map-marker-rgb))`. Popup, breadcrumb, search and toggle keep `--phosphor`.

## Risks / Trade-offs

- **SVG `url()` filters on HTML may rasterise on the CPU** in some engines. Chrome and Android WebView may skip the GPU path that CSS filter functions get, so pan and zoom could stutter on low-end phones. → Profile pan/zoom on a low-end Android device during implementation. Fallback: keep the per-theme matrix as the source of truth but emit an equivalent CSS chain per theme. The spec requirement "filter references the SVG filter" would then need amending, so decide before archive.
- **Tile edges and seams under the filter.** `color-interpolation-filters="sRGB"` avoids the linearRGB default washing out the dark basemap. → Covered by setting it explicitly.
- **The declutter changes what "visible" means for existing tests.** Specs that assume every `visible()` place has a marker can break when fixtures overlap. → Run the existing map specs. Where fixtures are dense by accident, spread their coordinates rather than weaken the declutter.
- **Measured label sizes are font-dependent.** VT323 may load late from Google Fonts or fall back. → Measure after `document.fonts.ready` resolves; until then labels are treated as shown.
- **Effective min zoom can trap the player at the start view.** If `startZoom` is below the bounds floor, Leaflet raises it on mount. → Expected and correct. The CMS still validates `startZoom` only against the config range, because the floor depends on the device.
- **Separation can bounce.** See D5: a tap may reveal a new absorber. → Accepted. Each tap makes progress (strictly higher zoom) and the zoom is bounded by `maxZoom`.

## Migration Plan

There is no data migration. The API validator applies only to new writes. Deploy order doesn't matter: the CMS validation is a subset of the API's, and the Pip-Boy reads the same document. Rollback is a redeploy of any app on its own.

## Open Questions

- The exact `MAP_TINT_GAIN` and whether a trailing `contrast()` is needed. This is a by-eye decision during implementation against the current green.
- The collision padding (`pad = 4 px`) and whether region markers, which are visually the "big" places, should use a larger box. Start with a uniform box and revisit after seeing a real campaign.
