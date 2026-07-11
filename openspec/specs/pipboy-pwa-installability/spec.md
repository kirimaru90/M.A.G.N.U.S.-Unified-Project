# pipboy-pwa-installability Specification

## Purpose

PWA installability for `apps/pip-boy` via a web app manifest and a versioned service worker, two-class request handling that never caches authenticated API traffic, logout cache flush, offline fallback, and cache versioning/activation cleanup, adapted from the existing `emulator-pwa-installability` pattern.

## Requirements

### Requirement: Web app manifest declares installability metadata

`apps/pip-boy` SHALL ship a `manifest.webmanifest` at its project root declaring at minimum: `name`, `short_name`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `orientation: "portrait"`, `background_color`, `theme_color` (matching the Pip-Boy phosphor-green identity used by the sheet UI), and an icon set with 192×192 and 512×512 entries in both standard and maskable purposes. `index.html`'s `<head>` SHALL link the manifest and declare a matching `<meta name="theme-color">`.

#### Scenario: Manifest is reachable and valid
- **WHEN** the page is loaded and its manifest link is followed
- **THEN** the browser receives a JSON document at `manifest.webmanifest` that parses as a valid web app manifest

#### Scenario: Manifest declares both maskable and standard icons
- **WHEN** the manifest is parsed
- **THEN** the `icons` array contains at least one `192x192` and one `512x512` entry, and at least one maskable icon

### Requirement: Service worker pre-caches the application shell

A service worker (`sw.js`) SHALL be served at the project root and registered on page load with a versioned cache name. On `install`, it SHALL pre-cache the required shell: `index.html`, `manifest.webmanifest`, the icon set, the stylesheet(s), and the JavaScript modules under `src/`. A missing optional asset (if any are designated optional) SHALL NOT fail the install; every required shell asset SHALL actually be served at HTTP 200.

#### Scenario: Service worker registers and pre-caches on first load
- **WHEN** the page loads in a browser that supports service workers
- **THEN** `sw.js` registers with scope `./` and its `install` step populates the versioned cache with the full required shell set

### Requirement: Two-class request handling — app shell vs. authenticated API

Unlike the terminal emulator, `apps/pip-boy` has no anonymous or public content: every API call (including the catalog reads) requires an authenticated session. The service worker's `fetch` handler SHALL classify every request into one of two classes:

1. **App shell** — same-origin GET requests for the precached shell.
2. **Authenticated API** — every other request, regardless of method, path, or headers.

Authenticated-API requests SHALL always be fetched network-only (no-store) and SHALL NEVER be written to any cache. The service worker SHALL determine the API origin from its own registration URL query string (`sw.js?api=<origin>`), matching the mechanism already used by the terminal emulator, so classification works whether the API is same-origin or cross-origin.

#### Scenario: Shell asset served from cache
- **WHEN** the page requests a precached shell asset
- **THEN** the service worker serves it from the versioned shell cache

#### Scenario: API request never cached
- **WHEN** the page issues any request to the API origin
- **THEN** the service worker fetches it network-only and does not write the response to any cache, regardless of whether the request succeeds or fails

### Requirement: Logout flushes non-shell caches

On logout, the client SHALL instruct the service worker (via `postMessage`) to delete every cache except the current versioned shell cache, after clearing the local session credential.

#### Scenario: Logout triggers cache flush
- **WHEN** an authenticated user logs out
- **THEN** the client posts a flush message to the controlling service worker, which deletes any non-shell cache while leaving the shell cache intact

#### Scenario: Flush is a no-op with no controlling worker
- **WHEN** logout occurs and `navigator.serviceWorker.controller` is `null`
- **THEN** the client skips the flush without error

### Requirement: Offline fallback

When the app boots offline from a cached shell and a required API call (e.g., character load) fails because the network is unavailable, the affected screen SHALL render an Italian, CRT-consistent offline message instead of crashing or rendering blank. For a navigation request that misses both cache and network, the service worker SHALL respond with a minimal offline-styled HTML fallback page.

#### Scenario: Offline character load shows a message, not a crash
- **WHEN** the installed app launches offline and a character-load request fails
- **THEN** the sheet screen displays an Italian offline-appropriate message and the app does not crash

### Requirement: Cache versioning and activation cleanup

The service worker SHALL declare a versioned shell cache name constant. On `activate`, it SHALL delete every cache not matching that constant, call `self.skipWaiting()` during `install`, and call `clients.claim()` during `activate` so a new version takes control immediately.

#### Scenario: Stale shell cache removed on activation
- **WHEN** a new service worker version activates after a prior version left a differently-named cache behind
- **THEN** that stale cache is deleted as part of `activate`

### Requirement: Installable on desktop and Android

The site SHALL satisfy Lighthouse PWA installability criteria in production: HTTPS, a registered service worker, a linked manifest with the required fields, and icons meeting the 192×192/512×512 minimum. The installed app SHALL launch in standalone mode with the declared theme/background colors.

#### Scenario: Lighthouse installability audit passes
- **WHEN** Lighthouse runs its PWA installability audit against a production deployment
- **THEN** it reports success for manifest presence, service worker registration, theme-color meta, and icon size requirements

#### Scenario: Installed app launches standalone
- **WHEN** a user installs the app and launches it
- **THEN** it opens without browser chrome, using the declared theme and background colors
