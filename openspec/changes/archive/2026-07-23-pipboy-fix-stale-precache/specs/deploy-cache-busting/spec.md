## MODIFIED Requirements

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
