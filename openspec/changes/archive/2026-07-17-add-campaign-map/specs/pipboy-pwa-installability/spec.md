# pipboy-pwa-installability Specification (delta)

## RENAMED Requirements

- FROM: `### Requirement: Two-class request handling — app shell vs. authenticated API`
- TO: `### Requirement: Three-class request handling — app shell, map tiles, authenticated API`

## MODIFIED Requirements

### Requirement: Service worker pre-caches the application shell

A service worker (`sw.js`) SHALL be served at the project root and registered on page load with a versioned cache name. On `install`, it SHALL pre-cache the required shell: `index.html`, `manifest.webmanifest`, the icon set, the stylesheet(s), the JavaScript modules under `src/`, and the vendored third-party assets under `src/vendor/` — including the vendored Leaflet module and its stylesheet, without which the map tab cannot render offline. A missing optional asset (if any are designated optional) SHALL NOT fail the install; every required shell asset SHALL actually be served at HTTP 200.

Because the shell list enumerates module paths explicitly, every new module under `src/` — including `src/tabs/map.js` and `src/api/campaign-map.js` — SHALL be added to it, or the app's offline install is silently incomplete.

#### Scenario: Install populates the shell cache
- **WHEN** the service worker installs
- **THEN** `sw.js` registers with scope `./` and its `install` step populates the versioned cache with the full required shell set

#### Scenario: Vendored Leaflet is part of the shell
- **WHEN** the service worker installs
- **THEN** the vendored Leaflet module and stylesheet under `src/vendor/` are present in the versioned shell cache

### Requirement: Three-class request handling — app shell, map tiles, authenticated API

Apart from basemap tiles, `apps/pip-boy` has no anonymous or public content: every API call (including the catalog reads) requires an authenticated session. The service worker's `fetch` handler SHALL classify every request into one of three classes:

1. **App shell** — same-origin GET requests for the precached shell.
2. **Map tiles** — GET requests to the basemap tile host used by `pipboy-map-tab`.
3. **Authenticated API** — every other request, regardless of method, path, or headers.

Authenticated-API requests SHALL always be fetched network-only (no-store) and SHALL NEVER be written to any cache. The service worker SHALL determine the API origin from its own registration URL query string (`sw.js?api=<origin>`), matching the mechanism already used by the terminal emulator, so classification works whether the API is same-origin or cross-origin.

**Map tiles** SHALL be served cache-first and written to a **separate, non-shell** tile cache as they are fetched — cache-on-visit. Tiles SHALL NOT be pre-seeded on install: bulk-downloading a region violates the basemap provider's terms, whereas retaining tiles a user actually browsed does not. Because `pipboy-map-tab` constrains zoom and pan bounds, the reachable tile set is finite, so a map the player has visited keeps working offline. A tile request that misses both cache and network SHALL fail quietly, leaving the marker layer rendered over empty tiles rather than breaking the tab.

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

### Requirement: Logout flushes non-shell caches

On logout, the client SHALL instruct the service worker (via `postMessage`) to delete every cache except the current versioned shell cache **and the map tile cache**. Basemap tiles are public, session-independent third-party assets carrying no player or campaign data; discarding them on logout would force a full re-download on the next login for no privacy benefit. Every other non-shell cache SHALL still be deleted, after clearing the local session credential.

#### Scenario: Logout flushes caches but keeps shell and tiles
- **WHEN** the user logs out
- **THEN** the client posts a flush message to the controlling service worker, which deletes any non-shell cache other than the tile cache, while leaving the shell cache intact

#### Scenario: Tile cache survives logout
- **GIVEN** the tile cache holds basemap tiles from a previous session
- **WHEN** the user logs out and logs back in
- **THEN** those tiles are still served from the tile cache without re-downloading
