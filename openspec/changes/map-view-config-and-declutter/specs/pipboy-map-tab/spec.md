## MODIFIED Requirements

### Requirement: Fallout-filtered CARTO basemap

The tile layer SHALL use CARTO's label-free dark basemap. Its attribution is specified separately below.

Every tile request SHALL carry the CARTO basemap key as a `key` query parameter. The key SHALL be stamped into the shipped source at image-build time from the `CARTO_BASEMAP_KEY` build argument and SHALL NOT be committed to the repository. When the source is unstamped (the build-time placeholder is still present) or the stamped value is empty, tile URLs SHALL omit the `key` parameter entirely rather than send the placeholder, so the map degrades to the provider's keyless tiles instead of failing.

The tile pane SHALL be tinted in the **active phosphor theme's colour** by an SVG filter referenced from CSS (`filter: url(#<id>)`), not by a fixed CSS filter chain. The filter SHALL be a `feColorMatrix` that maps each pixel's luminance onto the theme's RGB colour, scaled by a single fixed gain, so the dark basemap reads as glowing phosphor of that colour. The matrix SHALL be generated from the same RGB triplet that drives `--phosphor-rgb`, in the same choke point that applies the theme, so a theme added later tints the map without a separate tuning step. The gain is a design token of this capability, chosen so the green theme matches the look of the previous fixed chain.

The filter definition SHALL be present in the document whenever the map tab is mounted, and a theme change SHALL re-tint an already-mounted map without remounting it.

Because `pipboy.css:209` (`.pb-screen * { text-shadow: inherit }`) force-inherits the phosphor glow onto every descendant, the tile pane SHALL explicitly reset `text-shadow` so the glow does not smear the tiles. The CRT overlays SHALL continue to render above the map.

#### Scenario: Tiles are filtered by the theme filter
- **WHEN** the computed style of `.leaflet-tile-pane` is inspected
- **THEN** its `filter` references the SVG phosphor filter by id, and that filter element exists in the document

#### Scenario: Map tint follows the theme
- **GIVEN** the map tab is mounted under the `VERDE` theme
- **WHEN** the user switches the theme to `AMBRA`
- **THEN** the SVG filter's colour matrix changes to the amber triplet and the map is not remounted

#### Scenario: Tile requests carry the stamped key
- **GIVEN** the app was built with a non-empty `CARTO_BASEMAP_KEY`
- **WHEN** the map tab requests a basemap tile
- **THEN** the tile URL's query string contains `key=` followed by that value

#### Scenario: Unstamped source sends no key
- **GIVEN** the source still contains the build-time placeholder
- **WHEN** the map tab requests a basemap tile
- **THEN** the tile URL has no `key` query parameter and the placeholder text appears nowhere in it

### Requirement: Map view is constrained by the campaign config

The map SHALL honour the campaign's `minZoom`, `maxZoom`, and `bounds`. A pan that would leave the configured bounds SHALL be resisted, and zoom SHALL be clamped to the configured range.

The **effective** minimum zoom SHALL be the greater of `config.minZoom` and the zoom at which the configured bounds fit the current viewport, so the player cannot zoom out to a view wider than the bounds. Because that zoom depends on the canvas size, the effective minimum SHALL be recomputed whenever the canvas is resized (window resize or immersive toggle), and a current zoom below the new minimum SHALL be raised to it. The effective minimum SHALL never exceed `config.maxZoom`.

Derived zooms (focus, reveal, open, separate) SHALL be clamped to the effective range, not the raw config range.

#### Scenario: Pan is bounded
- **WHEN** the user drags beyond the configured bounds
- **THEN** the view is constrained back inside them

#### Scenario: Zoom is clamped
- **WHEN** the user attempts to zoom past the configured maximum
- **THEN** the zoom does not exceed it

#### Scenario: A non-default range is honoured
- **GIVEN** a campaign whose config sets `minZoom` 8 and `maxZoom` 12
- **WHEN** the user attempts to zoom to 5 and then to 15
- **THEN** the zoom stops at 8 and at 12 respectively

#### Scenario: Zoom out stops at the bounds
- **GIVEN** bounds that fit the viewport at zoom 7 and `config.minZoom` 3
- **WHEN** the user zooms out as far as possible
- **THEN** the zoom does not go below 7

#### Scenario: Entering immersive raises the minimum with the canvas
- **GIVEN** the map is at the effective minimum zoom
- **WHEN** the canvas grows by entering immersive mode
- **THEN** the effective minimum is recomputed against the new size and the zoom is raised if it now lies below it

## ADDED Requirements

### Requirement: Colliding markers are decluttered by type priority

After the level-of-detail rule selects the visible places, markers whose on-screen icon boxes (each 26 px square, plus a fixed padding) would intersect at the current zoom SHALL be resolved so that no two rendered markers overlap.

Resolution SHALL be greedy over the visible places in priority order. The type priority, highest first, SHALL be:

```
1  region
2  settlement = vault
3  landmark   = poi
4  building
5  room
```

Ties within a rank SHALL be broken by larger effective radius, then by name, then by slug, so the outcome is deterministic. Each place in order SHALL be **placed** if its box intersects no already-placed box; otherwise it SHALL be **absorbed** by the highest-priority placed marker it intersects. An absorbed place SHALL NOT render a marker.

A place targeted by focus (marker tap, search, or the codex's MAPPA) SHALL be placed first, ahead of priority, for as long as its popup is open, so a focused place is never hidden by the declutter.

Collision SHALL be computed in projected pixel space at the zoom being shown. It therefore depends on zoom and canvas size only, never on the centre: panning SHALL NOT change which markers are absorbed. The declutter SHALL be recomputed on the same events that recompute level of detail: against the destination zoom at the start of a zoom transition, at its end, and after a canvas resize.

The declutter SHALL be a pure function of the visible places, their projected positions, priority, and the focused slug, with no DOM or Leaflet dependency, so it is unit-testable.

#### Scenario: Overlapping top-level places collapse into the higher-priority one
- **GIVEN** a settlement and a poi, both top-level, whose icons overlap at the current zoom
- **WHEN** the map renders
- **THEN** only the settlement's marker renders and the poi is absorbed by it

#### Scenario: Ties are deterministic
- **GIVEN** two overlapping landmarks of equal effective radius
- **WHEN** the map renders repeatedly
- **THEN** the same one, the first by name, is placed every time

#### Scenario: Zooming in releases absorbed places
- **GIVEN** a poi absorbed by a settlement
- **WHEN** the user zooms in until their icons no longer overlap
- **THEN** the poi's marker renders again

#### Scenario: Panning does not change absorption
- **WHEN** the user pans without changing zoom
- **THEN** the set of placed and absorbed markers is unchanged

#### Scenario: A searched place is never hidden by the declutter
- **GIVEN** a poi that would be absorbed by a nearby settlement at its reveal zoom
- **WHEN** the user selects the poi from search
- **THEN** the poi's marker renders with its popup open, and the settlement is the one treated as colliding

### Requirement: An absorbing marker shows a count and leads to the hidden places

A placed marker that has absorbed one or more places SHALL display a badge reading `+N`, where N is the number of places it absorbed. The badge SHALL be part of the marker and SHALL move with it.

The absorbing marker's popup SHALL include, below its description, a line **"Nelle vicinanze:"** followed by the absorbed places' names in priority order.

Activating the badge SHALL centre the map on the absorbed group (the absorbing place and its absorbed places) and zoom to the **least integer zoom greater than the current one at which no two members of the group collide**. This is derived from the group's closest pair of members: each zoom step doubles projected distances, so the target is `current + ceil(log2(threshold / closest pair distance))`. The target SHALL be clamped to the effective zoom range. A group that cannot be separated within the range, such as places at identical coordinates, SHALL zoom to the effective maximum. Activating the badge SHALL NOT open the popup.

When the absorption set changes during a zoom transition, an absorbed place SHALL collapse into its absorbing marker, and a released place SHALL bloom out of it. Both SHALL use the existing bloom/collapse animation, duration and curve.

#### Scenario: Badge counts the absorbed places
- **GIVEN** a settlement that absorbs two pois
- **WHEN** the map renders
- **THEN** the settlement's marker shows a `+2` badge

#### Scenario: Popup lists the nearby hidden places
- **WHEN** the user taps a marker that shows a `+2` badge
- **THEN** its popup shows "Nelle vicinanze:" followed by the two absorbed names

#### Scenario: Tapping the badge separates the group
- **WHEN** the user taps a marker's `+N` badge
- **THEN** the map zooms in to the least zoom at which the group's markers no longer overlap, and every member renders its own marker

#### Scenario: An inseparable group stops at the maximum zoom
- **GIVEN** two places at identical coordinates
- **WHEN** the user taps the badge
- **THEN** the map zooms to the effective maximum zoom and does not exceed it

#### Scenario: Absorption animates like a zone collapse
- **WHEN** a zoom-out causes a poi to be absorbed by a settlement
- **THEN** the poi's icon animates into the settlement's icon over 800 ms with the shared easing curve

### Requirement: Colliding labels are hidden, icons are kept

After markers are placed, a second pass SHALL resolve label collisions. Each placed marker's label box (its rendered name beneath the icon) SHALL be tested in the same priority order against every placed icon box and every already-shown label box. A label that would intersect any of them SHALL be hidden, while its icon remains rendered and interactive.

The label pass SHALL be recomputed whenever the marker declutter is. A hidden label's name SHALL remain reachable through the marker's popup and through search.

#### Scenario: A lower-priority label yields
- **GIVEN** two placed markers whose icons do not overlap but whose labels do
- **WHEN** the map renders
- **THEN** the higher-priority marker's label shows, the lower-priority marker's label is hidden, and both icons render

#### Scenario: A label overlapping another icon yields
- **GIVEN** a marker whose label would cover a neighbouring icon
- **WHEN** the map renders
- **THEN** that label is hidden

### Requirement: Markers contrast with the map's phosphor colour

Map markers — their icons, labels and `+N` badges — SHALL be drawn in a **marker colour** that contrasts with the theme-tinted basemap. The marker colour SHALL be a per-theme token, exposed as `--map-marker-rgb` and set at the same choke point as `--phosphor-rgb`:

| Theme  | Basemap | Markers |
|--------|---------|---------|
| VERDE  | green   | amber   |
| AMBRA  | amber   | green   |
| BIANCO | white   | green   |

The marker glow SHALL use the marker colour. Popup, breadcrumb, search and the immersive toggle SHALL remain in the theme's phosphor colour. A theme change SHALL recolour already-rendered markers without remounting the map.

#### Scenario: Green theme draws amber markers
- **GIVEN** the `VERDE` theme
- **WHEN** a marker's computed icon stroke colour is inspected
- **THEN** it is the amber triplet

#### Scenario: Amber and white themes draw green markers
- **GIVEN** the `AMBRA` or the `BIANCO` theme
- **WHEN** a marker's computed icon stroke colour is inspected
- **THEN** it is the green triplet

#### Scenario: Popup keeps the theme colour
- **GIVEN** the `VERDE` theme
- **WHEN** a marker's popup is open
- **THEN** the popup text is in the green phosphor colour, not the marker colour
