# pipboy-map-tab Specification (delta)

## ADDED Requirements

### Requirement: MAPPA tab renders the campaign map

The character sheet SHALL provide a `MAPPA` first-level tab rendering the current campaign's map from `GET /campaigns/:id/map`.

The tab SHALL follow the per-tab lazy-fetch pattern already used by `NOTES` (`src/tabs/notes.js:14`): render synchronously, paint a skeleton, and fill in when its own fetch resolves. A failed fetch SHALL degrade to an empty map with a CRT-consistent Italian message, never a crash or a blank pane.

The tab SHALL NOT filter places by visibility. The API returns only what the caller may see; the client SHALL render what it receives.

#### Scenario: Map tab loads
- **WHEN** the user selects the `MAPPA` tab
- **THEN** a Leaflet map renders inside the content pane, centred on the campaign's configured start position and zoom

#### Scenario: Failed load degrades
- **WHEN** the map request fails
- **THEN** the tab shows an Italian offline-consistent message and the sheet remains usable

### Requirement: Leaflet is vendored, not fetched

Leaflet SHALL be committed under `apps/pip-boy/src/vendor/` and imported as a relative ES module. The app SHALL NOT load Leaflet, its stylesheet, or any part of it from a CDN, so an installed PWA has its map library available offline.

#### Scenario: No CDN dependency for the library
- **WHEN** the map tab's module graph is inspected
- **THEN** Leaflet resolves to a path under `src/vendor/` and no cross-origin script or stylesheet is required to render the map

### Requirement: Fallout-filtered CARTO basemap

The tile layer SHALL use CARTO's label-free dark basemap. Its attribution is specified separately below.

The tile pane SHALL be filtered with exactly:

```css
filter: grayscale(1) invert(0) sepia(1) hue-rotate(90deg) saturate(8) brightness(2) contrast(1);
```

These values are a design token of this capability, not a tuning parameter.

Because `pipboy.css:209` (`.pb-screen * { text-shadow: inherit }`) force-inherits the phosphor glow onto every descendant, the tile pane SHALL explicitly reset `text-shadow` so the glow does not smear the tiles. The CRT overlays SHALL continue to render above the map.

#### Scenario: Tiles are filtered
- **WHEN** the computed style of `.leaflet-tile-pane` is inspected
- **THEN** it carries the specified filter chain

### Requirement: Basemap attribution shows briefly, then collapses to Credits

The map SHALL NOT render a persistent attribution watermark: Leaflet's built-in attribution control SHALL be disabled (`attributionControl: false`), which also removes its "Leaflet" prefix — Leaflet's BSD-2 licence requires its copyright notice in the source, which the vendored copy retains, not on screen.

Instead, on entering the `MAPPA` tab the map SHALL display the basemap attribution — naming OpenStreetMap and CARTO — as an unobtrusive line in the map's own phosphor styling, which SHALL **automatically collapse after five seconds**. This is one of the collapse mechanisms named verbatim by the OSM Foundation's Attribution Guidelines ("automatically after five seconds"), so the initial presentation obligation is met without permanent chrome.

The full attribution SHALL remain findable at any time from the **Credits** entry of the settings popup — the guidelines' other named example ("an 'About' option in a menu") — so a user who looks for the licence information can always find it.

The line SHALL NOT block interaction with the map while it is visible, and SHALL NOT reappear on every pan or zoom within the same visit to the tab.

#### Scenario: No permanent watermark
- **WHEN** the map has been open for longer than the collapse delay
- **THEN** no attribution control or watermark is rendered over the map

#### Scenario: Attribution is presented on entering the tab
- **WHEN** the user selects the `MAPPA` tab
- **THEN** a line naming OpenStreetMap and CARTO is visible over the map

#### Scenario: Attribution collapses on its own
- **GIVEN** the user has just entered the `MAPPA` tab
- **WHEN** five seconds pass
- **THEN** the attribution line is no longer displayed

#### Scenario: Attribution does not obstruct the map
- **GIVEN** the attribution line is still visible
- **WHEN** the user pans or zooms beneath it
- **THEN** the gesture reaches the map and the line does not intercept it

#### Scenario: Attribution stays findable after it collapses
- **GIVEN** the attribution line has collapsed
- **WHEN** the user opens the settings popup and selects Credits
- **THEN** the OpenStreetMap and CARTO attribution is shown in full

### Requirement: Map view is constrained by the campaign config

The map SHALL honour the campaign's `minZoom`, `maxZoom`, and `bounds`. A pan that would leave the configured bounds SHALL be resisted, and zoom SHALL be clamped to the configured range.

#### Scenario: Pan is bounded
- **WHEN** the user drags beyond the configured bounds
- **THEN** the view is constrained back inside them

#### Scenario: Zoom is clamped
- **WHEN** the user attempts to zoom past the configured maximum
- **THEN** the zoom does not exceed it

### Requirement: Places render by icon, resolved at render time

Each visible place SHALL render a marker bearing its icon: its own `icon` key when set, otherwise its type's default key, resolved **at render** (`place.icon ?? PLACE_TYPES[place.type].icon`) rather than copied at creation, so changing a type's default updates every place that never overrode it.

Icon keys SHALL resolve against a built-in inline-SVG set shipped with the app, following the existing inline-SVG convention. An unknown key SHALL fall back to the type's default rather than rendering nothing.

#### Scenario: Place uses its type's default icon
- **WHEN** a place has no `icon` of its own
- **THEN** its marker renders its type's default icon

#### Scenario: Place overrides its icon
- **WHEN** a place sets an `icon` key
- **THEN** its marker renders that icon instead of its type's default

### Requirement: Level of detail follows viewport containment, not an authored zoom

Visibility SHALL derive from geometry alone. Let `vr` be **half the map viewport's shorter side, expressed in metres** at the current zoom and centre, and `R(p)` the effective radius defined by `api-campaign-map`. Then:

```
APERTA(p)  =  p.hasLocalMap && p has children && vr <= R(p)
DENTRO(p)  =  p.hasLocalMap && dist(centre, p) <= R(p)

visible(p) =  every ancestor of p is APERTA  &&  p is not APERTA
```

There SHALL be no authored per-place zoom threshold. A place's children appear when the viewport fits inside its circle — so a large region opens early and a small room opens late, without either being configured.

Visibility SHALL depend on zoom only, never on the centre's position: at a zoom where a zone is open, its children SHALL render whether or not the viewport is centred on it. A place that is `APERTA` SHALL NOT render its own marker — its children render in its place.

#### Scenario: Zooming into a zone reveals its children
- **GIVEN** the map is showing top-level zone markers
- **WHEN** the user zooms in until the viewport fits within a zone's radius
- **THEN** that zone's marker is replaced by its children's markers

#### Scenario: Children stay visible when the centre moves off them
- **GIVEN** a zone is open and its children are rendered
- **WHEN** the user pans so the centre leaves that zone
- **THEN** the children remain rendered — only the breadcrumb changes

#### Scenario: The same zoom shows different tiers in different places
- **GIVEN** two zones of very different radius
- **WHEN** the user views each at the same zoom level
- **THEN** the larger zone may be open while the smaller is not, because the tier follows the area in view

#### Scenario: A place without a local map never opens
- **WHEN** the user zooms fully in over a place with `hasLocalMap: false`
- **THEN** its marker remains and no children appear

### Requirement: Zone indicator shows the entered chain as a breadcrumb

The tab SHALL display a zone indicator over the top of the map naming the chain of places the viewport is currently inside: the deepest place that is both `APERTA` and `DENTRO`, preceded by its ancestors, separated by `›`.

A place SHALL NOT appear in the breadcrumb unless it is `APERTA`, so the indicator never names a tier that is not being rendered. When the centre is inside no open place, the indicator SHALL show the map's root label.

When two candidate places both contain the centre, the one with the **smallest effective radius** SHALL win.

The chain SHALL be truncated from the **left** when it exceeds the available width, keeping the deepest entries — where you are matters more than distant ancestry.

#### Scenario: Breadcrumb names the entered chain
- **GIVEN** the viewport is inside a region, inside a vault within it
- **WHEN** the indicator renders
- **THEN** it reads `REGION › VAULT`, with the deepest entry emphasised

#### Scenario: Breadcrumb never names an unopened tier
- **GIVEN** the viewport is centred over a room deep inside a vault, but zoomed far out so only zone markers render
- **WHEN** the indicator renders
- **THEN** it shows the root label, not the room's chain

#### Scenario: Breadcrumb follows the centre
- **GIVEN** a zone is open and the viewport is centred inside a vault within it
- **WHEN** the user pans out of the vault but stays within the zone
- **THEN** the breadcrumb drops the vault and names the zone alone

#### Scenario: Overlapping zones resolve to the tighter one
- **GIVEN** the centre lies inside two zones whose circles overlap
- **WHEN** the indicator renders
- **THEN** it names the zone with the smaller effective radius

### Requirement: Places bloom out of and collapse into their zone

When a place becomes `APERTA`, its children's markers SHALL animate **from the on-screen position of the nearest ancestor that was visible before the transition** to their own positions, while that ancestor's own marker dissolves. When a place stops being `APERTA`, its children SHALL animate into the nearest ancestor that will be visible after the transition, while that ancestor's marker re-forms.

Both directions SHALL run for **800 ms** and SHALL use the **same** easing curve — `cubic-bezier(.16, 1, .3, 1)` — and NOT mirrored curves. A time-reversed ease-out is an ease-in, which relocates the curve's imperceptible tail to the start of the exit where it reads as several hundred milliseconds of lag; the two directions must therefore share one curve to feel like one gesture.

Animation SHALL be driven by zoom transitions only; panning SHALL NOT animate. State SHALL be computed against the **destination** zoom so the animation runs alongside the map's own zoom rather than after it, and animation offsets SHALL be projected at that destination zoom.

Markers SHALL persist across redraws and be reconciled by difference; a redraw that destroys and rebuilds the marker set cannot animate.

#### Scenario: Children bloom out of their zone
- **WHEN** the user zooms in far enough to open a zone
- **THEN** its children's icons animate outward from that zone's icon position as the zone's own icon dissolves

#### Scenario: Children collapse back in
- **WHEN** the user zooms out far enough to close an open zone
- **THEN** its children's icons animate inward to that zone's position as the zone's icon re-forms

#### Scenario: A multi-tier jump animates from what was actually on screen
- **GIVEN** a single zoom step opens both a region and a vault inside it, so the vault's icon was never rendered
- **WHEN** the vault's rooms appear
- **THEN** they animate from the region's icon — the deepest ancestor that was actually visible — not from the vault's never-rendered position

#### Scenario: Panning does not animate
- **WHEN** the user pans without changing zoom
- **THEN** no markers bloom or collapse

### Requirement: The map surface owns horizontal gestures

Over the map, a horizontal drag SHALL pan the map and SHALL NOT trigger the sheet's swipe navigation. The map container SHALL be exempt from the swipe handler described by `pipboy-sheet-navigation`.

Leaving the `MAPPA` tab SHALL remain possible via the first-level tab bar, which is always visible.

#### Scenario: Horizontal drag pans instead of navigating
- **GIVEN** the `MAPPA` tab is active
- **WHEN** the user drags horizontally across the map past the swipe distance threshold
- **THEN** the map pans and the active tab is unchanged

#### Scenario: The tab bar still navigates away
- **GIVEN** the `MAPPA` tab is active
- **WHEN** the user taps another first-level tab
- **THEN** that tab becomes active
