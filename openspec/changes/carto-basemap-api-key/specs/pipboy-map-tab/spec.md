## MODIFIED Requirements

### Requirement: Fallout-filtered CARTO basemap

The tile layer SHALL use CARTO's label-free dark basemap. Its attribution is specified separately below.

Every tile request SHALL carry the CARTO basemap key as a `key` query parameter. The key SHALL be stamped into the shipped source at image-build time from the `CARTO_BASEMAP_KEY` build argument and SHALL NOT be committed to the repository. When the source is unstamped (the build-time placeholder is still present) or the stamped value is empty, tile URLs SHALL omit the `key` parameter entirely rather than send the placeholder, so the map degrades to the provider's keyless tiles instead of failing.

The tile pane SHALL be filtered with exactly:

```css
filter: grayscale(1) invert(0) sepia(1) hue-rotate(90deg) saturate(8) brightness(2) contrast(1);
```

These values are a design token of this capability, not a tuning parameter.

Because `pipboy.css:209` (`.pb-screen * { text-shadow: inherit }`) force-inherits the phosphor glow onto every descendant, the tile pane SHALL explicitly reset `text-shadow` so the glow does not smear the tiles. The CRT overlays SHALL continue to render above the map.

#### Scenario: Tiles are filtered
- **WHEN** the computed style of `.leaflet-tile-pane` is inspected
- **THEN** it carries the specified filter chain

#### Scenario: Tile requests carry the stamped key
- **GIVEN** the app was built with a non-empty `CARTO_BASEMAP_KEY`
- **WHEN** the map tab requests a basemap tile
- **THEN** the tile URL's query string contains `key=` followed by that value

#### Scenario: Unstamped source sends no key
- **GIVEN** the source still contains the build-time placeholder
- **WHEN** the map tab requests a basemap tile
- **THEN** the tile URL has no `key` query parameter and the placeholder text appears nowhere in it

## REMOVED Requirements

### Requirement: Basemap attribution shows briefly, then collapses to Credits
**Reason**: With a CARTO basemap key the CARTO Basemaps Terms apply, and they require the credit to be "visible on the map itself … Not hidden, faded or behind a click"; CARTO may suspend a key on maps without the credit. A fixed five-second collapse can therefore no longer be the only behaviour. It is kept, but as an opt-in mode rather than the default.
**Migration**: Replaced by "Basemap attribution is linked, permanent by default, and can be switched to a timed collapse" below. Reverting to the previous five-second behaviour is a one-constant change (`ATTRIBUTION_COLLAPSE_MS = 5000`). The `CREDITI` view is unchanged and remains the always-reachable full attribution (see `pipboy-settings`).

## ADDED Requirements

### Requirement: Basemap attribution is linked, permanent by default, and can be switched to a timed collapse

Leaflet's built-in attribution control SHALL remain disabled (`attributionControl: false`); its "Leaflet" prefix is not required on screen, since Leaflet's BSD-2 notice is retained in the vendored source.

Instead the map SHALL render its own attribution line, in the map's phosphor styling, in a corner of the map canvas, reading `© OpenStreetMap contributors, © CARTO`. "OpenStreetMap contributors" SHALL be a link to `https://www.openstreetmap.org/copyright` and "CARTO" a link to `https://carto.com/attribution`; both SHALL open outside the app (new browsing context, `rel="noopener"`). The line SHALL be legible against the filtered tiles.

The line's lifetime SHALL be governed by a single exported configuration constant, `ATTRIBUTION_COLLAPSE_MS`, in the Pip-Boy basemap module — the one place an operator changes to switch modes:

- **`null` (the shipped default) — permanent mode.** The line SHALL be present for the entire time the map is displayed: it SHALL NOT collapse on a timer, fade out, or be hidden by pan, zoom, or immersive mode. This is the mode that meets the CARTO Basemaps Terms.
- **A positive number of milliseconds — collapse mode.** On entering the `MAPPA` tab the line SHALL be shown and SHALL be removed automatically after that many milliseconds; it SHALL NOT reappear on pan or zoom within the same visit, and SHALL be presented again on each new visit to the tab. `5000` reproduces the previous behaviour, which follows the OSM Foundation's Attribution Guidelines ("automatically after five seconds") but **not** the CARTO Basemaps Terms; the constant's comment SHALL say so.

The mode is an operator/deploy decision, not a player preference: it SHALL NOT appear in the settings popup and SHALL NOT be persisted per user. A test-only global override (as the previous `__PB_MAP_ATTRIBUTION_MS__`) MAY replace the constant so both modes are testable in one build.

In both modes the full attribution SHALL remain reachable at any time from the `CREDITI` entry of the settings popup.

The line SHALL NOT block map interaction outside its links: a pan or zoom gesture beginning on the line's non-link area SHALL reach the map.

#### Scenario: Attribution is present on entering the tab
- **WHEN** the user selects the `MAPPA` tab
- **THEN** a line containing "OpenStreetMap contributors" and "CARTO" is visible over the map

#### Scenario: Default mode does not collapse
- **GIVEN** `ATTRIBUTION_COLLAPSE_MS` is `null`
- **WHEN** more than five seconds pass and the user pans and zooms
- **THEN** the attribution line is still visible

#### Scenario: Default mode survives immersive mode
- **GIVEN** `ATTRIBUTION_COLLAPSE_MS` is `null`
- **WHEN** the user enters the map's immersive full-screen mode
- **THEN** the attribution line is visible over the enlarged map

#### Scenario: Collapse mode removes the line after the configured delay
- **GIVEN** `ATTRIBUTION_COLLAPSE_MS` is a positive delay
- **WHEN** that delay elapses after entering the tab
- **THEN** the attribution line is no longer displayed, and it does not reappear on pan or zoom

#### Scenario: Collapse mode presents the line again on re-entry
- **GIVEN** `ATTRIBUTION_COLLAPSE_MS` is a positive delay and the line has collapsed
- **WHEN** the user leaves and re-enters the `MAPPA` tab
- **THEN** the attribution line is visible again

#### Scenario: Credits stay reachable in either mode
- **WHEN** the user opens the settings popup and selects `CREDITI`
- **THEN** the OpenStreetMap and CARTO attribution is shown in full

#### Scenario: Both names are linked
- **WHEN** the attribution line is inspected
- **THEN** "OpenStreetMap contributors" links to `https://www.openstreetmap.org/copyright` and "CARTO" links to `https://carto.com/attribution`, each with `target="_blank"` and `rel` containing `noopener`

#### Scenario: Leaflet's own control is never rendered
- **WHEN** the map is open, before and after a zoom
- **THEN** no `.leaflet-control-attribution` element exists

#### Scenario: Attribution does not obstruct the map
- **WHEN** the user starts a pan on the attribution line outside its links
- **THEN** the gesture reaches the map and the view moves
