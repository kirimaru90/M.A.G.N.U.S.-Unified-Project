## 1. Service worker: bound the tile cache

- [x] 1.1 In `apps/pip-boy/sw.js`, add a `TILE_CACHE_MAX_ENTRIES` constant (and a lower watermark, e.g. 90% of the cap) near the existing `TILE_CACHE` constant.
- [x] 1.2 In `tileCacheFirst()`, after a miss is fetched and `cache.put` succeeds, check the cache's entry count via `cache.keys()`; if it exceeds `TILE_CACHE_MAX_ENTRIES`, delete the oldest entries (in the order `keys()` returns them) until the count is back at or under the watermark.
- [x] 1.3 Confirm a cache **hit** path in `tileCacheFirst()` performs no write, delete, or reordering of any kind — hits must stay read-only so the eviction order reflects insertion order only, not recency of access.

## 2. Service worker: purge existing bloat via version bump

- [x] 2.1 In `apps/pip-boy/sw.js`, bump the `TILE_CACHE` constant from `'pipboy-tiles-v1'` to `'pipboy-tiles-v2'`.
- [x] 2.2 Confirm `isKeeper()` and the `activate` sweep need no other changes — they already delete any cache name that isn't the current `CACHE_VERSION` or the current `TILE_CACHE`, so the renamed constant alone causes `v1` to be swept on the next activation. (Also updated the duplicated `TILE_CACHE_NAME` literal in `settings-popup.js` and a hardcoded literal in `tests/pwa-installability.spec.ts`, both of which needed to stay in sync with the bump — not called out as separate tasks originally, but required for correctness.)

## 3. Service worker: manual clear message

- [x] 3.1 In `apps/pip-boy/sw.js`'s `message` listener, add a new case for `event.data.type === 'CLEAR_TILE_CACHE'` that deletes the `TILE_CACHE` cache, alongside the existing `SKIP_WAITING` and `FLUSH_CONTENT_CACHES` cases.
- [x] 3.2 Confirm this new case does not touch the shell cache and is unaffected by (and does not affect) the existing `isKeeper` logic.

## 4. Settings popup: manual clear action

- [x] 4.1 In `apps/pip-boy/src/engine/settings-popup.js`, add a `SVUOTA CACHE MAPPA` button in the popup's action area, alongside the existing `CERCA AGGIORNAMENTI` control.
- [x] 4.2 Wire its click handler to post `{ type: 'CLEAR_TILE_CACHE' }` to `navigator.serviceWorker.controller`, following the existing `postMessage` pattern used for `FLUSH_CONTENT_CACHES` in `src/api/session.js`.
- [x] 4.3 Give the button a brief confirmation state (e.g. a transient label change) after the clear completes, consistent with the update button's existing feedback style — no blocking dialog. (Uses a `MessageChannel` ack from the worker so the confirmation reflects actual completion rather than firing optimistically.)

## 5. Tests

- [x] 5.1 Extend the Playwright suite in `apps/pip-boy/tests/` with a spec that drives enough distinct tile fetches through the test static server to exceed `TILE_CACHE_MAX_ENTRIES`, then asserts (via the service worker's Cache Storage) that the entry count settles at or under the watermark and the most-recently-fetched tiles are present while the oldest are gone. (New `tests/tile-cache-cap.spec.ts`. Rather than 4000 real network round trips, the cache is seeded directly up to the cap in known insertion order and only the boundary-crossing tile goes through a real, `context.route`-faked network fetch via the actual `tileCacheFirst()`/`trimTileCache()` — same outcome, far faster and non-flaky.)
- [x] 5.2 Add a scenario asserting a cache **hit** does not change a tile's position in insertion order (e.g. re-request an early tile, then push the cache past the cap again, and confirm that re-requested tile is evicted before a tile fetched after it — proving hits don't bump recency).
- [x] 5.3 Extend `apps/pip-boy/tests/pwa-installability.spec.ts` (or add to the stale-cache-sweep test already covering shell-cache version bumps) with a case that seeds a `pipboy-tiles-v1`-named cache before activation and asserts it is deleted once the new worker (declaring `pipboy-tiles-v2`) activates. (Added as its own test in `tile-cache-cap.spec.ts` instead, mirroring the existing pattern rather than editing the shell-cache test itself.)
- [x] 5.4 Add a scenario driving the settings popup's `SVUOTA CACHE MAPPA` button and asserting the tile cache is empty afterward while the shell cache and current session remain intact. (Functional test in `tile-cache-cap.spec.ts`; a DOM-presence/label test was also added to `settings.spec.ts` alongside the existing `CERCA AGGIORNAMENTI` assertions.)
- [x] 5.5 Run `npm test` (Playwright) from `apps/pip-boy` and confirm all specs pass, including the new/extended ones. (345/345 passed.)

## 6. Manual verification

- [x] 6.1 On an Android device with a previously-installed pip-boy PWA already holding a large tile cache, deploy this change, relaunch (or tap `CERCA AGGIORNAMENTI`), and confirm site storage drops back to a small footprint after the worker activates.
- [x] 6.2 On the same or another device, pan/zoom the map tab enough to approach the new cap, and confirm the app keeps working smoothly (no visible stutter from the trim pass) and that storage growth levels off rather than continuing unbounded.
- [x] 6.3 Tap `SVUOTA CACHE MAPPA` in settings and confirm the map re-fetches tiles from the network on the next pan, with no effect on login state or other preferences.
