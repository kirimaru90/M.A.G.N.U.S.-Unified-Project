## MODIFIED Requirements

### Requirement: Service worker pre-caches the application shell

A service worker file (`sw.js`) SHALL be served at the project root and SHALL be registered on page load when `'serviceWorker' in navigator` is true. On `install`, the service worker SHALL pre-cache the application shell, comprising at minimum: `index.html`, `manifest.webmanifest`, the icon set, all files under `suoni/`, the JavaScript modules under `src/`, the stylesheet, and the marked.js library URL used by the page. Every asset listed in the required shell set SHALL actually be served (return HTTP 200) at its referenced path — in particular `manifest.webmanifest` SHALL exist at the project root. The service worker SHALL use a versioned cache name (e.g., `robco-v8`) so that releases can invalidate the stale shell. The pre-cache list SHALL NOT include any path under `dati/` (the legacy static-content directory has been removed).

The install step SHALL be resilient: assets designated **optional** (e.g., the cross-origin marked.js CDN URL) SHALL be cached individually so that a failure to fetch an optional asset does not reject the `install`. Only the genuinely-required shell set is fetched atomically. A missing or 404-ing optional asset SHALL NOT prevent the service worker from installing and activating.

#### Scenario: Service worker registers successfully on load

- **WHEN** the page loads in a browser that supports service workers
- **THEN** `navigator.serviceWorker.register('sw.js', ...)` SHALL be called with a scope of `./`
- **THEN** registration SHALL succeed without error

#### Scenario: Pre-cache populates the shell on install

- **WHEN** the service worker fires its `install` event for the first time
- **THEN** the cache identified by the current shell version SHALL contain `index.html`, `manifest.webmanifest`, every file in `suoni/`, and the `src/` module files
- **THEN** the install SHALL complete without rejecting

#### Scenario: Required shell assets are all served

- **WHEN** each path in the required shell set is requested over the network
- **THEN** every one — including `manifest.webmanifest` — SHALL return HTTP 200
- **THEN** the `install` pre-cache SHALL complete without rejecting

#### Scenario: A missing optional asset does not fail install

- **WHEN** an optional pre-cache asset (such as the marked.js CDN URL) is unavailable at install time
- **THEN** the service worker SHALL still complete `install` and proceed to `activate`
- **THEN** only the required shell set determines install success

#### Scenario: Pre-cache contains no legacy content directory entries

- **WHEN** the service worker completes its `install` pre-cache
- **THEN** no cached entry SHALL have a path under `dati/`

#### Scenario: Marked.js is cached on first online load

- **WHEN** the page is loaded online and the service worker is active
- **AND** the page fetches `marked.min.js` from the CDN
- **THEN** the response SHALL be stored in the versioned shell cache
