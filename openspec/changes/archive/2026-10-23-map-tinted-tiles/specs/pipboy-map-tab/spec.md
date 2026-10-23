## MODIFIED Requirements

### Requirement: Fallout-filtered CARTO basemap

The tile layer SHALL use CARTO's label-free dark basemap. Its attribution is specified separately below.

Every tile request SHALL carry the CARTO basemap key as a `key` query parameter. The key SHALL be stamped into the shipped source at image-build time from the `CARTO_BASEMAP_KEY` build argument and SHALL NOT be committed to the repository. When the source is unstamped (the build-time placeholder is still present) or the stamped value is empty, tile URLs SHALL omit the `key` parameter entirely rather than send the placeholder, so the map degrades to the provider's keyless tiles instead of failing.

The basemap SHALL be tinted in the **active phosphor theme's colour** by tinting each tile's pixels once, when the tile loads, through the shared map core's tinted tile layer. No CSS or SVG filter SHALL be applied to the tile pane or its tiles, so panning and zooming only transform already-tinted bitmaps and never re-run the tint per frame. Tile images SHALL be requested as CORS requests (`crossOrigin="anonymous"`) so their pixels can be read.

The tint SHALL map each pixel's luminance through a **tone curve per surface** rather than a single linear gain, and SHALL then tint the result with the theme's RGB colour, desaturated toward its own luminance by a fixed saturation token. The tint SHALL be built from the same RGB triplet that drives `--phosphor-rgb`, applied from the same choke point that applies the theme, so a theme added later tints the map without a separate tuning step.

Water SHALL be separated from land by its colour cast, so its level is set independently of the land's. The basemap SHALL keep this luminance order in every theme: **water below land, land below coastlines and roads, roads below markers**. Water SHALL NOT be the brightest large surface on the map. The levels and the saturation are design tokens of this capability. Each tinted pixel SHALL match the shared core's reference tint function within 2/255 per channel.

A tile SHALL first become visible already tinted: an untinted tile SHALL never be shown. A theme change SHALL re-tint the tiles of an already-mounted map in place, keeping the same tile elements, without remounting the map, without a network request for tiles already loaded, and without showing untinted tiles in between.

Because `pipboy.css:209` (`.pb-screen * { text-shadow: inherit }`) force-inherits the phosphor glow onto every descendant, the tile pane SHALL explicitly reset `text-shadow` so the glow does not smear the tiles. The CRT overlays SHALL continue to render above the map.

#### Scenario: Tiles are tinted per tile, not filtered
- **WHEN** the map tab is mounted and its tiles have loaded
- **THEN** each tile is a canvas whose sampled pixel equals the expected tinted colour for the active theme, and neither the tile pane nor any tile has a computed `filter` other than `none`

#### Scenario: Tile requests are CORS requests
- **WHEN** the map tab requests a basemap tile
- **THEN** the request is made in CORS mode without credentials

#### Scenario: Map tint follows the theme
- **GIVEN** the map tab is mounted under the `VERDE` theme with its tiles loaded
- **WHEN** the user switches the theme to `AMBRA`
- **THEN** the same tile elements are repainted with the amber tint, and the map is not remounted

#### Scenario: Water sits below land
- **GIVEN** any phosphor theme
- **WHEN** the tint's output for the measured water colour and the measured land colour is compared
- **THEN** the water's output luminance is lower than the land's, and both are lower than the output for a road

#### Scenario: A failed tile does not break the tab
- **GIVEN** a tile response cannot be read (network failure or missing CORS permission)
- **WHEN** the map tab loads that tile
- **THEN** the tile stays blank, the other tiles and the markers still render, and the tab does not throw

#### Scenario: Tile requests carry the stamped key
- **GIVEN** the app was built with a non-empty `CARTO_BASEMAP_KEY`
- **WHEN** the map tab requests a basemap tile
- **THEN** the tile URL's query string contains `key=` followed by that value

#### Scenario: Unstamped source sends no key
- **GIVEN** the source still contains the build-time placeholder
- **WHEN** the map tab requests a basemap tile
- **THEN** the tile URL has no `key` query parameter and the placeholder text appears nowhere in it
