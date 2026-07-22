## Context

`apps/pip-boy/sw.js` maintains two Cache Storage entries: the versioned shell cache (`pipboy-__BUILD_ID__`, swept on every `activate`) and the tile cache (`pipboy-tiles-v1`, deliberately excluded from that sweep and from the logout flush, per `pipboy-pwa-installability`). `tileCacheFirst()` writes every basemap tile fetched by `pipboy-map-tab` into the tile cache on a miss and never removes anything. Campaign maps span country-scale bounds at up to `maxZoom: 18`, so a long-running campaign accumulates tiles across many sessions with nothing ever evicted — confirmed on one installed device at 7GB.

This design covers three additive pieces: an entry-count cap with evict-oldest trimming inside `tileCacheFirst()`, a version bump of the cache name to purge the existing bloat, and a manual clear action wired into the settings popup.

## Goals / Non-Goals

**Goals:**
- Bound the tile cache's steady-state size so it cannot grow without limit.
- Reclaim the already-accumulated bloat on existing installs without requiring the user to do anything.
- Give the user a manual escape hatch to clear the tile cache on demand, independent of a deploy.
- Preserve the existing cache-on-visit behavior and its rationale (no bulk pre-seeding, tiles survive logout and deploys).

**Non-Goals:**
- True LRU (recency-of-last-use) eviction. Bumping a cache hit's insertion order would add a write to the hot path (every pan/zoom re-hits cache far more often than it misses), for a benefit that doesn't matter much given how cheap a tile is to re-fetch.
- Byte-accurate size budgeting. Tracking exact response sizes would need a separate ledger (Cache API doesn't total bytes for you); an entry-count cap is treated as a good-enough proxy given tiles are roughly uniform in size.
- Any change to shell-cache versioning, offline fallback, logout flush, or the shell/tile/API request classification itself — only the tile cache's name and its new bound change.

## Decisions

**Evict-oldest over LRU.** `cache.keys()` preserves insertion order. On a miss that triggers a `cache.put`, check the resulting entry count; if it exceeds the cap, delete the oldest entries first. This is "option 1" from the exploration that led to this change: simpler than LRU, no extra write on cache hits, and acceptable because re-downloading an evicted tile costs a few KB and one network round-trip — not worth optimizing away for a resource this cheap.

**Trim to a lower watermark, not exactly to the cap.** Running `cache.keys()` (an O(n) enumeration) and a delete pass on literally every single tile write would add overhead during heavy panning, when many tile misses land in quick succession. Instead, the cap check only triggers the expensive trim once the cache has grown past the cap, and when it does, it trims down to a lower watermark (e.g. 90% of the cap) rather than back to the cap exactly. This means a burst of misses only pays the enumeration cost once per overflow, not once per write, at the cost of temporarily allowing a bit more storage than the nominal cap between trims.

**Entry-count cap, not a byte budget.** A byte-accurate budget would need to track each response's size at write time (Cache API's `keys()`/`matchAll()` don't report byte size), which means a separate ledger kept in sync with the cache — more moving parts for marginal accuracy, since basemap raster tiles at a fixed tile size are roughly uniform. An entry-count cap approximates a byte budget well enough: at a rough 10-20KB/tile estimate, a cap in the low thousands keeps worst-case storage in the tens-to-low-hundreds of MB, several orders of magnitude below the 7GB observed.

**Cache name bump (`pipboy-tiles-v1` → `pipboy-tiles-v2`) to purge existing bloat.** The existing `activate` handler already deletes any cache name that isn't the current shell cache or the current tile cache (`isKeeper`). Renaming the constant means `v1` simply stops being a keeper on the next deploy — the existing sweep does all the work, with no new code path needed for the one-time purge. This fires the first time each installed client's service worker updates and activates (next online launch, or the user tapping the existing `CERCA AGGIORNAMENTI` control).

**Manual clear as a new message type (`CLEAR_TILE_CACHE`), not overloading `FLUSH_CONTENT_CACHES`.** `FLUSH_CONTENT_CACHES` explicitly preserves the tile cache by design (tiles carry no session data, so logout shouldn't force a re-download). Reusing that message for a tile-specific clear would either break that logout guarantee or require a flag, both messier than a second, narrowly-scoped message type handled alongside the existing `SKIP_WAITING`/`FLUSH_CONTENT_CACHES` cases.

## Risks / Trade-offs

- **[Risk]** Concurrent tile fetches during fast panning could race on the trim logic (overlapping `keys()` reads and `delete` calls) → **Mitigation**: accepted as low-severity. `cache.delete` on an already-deleted key just resolves `false`; worst case is the cache briefly sitting slightly above the watermark or a redundant delete, never a crash or data loss.
- **[Risk]** An entry-count cap is a proxy for size, not a guarantee — if tile responses are ever larger than assumed (e.g. a future retina/`@2x` layer), the actual byte footprint at the same entry cap grows accordingly → **Mitigation**: none built in now; flagged as an open question below, revisit if `detectRetina` is ever turned on for the tile layer.
- **[Risk]** The version-bump purge only fires on the next service-worker activation — a client that never reopens the app won't reclaim space until it does → **Mitigation**: the manual `SVUOTA CACHE MAPPA` button is independent of this and works even without a new deploy, but it still requires the user to know to press it; no proactive notification is in scope for this change.

## Migration Plan

1. Ship `sw.js` with the bumped `TILE_CACHE` constant, the cap/trim logic in `tileCacheFirst()`, and the new `CLEAR_TILE_CACHE` message handler, plus the settings-popup button, in one deploy.
2. Each installed client purges its old `pipboy-tiles-v1` automatically the next time its service worker updates and activates (existing `isKeeper` sweep, no new code needed for this step).
3. From that point on, the (new) `pipboy-tiles-v2` cache is self-bounding.
4. Rollback is a plain revert: the cap and message-handler additions are purely additive and client-local, with no backend or data-model involvement. Reverting simply returns to unbounded growth under whatever cache name is live at that point — not a broken or inconsistent state.

## Open Questions

- Exact cap value (entry count and watermark percentage) — this design assumes "low thousands" is enough headroom for a session's worth of panning/zooming without noticeable re-fetch churn; worth confirming against real usage after this ships rather than over-engineering a number now.
- Whether a byte-budget ledger is ever worth the added complexity — only if tile responses stop being roughly uniform in size (e.g. retina tiles), which is not currently the case.
