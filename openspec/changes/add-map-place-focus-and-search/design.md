## Context

`add-campaign-map` built the map as something you *look at*: the level-of-detail engine in `map-geometry.js` decides what renders at a given zoom, and `map.js` paints it with a bloom animation. This change makes the map something you *interrogate* — tap, open, search — without touching that engine's rules. Everything below reuses `isOpen`, `isInside`, `effectiveRadius`, and `viewportRadius` as given; the only new geometry is two zoom-from-radius helpers, which are their inverse.

Settled against a throwaway HTML prototype built from the real geometry and the real phosphor tokens. Two decisions look like they could have gone the other way and did not; they are flagged.

## The one primitive

The three interactions are one operation with a flag:

```
focusPlace(place, { open }):
    centre the view on place
    zoom to  open ? containZoom(place)      // its interior fills the view
                  : revealZoom(place)         // its own marker is on screen
    then open the place's popup
```

- **Marker tap** → the marker is already visible, so `focusPlace(p, { open:false })` just centres and pops.
- **Vedi mappa** (from inside the popup) → `focusPlace(p, { open:true })`.
- **Search select** → `focusPlace(p, { open:false })`, and because the target may be a deep hidden place, `revealZoom` does the real work.

Writing it once is not tidiness for its own sake: it guarantees that "search for X" and "tap X" land in exactly the same state, which is the behaviour the proposal promises.

## The zoom windows

A place's marker only exists inside a band of zoom levels, because `visible(p) = every ancestor APERTA && p not APERTA`. Expressed in `vr` (viewport radius in metres, which *shrinks* as you zoom in):

```
zoom OUT ◄─────────────────────────────────────────────► zoom IN
            vr = R(parent)        vr = R(p)        vr = R(biggest child)
                  │                   │                    │
 p hidden in      │  p's MARKER shown │   p is OPEN        │  a child opens;
 parent's marker  │  (ancestors open, │  (p's own map,     │  p's map gives way
 (parent closed)  │   p still closed) │   children shown)  │  to a child's
                  ▼                   ▼                    ▼
            revealZoom(p)       containZoom(p)         (deeper than p)
```

Both new helpers invert `viewportRadius`: given a target `vr`, the zoom that produces it is `log2( (halfShortSide · baseResolution · cos lat) / vr )`, clamped to the campaign's `[minZoom, maxZoom]`. In `map.js` this is Leaflet's `map.getBoundsZoom(circleBounds)` for free — no hand-rolled Mercator math — but the pure helper in `map-geometry.js` carries the closed form so it is unit-testable without a map instance.

- **`containZoom(p)`** targets `vr = R(p)`: the least zoom at which `p` is `APERTA`, so its whole circle just fits the viewport. This is *Vedi mappa*.
- **`revealZoom(p)`** targets a `vr` inside `( R(p), R(parent) ]`: `p`'s ancestors are open but `p` is not, so `p`'s marker renders. For a top-level place, there is no parent bound, so it targets a `vr` a step larger than `R(p)` and lets it sit closed among nothing.

### Decision: *Vedi mappa* fits the interior — it does not zoom to the maximum (FLAGGED)

"Zoom to show the location's map" has two readings. **A**: fit the interior — `vr = R(p)`, the least zoom that opens `p`, framing the whole local map. **B**: the *maximum* zoom still showing `p`'s own map — `vr` just above the largest child's radius, the deepest you can go before diving into a child. The prototype made the choice obvious: **A**. B leaves you zoomed to one edge of the interior, and gets pathological when children have wildly different radii (a single tiny child drags the "maximum" all the way in). "See the map" means "see the whole map." Do not change this to B because the button's verb sounds like "go as deep as possible."

### Decision: the popup lives and dies with its marker (FLAGGED)

The popup is bound to the marker (`marker.bindPopup` / `L.popup`), not floated independently. So when `syncMarkers` removes a marker — because the place opened, or panned out of the visible set — Leaflet tears its popup down with it, for free. That is *why* the popup closes on *Vedi mappa*: pressing it raises the zoom, `p` becomes `APERTA`, its marker leaves the set, and the popup goes. This is the intended behaviour, not a glitch to "fix" by re-pinning the popup after the place opens — once you are inside a place, its own name is in the breadcrumb and its children are on screen; a lingering popup would name the room you are now standing in.

The one wrinkle: focusing a *hidden* place from search opens its popup on a marker that does not exist yet at call time. `setView` creates the marker during its zoom transition, so the popup open is deferred to the transition's end (`map.once('moveend'/'zoomend')`) and then opened on the now-present marker — the same seam the bloom animation already hooks.

## The search surface

- **The index is the received set, and that is the security property.** The client searches `places` as delivered; the API already stripped non-public places and their subtrees server-side (`campaign-map.service.ts`). So a player's search is structurally incapable of naming a secret — there is nothing client-side to filter, and nothing to leak. No new visibility code, on purpose.
- **A DOM control, not an `L.control`.** The attribution line already establishes the pattern: an absolutely-positioned element inside `.pb-map-canvas`, above the tiles, inside the `data-pb-no-swipe` region so a drag on it does not leave the tab. The lens button and its expanding field follow that, not Leaflet's control framework.
- **Accent-insensitive by default.** The content is Italian; `città` must match `citta`. Match on `name.normalize('NFD')` with combining marks stripped, case-folded. Names only — `desc` is not searched (the proposal scopes it to names); revisit only if authors ask.

## Non-Goals

- **No fuzzy/typo-tolerant search.** Substring on folded names. The place count per campaign is small; ranking is "earliest match position wins."
- **No search history, no recents, no keyboard shortcut to open the lens.** The button opens it; `Escape` closes it. Arrow keys and `Enter` move and commit within the list.
- **No change to the LOD rule, the bloom, the attribution, or the tab/nav/precache surfaces.** This change is behaviour on top of the existing tab.

## Settled implementation values

Recorded per §7.2, after the behaviour was implemented and the Playwright/unit suites went green (302 pip-boy specs + the geometry units). These are the knobs the prototype's "fit the interior / clean expand / popup above the marker" reading turned into, kept here so a later tweak knows what was deliberate:

- **Whole-level zooms (default `zoomSnap: 1`).** The derived zooms round to integers so the raster basemap tiles stay crisp. `containZoom` rounds **up** — `Math.ceil(exact - 1e-9)` — to the least integer level that opens the place; rounding down would land *below* the open threshold and leave *Vedi mappa* "zoomed in not enough to open". `revealZoom` rounds its geometric-middle target into the integer window where the marker actually renders (ancestors open, place still closed), preferring the lower edge when the window spans no whole level.
- **`zoomAnimationThreshold: maxZoom - minZoom + 1` on the `L.map`, and `focusPlace` passes `{ animate: true }`.** Leaflet jumps instantly when a zoom delta exceeds the default threshold of 4, which read as "centring without animation" on a multi-level focus (e.g. search across the map). Raising the threshold past the whole zoom span makes every tap ease to its target instead.
- **Popup options: `autoPan`, `autoClose`, `closeOnClick` all off; `closeButton` off.** The popup closes only when its marker is torn down (place opened, or panned off — the latter handled explicitly on `moveend` since a pan leaves the marker set untouched), or when another marker's popup opens (Leaflet keeps a single map popup). `autoPan` off so opening it never shifts the centre away from the place `focusPlace` just centred.
- **Deferred popup open** for a revealed hidden place: `map.once('moveend', …)`, since the marker is created during the `setView` transition. For an already-rendered marker it opens synchronously.
- **Search control** sits top-right of `.pb-map-canvas` (`z-index: 600`, above the attribution's 500); the lens is a 30×30 button; the field is `180px` (capped at `60vw`); the list caps at 8 results and `40vh`. It lives inside the canvas — the `data-pb-no-swipe` region — with `L.DomEvent.disableClickPropagation/disableScrollPropagation` so gestures on it never reach the map.
- **No new timings.** The open/reveal reuse the existing bloom (`BLOOM_MS 800` / `FADE_MS 400`) via the `zoomanim` path unchanged; the search field's expand is an immediate show, no animation. No new colours — all phosphor tokens.
