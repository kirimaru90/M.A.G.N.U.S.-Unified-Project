## MODIFIED Requirements

### Requirement: Service worker pre-caches the application shell

A service worker (`sw.js`) SHALL be served at the project root and registered on page load with a versioned cache name. On `install`, it SHALL pre-cache the required shell: `index.html`, `manifest.webmanifest`, the icon set, the stylesheet(s), the JavaScript modules under `src/`, and the vendored third-party assets under `src/vendor/` — including the vendored Leaflet module and its stylesheet, without which the map tab cannot render offline. A missing optional asset (if any are designated optional) SHALL NOT fail the install; every required shell asset SHALL actually be served at HTTP 200.

Because the shell list enumerates module paths explicitly, every new module under `src/` — including `src/tabs/map.js` and `src/api/campaign-map.js` — SHALL be added to it, or the app's offline install is silently incomplete.

Every `install`-time fetch for a shell URL SHALL be issued in a way that bypasses the browser's own HTTP cache (e.g. a `Request` constructed with `cache: 'reload'`), so that the versioned cache being populated can never be stocked with a stale response the browser happened to already hold for that URL. Without this, a deploy that changes a shell file's content can still leave an installed client running old code under a correctly-updated cache name — the cache-version bump alone is not sufficient, because it is `cache.addAll`/`cache.add`'s underlying `fetch()` calls, not the cache name, that determine whether the content is fresh.

#### Scenario: Install populates the shell cache

- **WHEN** the service worker installs
- **THEN** `sw.js` registers with scope `./` and its `install` step populates the versioned cache with the full required shell set

#### Scenario: Vendored Leaflet is part of the shell

- **WHEN** the service worker installs
- **THEN** the vendored Leaflet module and stylesheet under `src/vendor/` are present in the versioned shell cache

#### Scenario: Install fetch ignores a stale HTTP cache entry

- **GIVEN** the browser's HTTP cache already holds a response for a shell URL from a previous version of that file
- **WHEN** the service worker installs and pre-caches that URL
- **THEN** the content written into the versioned cache reflects the current network response, not the browser's previously-cached response
