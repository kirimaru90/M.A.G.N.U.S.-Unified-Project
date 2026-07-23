# deploy-cache-busting Specification

## Purpose

Automatic, deploy-time cache busting for static PWA apps served by the Magnus compose stack: the service worker's cache-version constant is stamped at image-build time from the deployed commit, the service-worker script is served revalidated so browsers detect the change, and local development can still live-edit an image-built app.

## Requirements

### Requirement: Deploy stamps the service-worker cache version from the deployed commit

For a static PWA app served by the Magnus compose stack, the service worker's cache-version constant SHALL be stamped at **image-build time** from a `BUILD_ID` derived from the deployed commit, not maintained by hand. The app's `sw.js` SHALL carry a stable literal placeholder token (`__BUILD_ID__`) in its cache-version constant in source; the app's `Dockerfile` SHALL declare `ARG BUILD_ID` (defaulting to a safe non-empty value such as `dev`) and substitute the placeholder with `${BUILD_ID}` while building the image. The deploy process (`start.sh`) SHALL export `BUILD_ID` from the deployed commit (`git rev-parse --short HEAD`) before `docker compose up -d --build`, and `docker-compose.yml` SHALL pass it as a build arg to the app service. The tracked source SHALL retain the placeholder so the deploy never dirties the git working tree.

#### Scenario: Build substitutes the placeholder
- **WHEN** the app image is built with `--build-arg BUILD_ID=<value>`
- **THEN** the `sw.js` served by that image contains the cache version stamped with `<value>` and contains no literal `__BUILD_ID__`

#### Scenario: Distinct commits yield distinct cache versions
- **WHEN** two images are built from two commits with different `BUILD_ID` values
- **THEN** the `sw.js` in each image declares a different cache-version constant

#### Scenario: Missing BUILD_ID falls back safely
- **WHEN** the app image is built with no `BUILD_ID` build arg supplied
- **THEN** the cache version is stamped with the Dockerfile's default (e.g. `dev`) and never left as the literal `__BUILD_ID__` placeholder

#### Scenario: Deploy exports the commit as BUILD_ID
- **WHEN** `start.sh` runs a deploy for a checked-out commit
- **THEN** it exports `BUILD_ID` equal to that commit's short SHA before building, so the built image's cache version is traceable to the deployed commit

### Requirement: Service-worker script is served revalidated

A static PWA app image SHALL serve its `sw.js` with an HTTP `Cache-Control` header of `no-cache` (revalidate on every use; not `no-store`), so that a browser's HTTP cache cannot mask a changed service-worker script and installed clients reliably detect a new cache version.

Any other static shell asset that a service worker precaches via `cache.addAll`/`cache.add` (per the owning app's `*-pwa-installability` capability) SHALL also be served in a way that prevents a browser's HTTP cache from masking a changed deploy — at minimum `Cache-Control: no-cache`, matching the treatment already required for `sw.js`. The prior allowance for such assets to use "the server's default caching" is removed: default caching is exactly what lets a freshly-versioned Cache Storage entry be silently stocked with a stale response, defeating the cache-version bump this capability otherwise guarantees. Assets a service worker does not precache (e.g. third-party basemap tiles, handled by their own dedicated tile cache) are unaffected by this requirement.

#### Scenario: sw.js is served with no-cache
- **WHEN** a client requests `/sw.js` from the app container
- **THEN** the response includes a `Cache-Control` header whose value contains `no-cache`

#### Scenario: Precached shell assets are served revalidated
- **WHEN** a client requests a shell asset that its app's service worker precaches on `install` (e.g. a JavaScript module, stylesheet, or the manifest)
- **THEN** the response includes a `Cache-Control` header that prevents the browser's HTTP cache from serving it without revalidation

#### Scenario: Non-precached assets are unaffected
- **WHEN** a client requests an asset that is not part of any service worker's precached shell list (e.g. a basemap tile)
- **THEN** this requirement does not constrain its caching headers

### Requirement: Local development can still live-edit an image-built app

Adopting image-build stamping SHALL NOT remove the ability to edit a static PWA app's source locally without a full rebuild. The stack SHALL provide either a compose override that re-mounts the app source over the built image for local use, or a documented single-command rebuild (`docker compose up -d --build <service>`), so local iteration remains practical while production builds stay stamped.

#### Scenario: Local override restores live editing
- **WHEN** a developer runs the local stack with the provided override
- **THEN** edits to the app source are reflected without rebuilding the image, and the stamped-version behavior remains in effect for non-override (production) builds
