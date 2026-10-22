## MODIFIED Requirements

### Requirement: Color preference selects the phosphor theme

The `COLORE` row SHALL offer exactly three options — `VERDE` (default), `AMBRA`, and `BIANCO` —
and SHALL be applied by setting the app's phosphor color theme, consistent with the token
requirements specified by `pipboy-terminal-chrome`. The choice SHALL be local to the pip-boy app:
it SHALL NOT be read from, written to, or synchronized with any other app's preferences, and SHALL
NOT be sent to the server.

Applying a theme SHALL also set the map's theme-derived tokens defined by `pipboy-map-tab` — the
basemap tint filter and the contrasting map-marker colour — in the same step, so an open `MAPPA`
tab is re-tinted immediately.

#### Scenario: Selecting amber applies the amber theme
- **WHEN** the user selects `AMBRA` in the `COLORE` row
- **THEN** the app's phosphor theme switches to amber immediately, with no confirm step

#### Scenario: Selecting white applies the white theme
- **WHEN** the user selects `BIANCO` in the `COLORE` row
- **THEN** the app's phosphor theme switches to white immediately, with no confirm step

#### Scenario: The color choice re-tints an open map
- **GIVEN** the `MAPPA` tab is mounted under `VERDE`
- **WHEN** the user selects `AMBRA` in the `COLORE` row
- **THEN** the basemap is tinted amber and the map markers turn green, without the map remounting

#### Scenario: The color choice is not shared with other apps
- **GIVEN** the user has set a phosphor color preference in the terminal app
- **WHEN** the user opens the pip-boy app for the first time
- **THEN** the pip-boy `COLORE` row shows the default `VERDE`, unaffected by the terminal app's
  preference
