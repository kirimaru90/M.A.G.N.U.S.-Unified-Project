## Context

The service worker today (`sw.js`, `CACHE_VERSION = 'robco-v6'`) does two things:

1. On `install`, precaches a fixed shell list (`SHELL_URLS`) plus the marked.js CDN file. The list still contains nothing under `dati/` — it was already migrated to the modular `src/` files in Phase 0.
2. On `fetch`, it handles **same-origin GET only** (`if (event.request.method !== 'GET') return;` and `if (url.origin !== self.location.origin) return;`) with one strategy: `cacheFirstWithOfflineFallback` — return cache if present, else network, and on a network failure for a navigation request return the Italian `OFFLINE_HTML`.

Everything the client now talks to lives behind the API. `src/api/client.js` builds request URLs from `API_BASE_URL` (`src/api/config.js`, default `http://localhost:3000`) and attaches `Authorization: Bearer <token>` **only when `getToken()` returns a token** (`src/api/session.js`). The token lives in `sessionStorage`; `logout()` clears it and the in-memory user. Because `API_BASE_URL` defaults to a different port, **API requests are currently cross-origin and the SW skips them entirely** — nothing API-related is cached today.

That bypass accidentally satisfies the security requirement (no authenticated content is cached) but defeats the "public content cacheable" goal and is fragile: a same-origin deploy (`API_BASE_URL = ''`, relative paths) would route every API call through the cache-first handler and start caching authenticated payloads into the shared, logout-surviving cache. The architecture forbids exactly that (§4.4: cached shell must load, offline may degrade; §10: fictional credentials / server-only fields must never appear in client-bound responses that persist).

The `dati/` directory (8 legacy JSON holotapes) and `src/screens/boot.js` (a dead screen that still `fetch('dati/manifest.json')`, imported nowhere) are the last residue of the static flow and are removed here.

## Goals / Non-Goals

**Goals:**
- A three-class `fetch` policy: shell cache-first; public API content stale-while-revalidate in a *separate* cache; authenticated-only content never cached.
- A robust, config-free signal for "authenticated request" that works whether the API is same-origin or cross-origin.
- Logout removes any non-shell cache, guaranteeing a clean slate on shared devices.
- Offline boot reaches the shell and shows an offline-appropriate message instead of crashing.
- Remove `dati/` and `src/screens/boot.js`; update `guida terminale.md`; review specs for staleness.

**Non-Goals:**
- Push notifications, background sync, periodic sync, or any PWA capability beyond cache policy.
- Changing the icon set or `manifest.webmanifest`.
- Caching public API content *for full offline play* — the done-criterion only requires the shell to boot and the campaign list to show an offline message, not that public campaigns render offline. SWR is a freshness optimisation, not an offline-content guarantee.
- A server token lifecycle for fictional-login (Phase 5 keeps unlocks in-memory; nothing to cache).

## Decisions

### Decision 1: The `Authorization` header is the authenticated-request signal
The SW classifies a request as authenticated-only when `request.headers.get('Authorization')` is present, OR the path matches `/auth/` (login/logout/me), OR it is a fictional-login request, OR the method is not `GET`. Such requests are fetched network-only with `{ cache: 'no-store' }` and are **never** written to any cache.

- **Why:** `client.js` attaches the bearer header iff a session token exists, so the header *is* the ground truth for "this response may contain assigned/authenticated content." It needs no knowledge of `API_BASE_URL`, works cross- or same-origin, and degrades safely: an anonymous request simply lacks the header. `/auth/*` and fictional-login are added belt-and-suspenders because they are sensitive even though POSTs are already excluded by the method check.
- **Alternative considered:** classify by URL path patterns alone (e.g. "`/campaigns` is public, `/auth` is private"). Rejected — the *same* endpoint (`GET /campaigns`, `GET /terminals/:id/load`) returns public data anonymously and assigned/gated data with a token; only the credential, not the path, distinguishes them.

### Decision 2: Two caches — a versioned shell cache and a separate content cache
Keep `CACHE_VERSION` (bumped to `robco-v7`) for the precached shell and add `CONTENT_CACHE = 'robco-content-v1'` for public API content. `activate` deletes any cache whose name is neither constant. Logout deletes the content cache (and any other non-shell cache) without touching the shell.

- **Why:** separating concerns lets logout and freshness churn flush public content without evicting the offline shell, and lets a shell release (version bump) invalidate the shell without dropping warm content. A single cache would force logout to choose between nuking the offline shell or risking leftover content.
- **Alternative considered:** one cache with per-entry tagging. Rejected — Cache Storage has no metadata channel; you would shadow tags in IndexedDB, far more machinery than two named caches.

### Decision 3: Stale-while-revalidate for public API content, in the SW, opt-in by API origin
Public content = a GET that reached the `fetch` handler, is **not** classified authenticated by Decision 1, and targets the API (not the shell). The handler returns the cached copy immediately if present and kicks off a background fetch that updates `CONTENT_CACHE` on a 2xx; on a cache miss it awaits the network, caches a 2xx, and returns it.

To recognise API requests across origins without baking a URL into `sw.js`, the page registers the worker with the API origin in the registration query string — `navigator.serviceWorker.register('sw.js?api=' + encodeURIComponent(apiOrigin))` — and the SW reads `new URL(self.location).searchParams.get('api')`. Requests whose origin matches that value (or same-origin requests whose path is not in the precache shell set, for the `API_BASE_URL=''` deploy) are treated as API content.

- **Why:** the query-string seam is the lightest way to give a classic service worker a deploy-time value without an `importScripts` config module or a build step (the project has no build step). Changing the query string also changes the SW URL, which correctly triggers an update when the API origin changes.
- **Trade-off:** cross-origin API responses must be CORS-readable for the SW to store and replay them; an opaque response would be cached unusably. The API already serves the browser app with CORS, so responses are readable. If a deployment ever serves opaque API responses, the SWR branch silently falls back to network-only (cache a 2xx only when `response.type !== 'opaque'`).
- **Alternative considered:** `postMessage` the API origin to the SW after registration and hold it in worker memory. Rejected — worker memory is evicted between events, so the value would need re-priming on every wake; the registration URL is durable and available on first `fetch`.
- **Alternative considered (fallback):** shell-only caching — never cache API content at all, leaving every API request network-only. This still meets every done-criterion (shell boots offline; nothing authenticated persists). It is the safe degrade path if SWR proves fiddly; the design keeps the authenticated-never-cache rule independent of the SWR rule so the SWR branch can be dropped without weakening security.

### Decision 4: Logout flushes via `postMessage` to the controller
`session.js#logout`, after clearing the token, calls `navigator.serviceWorker.controller?.postMessage({ type: 'FLUSH_CONTENT_CACHES' })`. The SW's `message` handler deletes every cache except the current `CACHE_VERSION`.

- **Why:** the SW owns Cache Storage; the page asks it to flush rather than racing it from the window context. Deleting all non-shell caches (not just trying to find authenticated entries) is the defensive guarantee the proposal asks for — even the public content cache is dropped so a shared device shows nothing from the prior session.
- **Edge case:** if `navigator.serviceWorker.controller` is null (first load before the SW controls the page, or SW unsupported), there is nothing cached to flush, so the no-op is correct.

### Decision 5: Offline campaign list degrades to a message, not a crash
The shell boots from cache offline; the first API call (`GET /campaigns`) then fails with a network error. `src/screens/campaign-select.js` must catch that and render an Italian offline-appropriate message (consistent with the CRT copy, e.g. `RETE NON DISPONIBILE — IMPOSSIBILE CARICARE LE CAMPAGNE`) rather than throwing. If the screen already surfaces a generic error for a failed fetch, this is satisfied; otherwise add the catch.

- **Why:** the done-criterion explicitly requires "campaign list shows an offline-appropriate message; no crashes." This is the only client-screen behaviour the cache policy implies.

## Risks / Trade-offs

- **Same-origin deploy mis-classification.** With `API_BASE_URL=''`, API paths are same-origin and not in the precache set; a new same-origin static asset that isn't precached could be mistaken for API content and cached in `CONTENT_CACHE`. → Mitigation: classify same-origin requests as API content only when they are *not* shell *and not* a navigation request; static assets that should be shell belong in `SHELL_URLS` anyway. Document the invariant in `sw.js`.
- **Opaque cross-origin responses.** A misconfigured API (no CORS) yields opaque responses that cache as unreadable. → Mitigation: only `cache.put` when `response.ok && response.type !== 'opaque'`; otherwise behave network-only.
- **Stale public content after a server change.** SWR serves the previous copy for one extra view. → Acceptable by design (that is the freshness/latency trade SWR makes); the next view is fresh, and `CONTENT_CACHE` can be version-bumped if a hard invalidation is ever needed.
- **Deleting `dati/` breaks something still reading it.** → Verified: the only live reference is `src/screens/boot.js`, which is dead (imported nowhere; `main.js` uses `campaign-select`/`terminal-list`). Both are removed together. Remaining `dati/` mentions are in docs (`guida terminale.md` updated here; `manuale_robco_olonastri.md` and `reference/robco-terminal-architecture.md` are flagged for the review pass).
- **Cache-version bump churn.** Bumping `CACHE_VERSION` to `robco-v7` evicts the old shell on next activate (expected). → Standard release behaviour; `skipWaiting` + `clients.claim` already make the new worker take control promptly.

## Migration Plan

Pure client change, no data migration. Order: (1) implement the `sw.js` three-class handler, content cache, and message handler, bumping `CACHE_VERSION`; (2) wire the logout flush and the registration query string; (3) ensure the offline campaign-list message; (4) delete `dati/` and `src/screens/boot.js`; (5) update `guida terminale.md` and run the spec review pass. Rollback is reverting the client commit and restoring `dati/` from git history — but with `boot.js` gone and the API live there is no runtime dependency on `dati/`. Verify done-criteria in DevTools → Application → Cache Storage: shell present, no authenticated entries, content cache cleared after logout.

## Open Questions

- **Fictional-login request shape for classification.** It is a POST (already excluded by the method check), so no path match is strictly needed; the explicit `/fictional-login` guard is defensive in case the contract ever adds a GET variant. Confirm against the live Swagger that no GET fictional-login endpoint exists; if one does, add it to the authenticated-path list.
- **Does any production deploy serve the API same-origin?** If yes, confirm the precache `SHELL_URLS` enumerates every static asset so the "same-origin non-shell GET = API content" rule never swallows a real shell file. Current deploy is cross-origin (`localhost:3000`), so this is latent until a same-origin deploy happens.
