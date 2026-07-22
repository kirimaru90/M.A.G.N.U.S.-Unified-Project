## ADDED Requirements

### Requirement: Manual map-cache clear action in the settings popup

The settings popup SHALL present a `SVUOTA CACHE MAPPA` action, in the same action area as the existing update-check control. It is an action, not a preference: it is not a pick-one control and it persists nothing.

Activating it SHALL instruct the controlling service worker (via `postMessage`) to delete the map tile cache immediately, independent of any deploy or version change. This gives the user a way to reclaim tile-cache storage on demand, without waiting for the automatic version-bump purge that only runs when the service worker itself updates.

Clearing the tile cache this way SHALL NOT affect the shell cache, the current session, or any preference. A subsequent map view SHALL re-fetch tiles from the network as they are panned to, exactly as it would for a tile that was never cached.

#### Scenario: Manual clear action is present in the settings popup
- **WHEN** the settings popup is opened
- **THEN** a `SVUOTA CACHE MAPPA` action is present in the popup's action area

#### Scenario: Activating the action clears the tile cache
- **GIVEN** the tile cache holds previously-fetched basemap tiles
- **WHEN** the user activates `SVUOTA CACHE MAPPA`
- **THEN** the service worker deletes the tile cache, and the shell cache and current session are unaffected

#### Scenario: Map tiles re-fetch after a manual clear
- **GIVEN** the user has just activated `SVUOTA CACHE MAPPA`
- **WHEN** the map tab is opened and panned
- **THEN** tiles are fetched from the network and re-cached as if visited for the first time
