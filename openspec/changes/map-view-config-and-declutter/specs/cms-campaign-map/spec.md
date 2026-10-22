## ADDED Requirements

### Requirement: The editor opens on the campaign's start view

When a campaign's map document has loaded, the interactive map SHALL be framed on that document's `config.startLat`, `config.startLng` and `config.startZoom` — the same view the Pip-Boy opens on — regardless of whether the Leaflet instance was constructed before or after the load resolved. The re-frame SHALL happen once per load (initial load, campaign switch, or "Annulla" reload); subsequent edits to the config fields during authoring SHALL NOT move the view.

#### Scenario: Map is constructed before the load resolves
- **GIVEN** the map container is present and Leaflet is constructed while the map request is still in flight
- **WHEN** the request resolves with a config whose start view differs from the default
- **THEN** the map's centre and zoom equal the loaded `startLat`, `startLng` and `startZoom`

#### Scenario: Editing the start fields does not move the view
- **GIVEN** the map has loaded and is framed on the start view
- **WHEN** the admin types a new value into the start latitude, longitude or zoom field
- **THEN** the map view does not change until the admin reloads or switches campaign

#### Scenario: Switching campaign re-frames on the new start view
- **WHEN** the admin selects a different campaign and its map loads
- **THEN** the map is framed on that campaign's start view

### Requirement: Zoom-range fields are labelled by direction and validated

The zoom-range fields SHALL be labelled by the direction they limit, not by the raw number: the `minZoom` field SHALL read **"Zoom minimo (più lontano)"** and the `maxZoom` field **"Zoom massimo (più vicino)"**, so an author can tell which field limits zooming out.

The form SHALL flag as invalid — and SHALL NOT allow saving — a config in which `minZoom > maxZoom` or `startZoom` lies outside `[minZoom, maxZoom]`, with an Italian message naming the conflicting field.

#### Scenario: Fields carry directional labels
- **WHEN** the configuration card is expanded
- **THEN** the `minZoom` field is labelled "Zoom minimo (più lontano)" and the `maxZoom` field "Zoom massimo (più vicino)"

#### Scenario: Start zoom out of range blocks saving
- **GIVEN** `minZoom` is 8 and `maxZoom` is 16
- **WHEN** the admin sets the start zoom to 6
- **THEN** the form shows an Italian validation message and the save action is disabled
