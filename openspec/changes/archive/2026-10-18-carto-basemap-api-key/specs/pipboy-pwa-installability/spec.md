## ADDED Requirements

### Requirement: A change to the tile URL scheme purges the tile cache

Map-tile classification SHALL depend on the request's host only, so a tile URL carrying a `key` query parameter SHALL still be classified, cached, and served as a map tile.

Whenever the basemap tile URL scheme changes in a way that makes previously cached tiles wrong (for example, keyless watermarked placeholders replaced by keyed tiles), the tile cache's versioned name SHALL be bumped in the same change, so the existing "Tile cache version purge on deploy" sweep deletes the stale tiles on activation. The introduction of the CARTO basemap key SHALL bump the tile cache from `pipboy-tiles-v2` to `pipboy-tiles-v3`.

#### Scenario: A keyed tile request is a map tile
- **WHEN** the map tab requests a tile from the basemap host with a `key` query parameter
- **THEN** the service worker serves it cache-first and writes it to the tile cache, not the shell cache, and does not treat it as API traffic

#### Scenario: Watermarked tiles from before the key are purged
- **GIVEN** an installed client holds a `pipboy-tiles-v2` cache filled before the key was introduced
- **WHEN** the service worker declaring `pipboy-tiles-v3` activates
- **THEN** `pipboy-tiles-v2` is deleted and only `pipboy-tiles-v3` and the current shell cache remain
