# pipboy-map-tab Specification

## Purpose

A `MAPPA` first-level tab on the `apps/pip-boy` character sheet rendering the current campaign's map. Leaflet is vendored for offline use, the CARTO dark basemap is Fallout-filtered, attribution is presented briefly then collapses to Credits, the view is constrained by the campaign config, and level-of-detail, the zone breadcrumb, and marker bloom/collapse animation all follow the map geometry rather than authored thresholds.

## Requirements

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

The tab SHALL display a zone indicator naming the chain of places the viewport is currently inside: the deepest place that is both `APERTA` and `DENTRO`, preceded by its ancestors, separated by `›`. The indicator SHALL be presented as a floating overlay over the top of the map canvas rather than a reserved layout row, so it is available in both normal and immersive modes without reserving vertical space, and SHALL NOT intercept map gestures beneath it.

A place SHALL NOT appear in the breadcrumb unless it is `APERTA`, so the indicator never names a tier that is not being rendered. When the centre is inside no open place, the indicator SHALL show the map's root label, which SHALL be **`Terre contaminate`**. The root label SHALL be shown **only** in that case: it SHALL NOT appear alongside any named level.

The indicator SHALL show at most the **last three** levels of the chain — the three deepest. When the chain is deeper than three, the indicator SHALL lead with an elision marker (`…`) to signal the omitted ancestry.

When two candidate places both contain the centre, the one with the **smallest effective radius** SHALL win. The deepest entry SHALL be emphasised.

The chain SHALL be truncated from the **left** when it exceeds the available width, keeping the deepest entries — where you are matters more than distant ancestry.

#### Scenario: Root label when inside nothing
- **GIVEN** the viewport centre is inside no open place
- **WHEN** the indicator renders
- **THEN** it shows `Terre contaminate` and no other level

#### Scenario: Breadcrumb names the entered chain
- **GIVEN** the viewport is inside a region, inside a vault within it
- **WHEN** the indicator renders
- **THEN** it reads `REGION › VAULT`, with the deepest entry emphasised, and does not include `Terre contaminate`

#### Scenario: Chain deeper than three is elided from the left
- **GIVEN** the viewport is inside four nested open places `A › B › C › D`
- **WHEN** the indicator renders
- **THEN** it shows `… › B › C › D` — the last three levels, led by an elision marker, with `D` emphasised

#### Scenario: Breadcrumb never names an unopened tier
- **GIVEN** the viewport is centred over a room deep inside a vault, but zoomed far out so only zone markers render
- **WHEN** the indicator renders
- **THEN** it shows `Terre contaminate`, not the room's chain

#### Scenario: Breadcrumb follows the centre
- **GIVEN** a zone is open and the viewport is centred inside a vault within it
- **WHEN** the user pans out of the vault but stays within the zone
- **THEN** the breadcrumb drops the vault and names the zone alone

#### Scenario: Overlapping zones resolve to the tighter one
- **GIVEN** the centre lies inside two zones whose circles overlap
- **WHEN** the indicator renders
- **THEN** it names the zone with the smaller effective radius

#### Scenario: Breadcrumb is available in immersive mode
- **GIVEN** the map tab is in immersive mode with the sheet chrome hidden
- **WHEN** the indicator renders
- **THEN** the breadcrumb overlay is visible over the map canvas and still names the entered chain, and a pan or zoom beneath it reaches the map

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

### Requirement: The map tab has an immersive full-screen mode

The `MAPPA` tab SHALL provide an **immersive mode** that expands the Leaflet canvas to fill the entire CRT screen. While immersive, the sheet's surrounding chrome SHALL be hidden: the PA header, the first-level tab bar, the subtab row, the resource band, the footer, and the reserved breadcrumb row. The physical bezel and the CRT overlays (scanline, vignette, sweep) SHALL remain — the map fills the Pip-Boy screen and does not escape the device.

Immersive mode SHALL be **ephemeral view state**: it SHALL default to off whenever the sheet is opened or the tab is re-mounted, and SHALL NOT be persisted.

Ownership of the mode SHALL rest with the sheet shell, which owns the chrome being hidden; the map tab SHALL request entering and leaving immersive mode rather than reaching outside its own container to hide sibling chrome directly.

#### Scenario: Entering immersive expands the map
- **WHEN** the user activates the immersive toggle on the `MAPPA` tab
- **THEN** the PA header, first-level tab bar, subtab row, resource band, footer, and breadcrumb row are hidden and the map canvas fills the CRT screen, with the bezel and CRT overlays still rendered

#### Scenario: Immersive resets on re-mount
- **GIVEN** the map tab is in immersive mode
- **WHEN** the sheet is re-opened or the `MAPPA` tab is re-mounted
- **THEN** the tab renders in normal (non-immersive) mode

### Requirement: Immersive mode is exitable without the tab bar

Because immersive mode hides the first-level tab bar, the `MAPPA` tab SHALL provide its own exit affordances so the user is never trapped: a visible toggle control in the canvas's corner control cluster (alongside the search lens), **and** the `Escape` key. Activating either SHALL leave immersive mode and restore the sheet's normal chrome.

This is a deliberate, scoped exception to the invariant that the first-level tab bar is always visible: the invariant holds in normal mode, and immersive mode substitutes an explicit exit for it.

#### Scenario: Exit via the toggle control
- **GIVEN** the map tab is in immersive mode
- **WHEN** the user activates the immersive toggle control
- **THEN** immersive mode ends and the sheet's normal chrome — including the first-level tab bar — is restored

#### Scenario: Exit via Escape
- **GIVEN** the map tab is in immersive mode
- **WHEN** the user presses `Escape`
- **THEN** immersive mode ends and the sheet's normal chrome is restored

### Requirement: Level of detail is revalidated when the canvas is resized by a mode toggle

Because visibility is a function of viewport size — `vr` (half the viewport's shorter side, in metres) derives from `map.getSize()` — entering or leaving immersive mode changes the visible-place set. On each toggle the tab SHALL call `map.invalidateSize()` so Leaflet re-measures its container, then re-sync the marker set and the breadcrumb to the new viewport radius. When the resize animates, `invalidateSize()` SHALL run against the canvas's **final** size, not an intermediate one.

#### Scenario: Toggling immersive re-syncs the visible markers
- **GIVEN** the map is showing a set of markers at the current zoom
- **WHEN** the user enters immersive mode, enlarging the canvas
- **THEN** Leaflet re-measures the container and the visible marker set and breadcrumb are recomputed for the enlarged viewport, so no stale tiles or off-centre view remain and the level of detail matches the new size

### Requirement: The map surface owns horizontal gestures

Over the map, a horizontal drag SHALL pan the map and SHALL NOT trigger the sheet's swipe navigation. The map container SHALL be exempt from the swipe handler described by `pipboy-sheet-navigation`.

In **normal** mode, leaving the `MAPPA` tab SHALL remain possible via the first-level tab bar, which is visible. In **immersive** mode the first-level tab bar is hidden; leaving immersive mode (via the tab's own exit affordances — the immersive toggle or `Escape`) SHALL restore the tab bar, which then navigates away as usual. The map tab SHALL therefore never leave the user without a way out, in either mode.

#### Scenario: Horizontal drag pans instead of navigating
- **GIVEN** the `MAPPA` tab is active
- **WHEN** the user drags horizontally across the map past the swipe distance threshold
- **THEN** the map pans and the active tab is unchanged

#### Scenario: The tab bar still navigates away
- **GIVEN** the `MAPPA` tab is active in normal mode
- **WHEN** the user taps another first-level tab
- **THEN** that tab becomes active

#### Scenario: Immersive leaves an explicit way out
- **GIVEN** the `MAPPA` tab is in immersive mode, with the first-level tab bar hidden and the map owning horizontal gestures
- **WHEN** the user activates the immersive toggle or presses `Escape`
- **THEN** immersive mode ends, the first-level tab bar is restored, and normal tab navigation is available again

### Requirement: Selecting a marker centres it and opens a description popup

Selecting a rendered place marker — by pointer or keyboard — SHALL centre the map on that place and open a popup naming the place and showing its `desc`. The popup SHALL use the map's existing phosphor popup styling.

The popup SHALL persist only while its place's marker is rendered. When the place becomes `APERTA`, or is panned out of the visible set, its marker is removed and the popup SHALL close with it. Selecting a different marker SHALL move the popup to the new place.

#### Scenario: Tapping a marker opens its description
- **WHEN** the user selects a visible place marker
- **THEN** the map centres on that place and a popup shows the place's name and description

#### Scenario: Popup closes when its place opens
- **GIVEN** a place's popup is open
- **WHEN** the view zooms until that place becomes `APERTA` and its marker is removed
- **THEN** the popup closes

#### Scenario: Popup closes when panned off
- **GIVEN** a place's popup is open
- **WHEN** the user pans until that place leaves the visible set
- **THEN** the popup closes

### Requirement: The popup offers "Vedi mappa" for a place with a local map

The description popup SHALL present a **Vedi mappa** action if and only if the place has a local map — `hasLocalMap` is true and the place has at least one child. A place that cannot open SHALL NOT present the action.

Activating **Vedi mappa** SHALL centre the place and zoom to the **least** zoom at which the place is `APERTA` — the framing at which the place's whole circle just fits the viewport, so its interior is shown in full. The target zoom SHALL be derived from the place's effective radius, not authored, and SHALL be clamped to the campaign's `[minZoom, maxZoom]`.

#### Scenario: A place with an interior offers the action
- **WHEN** the popup opens for a place with `hasLocalMap` and children
- **THEN** it presents a **Vedi mappa** action

#### Scenario: A leaf place does not offer the action
- **WHEN** the popup opens for a place with no local map or no children
- **THEN** it presents no **Vedi mappa** action

#### Scenario: Vedi mappa opens the interior
- **GIVEN** the popup for a place with a local map is open
- **WHEN** the user activates **Vedi mappa**
- **THEN** the map centres on the place and zooms until the place is `APERTA` and its children render, framing its whole interior

### Requirement: A place can be focused, revealing it when hidden

The tab SHALL provide a single focus operation that centres a place and opens its description popup. When the place's marker is **not** currently rendered — because an ancestor is not yet `APERTA` — the operation SHALL first move the view into the zoom window at which the place's marker renders (every ancestor `APERTA`, the place itself not `APERTA`), and open the popup once the marker exists.

Both selecting a marker and selecting a search result SHALL be expressed through this operation, so the two paths reach the same end state.

#### Scenario: Focusing a hidden place reveals it
- **GIVEN** a place whose marker is not currently rendered because its zone is closed
- **WHEN** the place is focused
- **THEN** the view moves until the place's marker renders and its popup opens

#### Scenario: Focus and tap reach the same state
- **GIVEN** a place whose marker is currently rendered
- **WHEN** the place is focused
- **THEN** the resulting centre and open popup match what selecting that marker produces

### Requirement: The map provides name search that focuses the selection

The tab SHALL present a lens control in a corner over the map that toggles a search field with autocomplete. The field SHALL match the typed text against place **names** across the whole set of places the client received, case-insensitively and accent-insensitively. Selecting a result SHALL focus that place.

The search index SHALL be the received set only. Because the API strips non-public places and their subtrees server-side, the search SHALL NOT be able to name a place the client was not sent.

The control SHALL sit within the map's no-swipe region so interacting with it does not leave the tab, and SHALL be dismissible.

#### Scenario: Lens toggles the search field
- **WHEN** the user activates the lens control
- **THEN** a search field with autocomplete appears over the map

#### Scenario: Search matches names accent-insensitively
- **GIVEN** a place named `Città Vecchia`
- **WHEN** the user types `citta`
- **THEN** that place appears in the autocomplete results

#### Scenario: Selecting a result focuses the place
- **GIVEN** the search lists a place whose marker is not currently rendered
- **WHEN** the user selects it
- **THEN** the view reveals the place's marker and opens its popup — the same end state as tapping the marker

#### Scenario: Search cannot surface a non-public place
- **GIVEN** a non-admin session whose map response omitted a non-public place
- **WHEN** the user searches for that place's name
- **THEN** it does not appear in the results

### Requirement: Focus and open zooms are derived, pure, and unit-testable

The zoom for **Vedi mappa** (the least zoom at which a place is `APERTA`) and the zoom for revealing a hidden place's marker (a zoom within the window where every ancestor is `APERTA` and the place is not) SHALL be computed as pure functions of the place's effective radius, the viewport, and the campaign zoom range — with no DOM and no Leaflet instance — matching the existing `isOpen`/`isInside`/`effectiveRadius` predicates so both agree at the boundary they share.

#### Scenario: Contain zoom agrees with the open predicate
- **GIVEN** a place and the zoom returned by the contain-zoom helper
- **WHEN** `isOpen` is evaluated at that zoom
- **THEN** the place is `APERTA`, and at one integer zoom step further out it is not

#### Scenario: A larger zone contains at a lower zoom than a smaller one
- **GIVEN** two places of very different effective radius
- **WHEN** their contain zooms are computed
- **THEN** the larger place's contain zoom is the lower number
