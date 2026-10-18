## ADDED Requirements

### Requirement: The authoring basemap uses the build-stamped CARTO key and a compliant attribution

Every basemap tile URL of the campaign map — both the label-free and the labelled CARTO dark variants — SHALL carry the CARTO basemap key as a `key` query parameter. The key SHALL come from the CMS environment configuration, stamped at image-build time from the `CARTO_BASEMAP_KEY` build argument, and SHALL NOT be committed. When the configured key is empty or still the build-time placeholder, tile URLs SHALL omit the `key` parameter.

The map SHALL keep Leaflet's attribution control, which is permanently visible, and its basemap attribution SHALL read `© OpenStreetMap contributors, © CARTO`, with "OpenStreetMap contributors" linking to `https://www.openstreetmap.org/copyright` and "CARTO" linking to `https://carto.com/attribution`. Toggling the labels aid SHALL NOT remove or change the attribution.

#### Scenario: Both basemap variants carry the key
- **GIVEN** a non-empty key is configured
- **WHEN** the tile URL is built for the label-free and for the labelled variant
- **THEN** each ends with `?key=` followed by that value

#### Scenario: No key configured
- **GIVEN** the configured key is empty or the build-time placeholder
- **WHEN** a tile URL is built
- **THEN** it has no `key` query parameter

#### Scenario: Attribution names and links both sources
- **WHEN** the campaign map is shown
- **THEN** the attribution control contains "OpenStreetMap contributors" linked to the OSM copyright page and "CARTO" linked to CARTO's attribution page

#### Scenario: Labels toggle keeps the attribution
- **WHEN** the admin toggles basemap labels on and off
- **THEN** the attribution control still shows the same linked credit
