# pipboy-pwa-installability Specification

## Purpose

PWA installability for `apps/pip-boy` via a web app manifest and a versioned service worker, two-class request handling that never caches authenticated API traffic, logout cache flush, offline fallback, and cache versioning/activation cleanup, adapted from the existing `emulator-pwa-installability` pattern.
## Requirements
### Requirement: Web app manifest declares installability metadata

`apps/pip-boy` SHALL ship a `manifest.webmanifest` at its project root declaring at minimum: `name`, `short_name`, `start_url: "./"`, `scope: "./"`, `orientation: "any"`, `background_color`, `theme_color` (matching the Pip-Boy phosphor-green identity used by the sheet UI), and an icon set with 192×192 and 512×512 entries in both standard and maskable purposes.

The `orientation` key SHALL be declared explicitly as `"any"` rather than omitted, so that the app's intent — no install-time orientation lock — is stated at the site rather than left to a default. The manifest SHALL NOT lock the app to a single orientation. A manifest orientation lock is a static, install-time declaration that cannot express a user's runtime choice, and it would override the runtime orientation lock that the `pipboy-settings` `ORIENTAMENTO` preference applies. Declaring `"any"` is what allows that preference — including its `VERTICALE` and `ORIZZONTALE` options — to take effect on an installed device, and what makes reachable the landscape rendering that `pipboy-responsive-shell` already requires of the shell in every supported orientation.

To take over the whole display when installed, the manifest SHALL request fullscreen presentation via `display_override: ["fullscreen", "standalone"]` and SHALL retain `display: "standalone"` as the base fallback for browsers that do not honour `display_override`. `index.html`'s `<head>` SHALL link the manifest, declare a matching `<meta name="theme-color">`, and retain `viewport-fit=cover` on its viewport meta so content can extend into the display's safe-area regions.

#### Scenario: Manifest is reachable and valid
- **WHEN** the page is loaded and its manifest link is followed
- **THEN** the browser receives a JSON document at `manifest.webmanifest` that parses as a valid web app manifest

#### Scenario: Manifest declares both maskable and standard icons
- **WHEN** the manifest is parsed
- **THEN** the `icons` array contains at least one `192x192` and one `512x512` entry, and at least one maskable icon

#### Scenario: Manifest requests fullscreen with a standalone fallback
- **WHEN** the manifest is parsed
- **THEN** `display_override` is `["fullscreen", "standalone"]` and `display` is `"standalone"`

#### Scenario: Manifest does not lock orientation
- **WHEN** the manifest is parsed
- **THEN** `orientation` is present and its value is `"any"`

#### Scenario: Installed app can be rotated
- **GIVEN** the app is installed and the `ORIENTAMENTO` preference is `AUTO`
- **WHEN** the device is rotated to landscape
- **THEN** the app follows the rotation rather than being held in portrait by the manifest

#### Scenario: Viewport allows safe-area coverage
- **WHEN** `index.html`'s viewport meta is inspected
- **THEN** it includes `viewport-fit=cover`

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

### Requirement: Offline fallback

When the app boots offline from a cached shell and a required API call (e.g., character load) fails because the network is unavailable, the affected screen SHALL render an Italian, CRT-consistent offline message instead of crashing or rendering blank. For a navigation request that misses both cache and network, the service worker SHALL respond with a minimal offline-styled HTML fallback page.

#### Scenario: Offline character load shows a message, not a crash
- **WHEN** the installed app launches offline and a character-load request fails
- **THEN** the sheet screen displays an Italian offline-appropriate message and the app does not crash

### Requirement: Cache versioning and activation cleanup

The service worker SHALL declare a versioned shell cache name constant whose version segment is **stamped at deploy time from the deployed commit** (see the `deploy-cache-busting` capability), not a hand-maintained literal. In source, the constant SHALL carry the stable `__BUILD_ID__` placeholder (i.e. `pipboy-__BUILD_ID__`); the built-and-served `sw.js` SHALL carry a concrete per-deploy version (e.g. `pipboy-<short-sha>`). On `activate`, the service worker SHALL delete every cache not matching that constant, call `self.skipWaiting()` during `install`, and call `clients.claim()` during `activate` so a new version takes control immediately. Because the version changes on every code deploy, a new `sw.js` byte-differs from the prior one, so browsers detect the update and the `activate` cleanup purges the previous version's shell cache — including for already-installed clients on their next online launch.

#### Scenario: Deploy produces a new cache version
- **WHEN** the app is deployed from a commit different from the currently-installed one
- **THEN** the served `sw.js` declares a cache-version constant different from the installed one, and contains no literal `__BUILD_ID__`

#### Scenario: Stale shell cache removed on activation
- **WHEN** a new service worker version activates after a prior version left a differently-named cache behind
- **THEN** that stale cache is deleted as part of `activate`, leaving only the current version's shell cache

#### Scenario: Installed client self-heals on next online launch
- **WHEN** an installed app previously frozen on an older cache version is launched with network available after a new deploy
- **THEN** the browser fetches the new `sw.js`, installs it, purges the old cache during `activate`, re-caches the fresh shell, and the app runs the deployed version without any manual cache-clearing by the user

### Requirement: Installable on desktop and Android

The site SHALL satisfy Lighthouse PWA installability criteria in production: HTTPS, a registered service worker, a linked manifest with the required fields, and icons meeting the 192×192/512×512 minimum. On Android, the installed app SHALL launch **fullscreen** — with the OS status bar and navigation buttons hidden — using the declared theme/background colors, falling back to standalone only where fullscreen is unsupported. On desktop, where fullscreen is not applicable, the app SHALL launch in standalone mode without browser chrome.

#### Scenario: Lighthouse installability audit passes
- **WHEN** Lighthouse runs its PWA installability audit against a production deployment
- **THEN** it reports success for manifest presence, service worker registration, theme-color meta, and icon size requirements

#### Scenario: Installed Android app launches fullscreen
- **WHEN** a user installs the app on Android and launches it
- **THEN** it opens without browser chrome and without the OS status bar or navigation buttons, using the declared theme and background colors

#### Scenario: Installed desktop app launches standalone
- **WHEN** a user installs the app on desktop and launches it
- **THEN** it opens without browser chrome using the declared theme and background colors

### Requirement: iOS standalone home-screen support

To run chrome-free when added to the iOS home screen, `index.html`'s `<head>` SHALL declare `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`. Combined with `viewport-fit=cover` and the shell's safe-area handling, `black-translucent` SHALL cause the app's own screen to render underneath the iOS status bar rather than beside a solid bar.

iOS does not permit a home-screen web app to fully hide the status bar or the home indicator; this is a documented platform limitation, and the requirement is satisfied by rendering content edge-to-edge under those regions (kept legible via safe-area insets), not by removing them.

#### Scenario: iOS web-app meta tags are present
- **WHEN** `index.html`'s `<head>` is inspected
- **THEN** it contains `mobile-web-app-capable=yes`, `apple-mobile-web-app-capable=yes`, and `apple-mobile-web-app-status-bar-style=black-translucent`

#### Scenario: iOS launches chrome-free with content under the status bar
- **WHEN** the app is added to the iOS home screen and launched
- **THEN** it opens without Safari chrome and the Pip-Boy screen extends under the status bar region, with header content kept clear of it by safe-area insets

