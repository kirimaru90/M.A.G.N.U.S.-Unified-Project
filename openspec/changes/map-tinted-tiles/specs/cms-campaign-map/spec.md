## MODIFIED Requirements

### Requirement: Basemap labels and filter preview are authoring aids only

The map header SHALL offer a labels toggle, switching the CARTO dark basemap between its labelled and label-free variants, and a toggle previewing the Pip-Boy filter.

The basemap SHALL be drawn through the shared map core's tinted tile layer. With the preview off, the layer SHALL draw the tiles untinted, as CARTO serves them. With it on, the layer SHALL tint the tiles with the **VERDE** theme, using the same tint, tone curve and water mask the Pip-Boy uses, so the author sees the default player map. Public markers SHALL then take the Pip-Boy's VERDE marker colours. Toggling the preview SHALL repaint the tiles already on screen in place, without reloading the map. The tint SHALL apply equally over the labelled variant. Neither state SHALL apply a CSS or SVG filter to the tile pane, and the CMS SHALL NOT carry a tint of its own.

Both toggles SHALL be view-local: they SHALL NOT be persisted and SHALL NOT affect what any player sees. The author needs street names to place things; the player must not have them.

#### Scenario: Labels toggle does not persist
- **WHEN** an admin enables basemap labels and saves the map
- **THEN** the saved payload carries no labels setting and the player's map remains label-free

#### Scenario: Preview tints the tiles in VERDE
- **WHEN** an admin enables the filter preview
- **THEN** the tinted tile layer's tint is set to the VERDE triplet from the shared core, and the tile pane has no `filter` style

#### Scenario: Preview off leaves the basemap untinted
- **WHEN** the filter preview is turned off
- **THEN** the tinted tile layer's tint is cleared, and the tile pane has no `filter` style

#### Scenario: Labels and preview combine
- **GIVEN** the filter preview is on
- **WHEN** an admin enables basemap labels
- **THEN** the layer switches to the labelled tile URL and keeps the VERDE tint
