## Why

The pip-boy service worker's map tile cache (`pipboy-tiles-v1`) is deliberately never versioned or swept, so it can survive deploys and logouts without forcing a re-download of public basemap tiles. But nothing bounds it either: every tile ever rendered across every session stays forever. On a phone that has played one long-running campaign, this has already grown to 7GB with no way for the user to reclaim the space short of uninstalling the app. The cache needs a ceiling, and the app needs a way to purge the bloat that's already accumulated on installed devices.

## What Changes

- The tile cache gets an entry-count cap. When a tile fetch is written to the cache and the cache exceeds the cap, the oldest entries (by insertion order, which Cache Storage preserves) are evicted until the cache is back under the cap. This is an evict-oldest policy, not true LRU: a cache **hit** never rewrites its entry to bump recency, since hits are the hot path (every pan/zoom) and re-writing on every hit would add cost for no benefit given how cheap tiles are to re-fetch.
- The tile cache's name is bumped (`pipboy-tiles-v1` → `pipboy-tiles-v2`). The existing `activate` sweep already deletes any cache name it doesn't recognize as current, so this is a one-time, zero-effort purge of the existing 7GB-class bloat for every already-installed client on its next update — no user action required.
- The settings popup gains a manual `SVUOTA CACHE MAPPA` action, following the existing `CERCA AGGIORNAMENTI` button pattern, that posts a new service-worker message clearing the tile cache on demand — giving users self-service control between deploys rather than only at deploy time.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `pipboy-pwa-installability`: the "Three-class request handling" requirement's map-tile behavior gains a bound — the tile cache SHALL be capped and SHALL evict its oldest entries once the cap is exceeded, instead of growing without limit.
- `pipboy-settings`: the settings popup gains a new action requirement for manually clearing the map tile cache, alongside the existing update-check action.

## Impact

- `apps/pip-boy/sw.js`: `TILE_CACHE` constant version bump; `tileCacheFirst()` gains a post-write cap check and oldest-first eviction; the `message` listener gains a new message type (e.g. `CLEAR_TILE_CACHE`) alongside the existing `SKIP_WAITING` / `FLUSH_CONTENT_CACHES` handlers.
- `apps/pip-boy/src/engine/settings-popup.js`: new `SVUOTA CACHE MAPPA` button and handler, modeled on the existing `checkForUpdate` / `CERCA AGGIORNAMENTI` control.
- No API, schema, or dependency changes. No change to tile fetching behavior on a cache miss, offline degradation, logout flush, or shell-cache versioning — only the tile cache's own name and its new size bound.

## Testing

- **e2e (Playwright, `apps/pip-boy/tests/`)**: extend or add a spec that seeds the tile cache past the cap via the service worker's cache APIs (or by driving enough distinct tile fetches through the test static server) and asserts the cache settles back at or under the cap with the oldest entries gone and the newest retained.
- **e2e**: assert that after the version bump, a client with a pre-existing `pipboy-tiles-v1` cache has it deleted on the new worker's `activate`, matching the existing stale-cache-sweep test pattern already used in `pipboy-fix-stale-precache`.
- **e2e**: assert the settings popup's new `SVUOTA CACHE MAPPA` button posts the clear message and the tile cache is empty afterward, mirroring how the existing update-button flow is tested.
