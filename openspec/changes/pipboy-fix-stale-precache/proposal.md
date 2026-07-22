## Why

On Android, tapping "CERCA AGGIORNAMENTI" in the pip-boy settings popup can complete the entire service-worker update lifecycle correctly — a new worker installs, activates, claims the page, and the app reloads — while the reloaded app still runs stale code for some shell files (observed on the dice screen after a `pipboy-dice-idle-placeholder` deploy). The service-worker *script* always updates because `sw.js` is the only file served with `Cache-Control: no-cache`; every other precached shell file (`src/tabs/dice.js`, `src/styles/pipboy.css`, etc.) has no explicit cache header, so `cache.addAll()`'s internal `fetch()` calls during `install` can be satisfied by the browser's own HTTP cache instead of the network. The result is a freshly-versioned Cache Storage entry (`pipboy-<new-build-id>`) stocked with old file contents — a state no amount of re-clicking "check for updates" can repair, since there is genuinely no newer service worker to find until the next deploy.

## What Changes

- Precache installation for `apps/pip-boy` SHALL guarantee that every required shell asset is fetched from the network — not the browser's HTTP cache — during `install`, so a new `CACHE_VERSION` can never be stocked with stale bytes.
- The `deploy-cache-busting` capability's allowance that "other static shell assets MAY be served with the server's default caching" SHALL be tightened: shell assets precached by a service worker SHALL be served in a way that does not let a browser's heuristic/HTTP cache mask a changed deploy, mirroring the existing `sw.js` treatment.
- The identical gap exists in `apps/terminal` (same nginx pattern, same unheadered shell assets) but is **out of scope** for this change, which is scoped to the reported pip-boy defect; a follow-up change should apply the same fix there.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pipboy-pwa-installability`: the "Service worker pre-caches the application shell" requirement changes from merely enumerating required shell URLs to also guaranteeing those URLs are fetched fresh from the network during `install`, regardless of the browser's HTTP cache state.
- `deploy-cache-busting`: the "Service-worker script is served revalidated" requirement's allowance for default caching on non-`sw.js` shell assets is narrowed — it SHALL NOT apply to assets a service worker precaches via `cache.addAll`/`cache.add`, since default caching on those assets is what allows a versioned cache to be stocked with stale content.

## Impact

- `apps/pip-boy/sw.js`: the `install` handler's fetch behavior for `REQUIRED_SHELL_URLS` (and `OPTIONAL_SHELL_URLS`).
- `apps/pip-boy/nginx.conf`: cache headers for shell assets beyond `/sw.js`.
- No API, data model, or cross-app changes. `apps/terminal` shares the vulnerable pattern but is explicitly not touched here.

## Testing

- **e2e (Playwright, `apps/pip-boy/tests/`)**: extend or add to `pwa-installability.spec.ts` to assert that the service worker's install-time shell fetches are issued in a way that cannot be satisfied by a pre-existing HTTP cache entry (e.g. seed the static test server's response cache/headers for a shell URL, then assert the byte content served into Cache Storage after install/activate reflects a subsequently-changed file rather than the pre-seeded one). This exercises the actual defect mechanism using the existing `static-server.mjs` harness, without needing a real nginx container.
- **Manual verification against the deployed nginx image**: after the fix, `curl -I` against a shell asset (e.g. `/src/tabs/dice.js`) on the built image SHALL show cache headers that prevent silent staleness, matching the `deploy-cache-busting` spec's revalidation intent.
