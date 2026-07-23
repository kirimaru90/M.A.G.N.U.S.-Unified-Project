## MODIFIED Requirements

### Requirement: Three-class request handling — app shell, map tiles, authenticated API

Apart from basemap tiles, `apps/pip-boy` has no anonymous or public content: every API call (including the catalog reads) requires an authenticated session. The service worker's `fetch` handler SHALL classify every request into one of three classes:

1. **App shell** — same-origin GET requests for the precached shell.
2. **Map tiles** — GET requests to the basemap tile host used by `pipboy-map-tab`.
3. **Authenticated API** — every other request, regardless of method, path, or headers.

Authenticated-API requests SHALL always be fetched network-only (no-store) and SHALL NEVER be written to any cache. The service worker SHALL determine the API origin from its own registration URL query string (`sw.js?api=<origin>`), matching the mechanism already used by the terminal emulator, so classification works whether the API is same-origin or cross-origin.

**Map tiles** SHALL be served cache-first and written to a **separate, non-shell** tile cache as they are fetched — cache-on-visit. Tiles SHALL NOT be pre-seeded on install: bulk-downloading a region violates the basemap provider's terms, whereas retaining tiles a user actually browsed does not. Because `pipboy-map-tab` constrains zoom and pan bounds, the reachable tile set is finite, so a map the player has visited keeps working offline. A tile request that misses both cache and network SHALL fail quietly, leaving the marker layer rendered over empty tiles rather than breaking the tab.

The tile cache SHALL be bounded by a maximum entry count. When writing a newly-fetched tile would leave the cache over that cap, the service worker SHALL evict entries in oldest-first (insertion) order until the cache is back at or under a lower watermark below the cap, rather than evicting exactly down to the cap on every write. Eviction SHALL be based on insertion order only (evict-oldest), not recency of last access — a cache hit SHALL NOT rewrite or reorder its entry.

Tiles carry no session data, so the tile cache SHALL survive logout — see the flush requirement below.

#### Scenario: Shell asset served from cache
- **WHEN** the page requests a precached shell asset
- **THEN** the service worker serves it from the versioned shell cache

#### Scenario: API request never cached
- **WHEN** the page issues any request to the API origin
- **THEN** the service worker fetches it network-only and does not write the response to any cache, regardless of whether the request succeeds or fails

#### Scenario: Tile is cached on first visit and reused
- **WHEN** the map tab fetches a basemap tile that is not yet cached
- **THEN** the service worker fetches it from the network and writes it to the tile cache, and a later request for the same tile is served from that cache

#### Scenario: Tiles are not treated as API traffic
- **WHEN** the map tab requests a basemap tile
- **THEN** the service worker does not classify it as an authenticated-API request and does not fetch it no-store

#### Scenario: Offline map degrades quietly
- **GIVEN** the app is offline and a tile is not in the tile cache
- **WHEN** the map tab requests it
- **THEN** the request fails without breaking the tab, and the markers still render over empty tiles

#### Scenario: Tile cache stays bounded past its cap
- **GIVEN** the tile cache holds a number of entries at its maximum cap
- **WHEN** another tile that is not yet cached is fetched and written to the cache
- **THEN** the oldest cached tiles are evicted until the cache is back at or under the lower watermark, and the newly-fetched tile is present

#### Scenario: A cache hit does not affect eviction order
- **GIVEN** a tile already sits in the tile cache
- **WHEN** that same tile is requested again and served from cache
- **THEN** its position in the cache's insertion order is unchanged, so it is no less likely to be evicted next than before the hit

## ADDED Requirements

### Requirement: Tile cache version purge on deploy

The tile cache's name SHALL be a versioned constant, distinct from the shell cache's version, so that a deploy which changes the tile cache's bound or eviction behavior can force every previously-accumulated tile cache to be discarded. On `activate`, the existing cache sweep (which already removes any cache not matching the current shell cache or the current tile cache) SHALL treat a previous tile-cache version as non-current and delete it, exactly as it does for a previous shell-cache version.

#### Scenario: A tile-cache version bump purges the previous tile cache
- **GIVEN** an installed client holds a tile cache under a previous version name
- **WHEN** a new service worker declaring a new tile-cache version activates
- **THEN** the previous tile cache is deleted during `activate`, leaving only the current tile cache and the current shell cache
