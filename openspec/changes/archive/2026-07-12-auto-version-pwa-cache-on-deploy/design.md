## Context

`apps/pip-boy` is a no-build, static PWA served today by a bare `nginx:alpine` container with the source volume-mounted (`./apps/pip-boy:/usr/share/nginx/html`). Its hand-rolled `sw.js` pre-caches the whole shell cache-first under a fixed cache name and relies on a human bumping that name per release to invalidate it. That never happened, so installed clients are stuck. `apps/cms` already solves an analogous "inject a value at deploy time" problem with a `sed` in its `Dockerfile` (line 11 substitutes `API_BASE_URL`). This change adopts that same, already-blessed pattern for the SW cache version.

## Goals / Non-Goals

**Goals**
- Every code deploy produces a byte-different `sw.js` so browsers detect and adopt the update.
- Currently-frozen installed apps recover automatically on their next online launch.
- No dirtying of the git working tree by the deploy process.
- Reuse the existing `cms` Dockerfile-`sed` pattern; no new tooling or build system.

**Non-Goals**
- Changing the SW's caching *strategy* (it stays cache-first for the shell). We fix *invalidation*, not the strategy.
- Content hashing / per-asset fingerprinting. A single per-deploy cache version is sufficient because the shell is invalidated atomically.
- Migrating the terminal app (same hazard, separate follow-on).

## Decisions

### D1 — Stamp at image-build time via `ARG`, not at runtime or in the git tree
The version is substituted while building the image (`ARG BUILD_ID` + `sed`), so:
- The tracked `sw.js` keeps a stable `__BUILD_ID__` placeholder → `git pull`/`git checkout` in `start.sh` never hit a dirty file.
- No entrypoint templating or nginx `sub_filter` at request time → `sw.js` bytes are fixed per image and cacheable/servable as static.

Rejected alternative — **`sed` in `start.sh` against the volume-mounted tree**: keeps the volume mount but requires a `git reset --hard` before each deploy (so the placeholder is present to replace) and re-dirties the tree, which is fragile the moment `sw.js` changes upstream. Build-time substitution removes the whole class of problem, at the cost of pip-boy becoming image-built (see D4).

### D2 — `BUILD_ID = git rev-parse --short HEAD`
Derives from the deployed commit, so the cache version changes **iff** the code changed (no cache churn on no-op redeploys) and every `pipboy-<sha>` is traceable to a commit. `start.sh` owns the export because it is the single process that knows which commit is being deployed. A build with `BUILD_ID` unset falls back to `dev` (via `ARG BUILD_ID=dev`) rather than shipping the raw placeholder.

### D3 — Serve `sw.js` with `Cache-Control: no-cache`
The version bump only propagates if the browser actually re-fetches `sw.js`. Browsers already special-case SW scripts (revalidate at least every 24h, and per-navigation when headers permit), but an intermediary or the HTTP cache can still hand back a stale copy within that window. `no-cache` (revalidate every time — **not** `no-store`, which would forbid caching entirely and is unnecessary) removes the ambiguity. This requires pip-boy to have its own `nginx.conf`, which the image build introduces anyway.

### D4 — Pip-boy becomes image-built; restore local live-edit via a compose override
Consequence of D1: the `pip-boy` service moves from `image: nginx:alpine` + volume mount to `build:` + `args`, mirroring `cms`. This costs local live-editing (source edits need a rebuild). Restore it for local work with a `docker-compose.override.yml` that re-mounts `./apps/pip-boy` (dev tolerates the literal `__BUILD_ID__` in the cache name), or document `docker compose up -d --build pip-boy` as the local refresh step. Production/remote always builds via `start.sh`.

## Why this self-heals frozen phones

A service worker script is **never** served out of the SW's own Cache Storage — the browser fetches `sw.js` directly over HTTP as part of its update check on navigation. So even an app frozen on `pipboy-v1` will, on its next online launch, byte-compare the network `sw.js`, see the new `pipboy-<sha>`, install it, and in `activate` delete every cache `!== pipboy-<sha>` (purging the stale `pipboy-v1`) before `addAll` repopulates the fresh shell. `skipWaiting()` + `clients.claim()` (already present) make it take effect immediately. No user-side "clear site data" is needed.

```
online launch of frozen app
      │
      ▼
HTTP GET /sw.js  (no-cache → always revalidated)
      │  bytes differ (pipboy-v1 → pipboy-<sha>)
      ▼
install → addAll() refetches whole shell (incl. fresh config.js)
      │
      ▼
activate → delete caches where k !== 'pipboy-<sha>'  (pipboy-v1 purged)
      │
      ▼
clients.claim() → fresh app on next paint
```

## Risks / Trade-offs

- **Local DX regression** (D4) — mitigated by the compose override; explicitly documented.
- **`sed` placeholder drift** — if `sw.js` is refactored and the exact `__BUILD_ID__` token is lost, the substitution silently no-ops and ships `pipboy-dev` everywhere (breaking per-deploy invalidation again). Mitigated by a build/test assertion that the shipped `sw.js` contains no literal `__BUILD_ID__` and a `pipboy-<expected>` name.
- **One-time double reload** — a frozen client updating may need the in-progress session to reload once for `clients.claim()` to swap controllers; acceptable and self-resolving.

## Migration

No data migration. On the first deploy carrying this change, installed clients update automatically on next online launch (see above). No coordinated user action. If any client is on a platform that caches SW scripts aggressively past `no-cache`, the fallback is the browser's guaranteed ≤24h update check.
