# emulator-pwa-installability Specification

## Purpose

PWA installability via a web app manifest, a versioned service worker pre-caching the shell with three-class request classification, never caching authenticated responses, stale-while-revalidate public content, logout flush, and offline fallbacks.

## Requirements

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

A service worker file (`sw.js`) SHALL be served at the project root and SHALL be registered on page load when `'serviceWorker' in navigator` is true. On `install`, the service worker SHALL pre-cache the application shell, comprising at minimum: `index.html`, `manifest.webmanifest`, the icon set, all files under `suoni/`, the JavaScript modules under `src/`, the stylesheet, and the marked.js library URL used by the page. The service worker SHALL use a versioned cache name (e.g., `robco-v7`) so that releases can invalidate the stale shell. The pre-cache list SHALL NOT include any path under `dati/` (the legacy static-content directory has been removed).

#### Scenario: Service worker registers successfully on load

- **WHEN** the page loads in a browser that supports service workers
- **THEN** `navigator.serviceWorker.register('sw.js', ...)` SHALL be called with a scope of `./`
- **THEN** registration SHALL succeed without error

#### Scenario: Pre-cache populates the shell on install

- **WHEN** the service worker fires its `install` event for the first time
- **THEN** the cache identified by the current shell version SHALL contain `index.html`, `manifest.webmanifest`, every file in `suoni/`, and the `src/` module files
- **THEN** the install SHALL complete without rejecting

#### Scenario: Pre-cache contains no legacy content directory entries

- **WHEN** the service worker completes its `install` pre-cache
- **THEN** no cached entry SHALL have a path under `dati/`

#### Scenario: Marked.js is cached on first online load

- **WHEN** the page is loaded online and the service worker is active
- **AND** the page fetches `marked.min.js` from the CDN
- **THEN** the response SHALL be stored in the versioned shell cache

---

### Requirement: Three-class request classification

The service worker `fetch` handler SHALL classify every request it handles into exactly one of three classes and apply the matching cache policy:

1. **App shell** — same-origin GET requests for the precached application shell (`index.html`, the modules under `src/`, the CSS, `suoni/*`, the icons, `manifest.webmanifest`, and the marked.js library URL).
2. **Public API content** — GET requests directed at the API that carry **no** `Authorization` header and are not `/auth/*` requests.
3. **Authenticated-only** — any request that carries an `Authorization` header, any `/auth/*` request, any fictional-login request, and any request whose method is not `GET`.

The service worker SHALL determine the API origin from its own registration URL query string (e.g. `sw.js?api=<origin>`) so that classification works whether the API is served same-origin or cross-origin. A same-origin GET that is neither a navigation request nor part of the shell SHALL be treated as API content.

#### Scenario: Request carrying an Authorization header is authenticated-only

- **WHEN** the page issues a request that includes an `Authorization` header
- **THEN** the service worker SHALL classify it as authenticated-only regardless of its path or method

#### Scenario: Anonymous API GET is public content

- **WHEN** the page issues a GET to the API with no `Authorization` header and the path is not `/auth/*`
- **THEN** the service worker SHALL classify it as public API content

#### Scenario: Shell asset is classified as shell

- **WHEN** the page requests a precached shell asset (e.g. `src/main.js`)
- **THEN** the service worker SHALL classify it as app shell

---

### Requirement: Authenticated-only responses are never cached

The service worker SHALL NOT write any authenticated-only response to any cache. Such requests SHALL be fetched network-only using a no-store policy, and no `Authorization`-bearing response, `/auth/*` response, or fictional-login response SHALL ever be stored in Cache Storage.

#### Scenario: Authenticated response not stored

- **WHEN** the service worker handles a request that carries an `Authorization` header
- **THEN** the service worker SHALL fetch it from the network with a no-store policy
- **THEN** the response SHALL NOT be written to any cache

#### Scenario: Fictional-login response not stored

- **WHEN** the page submits a fictional-login attempt (`POST /terminals/:id/fictional-login`)
- **THEN** the service worker SHALL NOT store the response in any cache

#### Scenario: Auth endpoint response not stored

- **WHEN** the page requests any `/auth/*` endpoint
- **THEN** the response SHALL NOT be written to any cache

---

### Requirement: Public API content uses a separate stale-while-revalidate cache

The service worker SHALL store public API content in a dedicated content cache whose name is distinct from the versioned shell cache. For public API content the service worker SHALL apply a stale-while-revalidate strategy: when a cached copy is present it SHALL be returned immediately and a background network fetch SHALL update the content cache on a successful (2xx, non-opaque) response; on a cache miss the service worker SHALL fetch from the network, store a successful non-opaque response in the content cache, and return it. The service worker SHALL NOT store opaque responses.

#### Scenario: Public content served from cache and revalidated

- **WHEN** the page requests public API content (e.g. anonymous `GET /campaigns`) and the content cache holds a prior copy
- **THEN** the service worker SHALL return the cached copy immediately
- **THEN** the service worker SHALL issue a background network fetch and, on a 2xx non-opaque response, update the content cache

#### Scenario: Public content cache miss falls back to network

- **WHEN** the page requests public API content not present in the content cache
- **AND** the network is available
- **THEN** the service worker SHALL fetch from the network and store a 2xx non-opaque response in the content cache before returning it

#### Scenario: Opaque response is not stored

- **WHEN** a public API content fetch yields an opaque (non-CORS-readable) response
- **THEN** the service worker SHALL return it without writing it to any cache

---

### Requirement: Logout flushes non-shell caches

On logout the client SHALL instruct the service worker to delete every cache except the current versioned shell cache. The client SHALL send the instruction via `postMessage` to the controlling service worker after clearing the local session credential, and the service worker SHALL, on receiving that message, delete all caches whose name is not the current shell cache version.

#### Scenario: Content cache cleared on logout

- **WHEN** an authenticated user logs out
- **THEN** the client SHALL post a flush message to the controlling service worker
- **THEN** the service worker SHALL delete the content cache and any other non-shell cache
- **THEN** the versioned shell cache SHALL remain intact

#### Scenario: Flush is a no-op when no worker controls the page

- **WHEN** logout occurs and `navigator.serviceWorker.controller` is null
- **THEN** the client SHALL skip the flush without error

---

### Requirement: Offline boot shows an offline-appropriate campaign message

When the application shell boots from cache while offline and the campaign list cannot be fetched, the campaign-selection screen SHALL render an offline-appropriate message in Italian, consistent with the CRT aesthetic, instead of crashing or rendering a blank list.

#### Scenario: Campaign list unreachable offline

- **WHEN** the installed app launches offline and the shell loads from cache
- **AND** the request for the campaign list fails because the network is unavailable
- **THEN** the campaign-selection screen SHALL display an Italian offline-appropriate message
- **THEN** the application SHALL NOT crash

---

### Requirement: Cache versioning and activation cleanup

The service worker SHALL declare a versioned shell cache name constant and a separate content cache name constant. On its `activate` event, the service worker SHALL delete every cache whose name matches neither of these two constants. The service worker SHALL call `self.skipWaiting()` during `install` and `clients.claim()` during `activate` so that the new worker takes control immediately on next navigation.

#### Scenario: Stale caches are deleted on activation

- **WHEN** a new service worker version activates
- **AND** a previous version had cached entries under a cache name that is neither the current shell version nor the content cache name
- **THEN** that stale cache SHALL be deleted as part of `activate`
- **THEN** only the current shell cache and the content cache SHALL remain after activation

#### Scenario: New service worker takes control immediately

- **WHEN** a new service worker version is installed
- **THEN** `self.skipWaiting()` SHALL be called during `install`
- **THEN** `clients.claim()` SHALL be called during `activate`
- **THEN** the next page navigation SHALL be controlled by the new worker

---

### Requirement: Offline fallback when no cached response and no network

When a request misses the cache and the network is unavailable, the service worker SHALL respond gracefully. For navigation requests, the response SHALL be a minimal Fallout-styled HTML page indicating that the archive is not available offline, using Italian-language copy consistent with the rest of the UI (e.g., "ARCHIVIO NON DISPONIBILE OFFLINE — RICONNETTERSI ALLA RETE"). For non-navigation requests (including API content requests), the service worker SHALL propagate the network error so that the in-page error handlers render their usual messages (e.g. the campaign-selection screen's offline-appropriate message).

#### Scenario: Offline navigation with no cached shell shows fallback page

- **WHEN** the browser is offline
- **AND** the user navigates to a URL handled by the service worker
- **AND** neither the cache nor the network can satisfy the request
- **THEN** the service worker SHALL respond with a minimal HTML page displaying the offline message in Italian

#### Scenario: Offline API content miss propagates as network error

- **WHEN** the browser is offline
- **AND** the page requests public API content not present in the content cache
- **THEN** the service worker SHALL propagate the network failure
- **THEN** the in-page handler (e.g. the campaign-selection screen) SHALL render its offline-appropriate message

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
