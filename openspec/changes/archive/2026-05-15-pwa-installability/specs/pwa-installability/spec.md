## ADDED Requirements

### Requirement: Web app manifest declares installability metadata

The site SHALL ship a `manifest.webmanifest` file at the project root declaring at minimum: `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color: "#0a0a0a"`, `theme_color: "#33ff00"`, and an icon set with entries for 192×192 and 512×512 in both standard and maskable purposes. The `index.html` `<head>` SHALL link to this manifest via `<link rel="manifest" href="manifest.webmanifest">` and SHALL declare `<meta name="theme-color" content="#33ff00">`.

#### Scenario: Manifest is reachable from the page

- **WHEN** the page is loaded and the manifest link is followed
- **THEN** the browser SHALL receive a JSON document at `manifest.webmanifest`
- **THEN** the document SHALL parse as a valid web app manifest

#### Scenario: Manifest declares CRT colour identity

- **WHEN** the manifest is parsed
- **THEN** `background_color` SHALL equal `"#0a0a0a"`
- **THEN** `theme_color` SHALL equal `"#33ff00"`

#### Scenario: Manifest declares both maskable and standard icons

- **WHEN** the manifest is parsed
- **THEN** the `icons` array SHALL contain at least one entry of size `192x192` and one of size `512x512`
- **THEN** at least one maskable icon SHALL be declared (`purpose` includes `"maskable"`)

---

### Requirement: Service worker pre-caches the application shell

A service worker file (`sw.js`) SHALL be served at the project root and SHALL be registered on page load when `'serviceWorker' in navigator` is true. On `install`, the service worker SHALL pre-cache the application shell, comprising at minimum: `index.html`, `manifest.webmanifest`, the icon set, all files under `suoni/`, `dati/manifest.json`, and the marked.js library URL used by the page. The service worker SHALL use a versioned cache name (e.g., `robco-v1`) so that releases can invalidate stale caches.

#### Scenario: Service worker registers successfully on load

- **WHEN** the page loads in a browser that supports service workers
- **THEN** `navigator.serviceWorker.register('sw.js', { scope: './' })` SHALL be called
- **THEN** registration SHALL succeed without error

#### Scenario: Pre-cache populates the shell on install

- **WHEN** the service worker fires its `install` event for the first time
- **THEN** the cache identified by the current version SHALL contain `index.html`, `manifest.webmanifest`, every file in `suoni/`, and `dati/manifest.json`
- **THEN** the install SHALL complete without rejecting

#### Scenario: Marked.js is cached on first online load

- **WHEN** the page is loaded online and the service worker is active
- **AND** the page fetches `marked.min.js` from the CDN
- **THEN** the response SHALL be stored in the versioned cache

---

### Requirement: Cache-first strategy for shell, stale-while-revalidate for content

The service worker `fetch` handler SHALL apply a cache-first strategy to requests for the application shell (`index.html`, `manifest.webmanifest`, icons, `suoni/*`, `marked.min.js`): the cached response SHALL be returned immediately when present, and only on a cache miss SHALL a network request be issued. For requests under `dati/` (the content directory), the service worker SHALL apply a stale-while-revalidate strategy: the cached response SHALL be returned immediately if present, and a network fetch SHALL run in parallel to update the cache for the next visit.

#### Scenario: Shell request served from cache

- **WHEN** the page fetches `index.html` and the cache contains it
- **THEN** the service worker SHALL respond from cache without issuing a network request

#### Scenario: dati/ request served from cache and updated in background

- **WHEN** the page fetches `dati/fascicolo_mcgillian.json` and the cache contains a prior copy
- **THEN** the service worker SHALL respond from cache immediately
- **THEN** the service worker SHALL issue a network request in parallel
- **THEN** if the network request succeeds, the cache entry SHALL be updated with the new response

#### Scenario: dati/ request not in cache falls back to network

- **WHEN** the page fetches `dati/segreto.json` and the cache does not contain it
- **AND** the network is available
- **THEN** the service worker SHALL respond from the network
- **THEN** the response SHALL be stored in the cache for next visit

---

### Requirement: Cache versioning and activation cleanup

The service worker SHALL declare a single cache version constant. On its `activate` event, the service worker SHALL delete every cache whose name does not match the current version constant. The service worker SHALL call `self.skipWaiting()` during `install` and `clients.claim()` during `activate` so that the new worker takes control immediately on next navigation.

#### Scenario: Old caches are deleted on activation

- **WHEN** a new service worker version activates
- **AND** the previous version had cached entries under a different cache name
- **THEN** the old cache SHALL be deleted as part of `activate`
- **THEN** only the current cache version SHALL remain after activation

#### Scenario: New service worker takes control immediately

- **WHEN** a new service worker version is installed
- **THEN** `self.skipWaiting()` SHALL be called during `install`
- **THEN** `clients.claim()` SHALL be called during `activate`
- **THEN** the next page navigation SHALL be controlled by the new worker

---

### Requirement: Offline fallback when no cached response and no network

When a request misses the cache and the network is unavailable, the service worker SHALL respond gracefully. For navigation requests to `index.html`, the response SHALL be a minimal Fallout-styled HTML page indicating that the archive is not available offline, using Italian-language copy consistent with the rest of the UI (e.g., "ARCHIVIO NON DISPONIBILE OFFLINE — RICONNETTERSI ALLA RETE"). For non-navigation requests, the service worker SHALL propagate the network error so that the existing in-page error handlers (`initBoot`/`loadServerFile` catch blocks) render their usual messages.

#### Scenario: Offline navigation with no cached shell shows fallback page

- **WHEN** the browser is offline
- **AND** the user navigates to a URL handled by the service worker
- **AND** neither the cache nor the network can satisfy the request
- **THEN** the service worker SHALL respond with a minimal HTML page displaying the offline message in Italian

#### Scenario: Offline asset miss propagates as network error

- **WHEN** the browser is offline
- **AND** the page requests a `dati/*.json` file not present in the cache
- **THEN** the service worker SHALL propagate the network failure
- **THEN** `loadServerFile` or `initBoot` SHALL render its existing error UI

---

### Requirement: Installable on desktop and mobile

The site SHALL satisfy Lighthouse PWA installability criteria: served over HTTPS (in production), a registered service worker controlling the page, a linked web app manifest with the required fields, and icons meeting the 192×192 and 512×512 minimum. Browsers that support installation prompts SHALL offer the user the option to install the app.

#### Scenario: Lighthouse PWA audit passes installability checks

- **WHEN** Lighthouse runs the PWA installability audit against a production deployment
- **THEN** the audit SHALL report success for: manifest presence, service worker registration, theme-color meta, and icon size requirements

#### Scenario: Installed app launches in standalone mode

- **WHEN** the user installs the app via the browser's install prompt
- **AND** the user launches the installed app
- **THEN** the app SHALL open in a standalone window (no browser chrome)
- **THEN** the theme colour SHALL match `#33ff00`
- **THEN** the background colour SHALL match `#0a0a0a`
