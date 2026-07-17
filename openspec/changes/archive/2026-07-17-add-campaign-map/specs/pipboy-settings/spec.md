# pipboy-settings Specification (delta)

## ADDED Requirements

### Requirement: Credits entry in the settings popup

The settings popup SHALL present a `CREDITI` action, rendered **below** its four preference rows and visually distinct from them. It is an action, not a preference: it is not a pick-one control, it persists nothing, and it does not affect the four-row requirement.

Activating it SHALL open a credits view showing the third-party attribution the app owes, in the app's existing popup treatment, dismissible back to the settings popup or closed outright.

The credits view SHALL name, at minimum, the **basemap providers** used by `pipboy-map-tab` — OpenStreetMap and CARTO — because that attribution is a licence condition on the tiles rather than a courtesy. It SHALL also name the **vendored map library**, since the app disables that library's own on-screen attribution prefix and this becomes the only place it is acknowledged.

Reachability is bounded by the settings popup's own rules: it is available only while a character sheet is mounted. That is sufficient, because the map that incurs the attribution is itself a tab of that sheet — a user who can see the map can always reach the credits.

#### Scenario: Credits action renders below the preference rows
- **WHEN** the settings popup is opened
- **THEN** a `CREDITI` action is present below the four preference rows, visually distinct from them

#### Scenario: Credits is not a preference
- **WHEN** the user activates `CREDITI`
- **THEN** no preference changes and nothing is persisted

#### Scenario: Credits names the basemap providers
- **WHEN** the user activates `CREDITI`
- **THEN** the view names OpenStreetMap and CARTO as the basemap sources

#### Scenario: Credits names the vendored map library
- **WHEN** the user activates `CREDITI`
- **THEN** the view names the vendored map library, whose own on-screen attribution the app suppresses

#### Scenario: Credits closes back to the popup
- **GIVEN** the credits view is open
- **WHEN** the user dismisses it
- **THEN** they are returned to the settings popup, or the popup is closed, and no preference has changed
