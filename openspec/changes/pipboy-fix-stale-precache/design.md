## Context

`apps/pip-boy` is a cache-first PWA (`pipboy-pwa-installability`). Its service worker (`sw.js`) precaches a fixed list of shell URLs on `install` via `cache.addAll`/`cache.add`, under a cache name stamped with the deployed commit (`deploy-cache-busting`). `nginx.conf` currently gives only `/sw.js` an explicit `Cache-Control: no-cache`; every other shell file — `index.html`, the manifest, icons, `pipboy.css`, and every module under `src/` — is served with nginx's defaults (`Last-Modified`/`ETag`, no explicit freshness lifetime), which mobile browsers can and do cache heuristically.

`cache.addAll()`/`cache.add()` issue ordinary `fetch()` calls internally. Those calls are satisfiable from the browser's own HTTP cache — a layer entirely separate from the Service Worker's Cache Storage. So even though `CACHE_VERSION` correctly changes on every deploy (confirmed: the reported reproduction showed the update banner cycle — "AGGIORNAMENTO…" → reload — completing correctly), the *content* written into that freshly-named cache can still be the browser's stale HTTP-cached copy of a shell file. Once that happens, the defect is permanent for that install until the next deploy: there is no newer service worker to detect, so re-checking correctly reports "GIÀ AGGIORNATO" while the page keeps running old code.

This is also a pre-existing loophole in the spec itself: `deploy-cache-busting`'s "Service-worker script is served revalidated" requirement explicitly says "Other static shell assets MAY be served with the server's default caching" — which is exactly the gap this change closes.

## Goals / Non-Goals

**Goals:**
- Guarantee that a service worker's `install` step always populates its versioned cache with network-fresh shell content, independent of whatever the browser's local HTTP cache currently holds for those URLs.
- Close the `deploy-cache-busting` spec loophole that currently permits default (potentially staleness-masking) caching on non-`sw.js` shell assets that a service worker precaches.
- Keep the existing runtime behavior (cache-first shell serving, offline fallback, tile caching, logout flush) unchanged — this is an install-time correctness fix, not a runtime strategy change.

**Non-Goals:**
- Fixing the identical gap in `apps/terminal` (same nginx pattern, same unheadered shell assets). Tracked as a follow-up change; out of scope here because the reported defect and reproduction are pip-boy-specific.
- Addressing iOS/WKWebView-specific service-worker or cache quirks.
- Changing or auditing the external `edge` reverse proxy. Its config isn't in this repo; if it adds its own caching layer in front of nginx, that's a separate investigation.
- Changing how shell assets are served *after* the service worker controls the page (already cache-first from Cache Storage, and correct).

## Decisions

**1. Make the service worker's install-time fetches bypass the HTTP cache directly, via `RequestCache: 'reload'`.**

Instead of passing bare URL strings to `cache.addAll`/`cache.add`, wrap each in `new Request(url, { cache: 'reload' })`. `reload` mode is the standard Fetch API instruction for "always go to the network for this read, but still populate the HTTP cache with the fresh response" — it is the documented fix for precisely this class of bug (a service worker's own precache silently inheriting the browser's HTTP cache staleness). This is the primary fix: it holds regardless of server headers, so it also protects against any caching layer between the browser and origin that this change doesn't control (e.g. the external `edge` proxy, if it forwards `Cache-Control` from origin rather than overriding it).

*Alternative considered*: rely solely on nginx headers (below) and leave `sw.js` requests as-is. Rejected as the sole fix because it depends on every layer between the phone and the origin correctly honoring the header — the `edge` proxy's behavior isn't known, and the app already can't verify it from this repo. `reload` mode fixes the browser's own HTTP cache regardless of what any upstream proxy adds to the response headers.

**2. Also serve all shell assets with `Cache-Control: no-cache` from nginx, not just `/sw.js`.**

Broaden the existing `/sw.js`-only header to the whole app (or at minimum every file in `REQUIRED_SHELL_URLS`/`OPTIONAL_SHELL_URLS`). Once a service worker controls the page, shell assets are served cache-first from Cache Storage — nginx-level HTTP caching adds no real performance benefit at that point, since the SW cache already answers instantly. The *only* thing browser HTTP caching can do for these files, once an SW is in the picture, is reintroduce this exact staleness bug (e.g. for the narrow pre-SW-control window, or if a future change reverts decision 1). `no-cache` (revalidate every use via conditional GET) rather than `no-store`, matching the existing `/sw.js` precedent and rationale already documented in `nginx.conf`.

*Alternative considered*: a short `max-age` (e.g. 60s) instead of `no-cache`. Rejected — it would narrow the staleness window but not close it, and deploys are infrequent enough (manual, SSH-triggered) that there's no meaningful cost to full revalidation.

**3. Layer both fixes rather than picking one.**

Decision 1 fixes the actual reported defect and is robust to unknowns (the edge proxy). Decision 2 closes the spec-level loophole and protects any request path that doesn't go through decision 1's code (e.g. if a shell URL is ever fetched outside the `install` handler before being cached — the existing `cacheFirstWithOfflineFallback` fallback-fetch path, or a plain browser tab load before the SW has ever registered). Neither alone covers every path; together they do.

## Risks / Trade-offs

- **[Risk]** Server-wide `no-cache` adds a conditional-GET round-trip for every shell asset on first (pre-SW-control) load → **Mitigation**: `no-cache` still allows 304 responses (cheap, small), and this only matters before the SW takes control — every subsequent load is served cache-first from Cache Storage, bypassing nginx entirely.
- **[Risk]** Already-affected installed clients (already stuck with a poisoned versioned cache) aren't retroactively fixed by shipping this change → **Mitigation**: inherent to the bug — no code change can reach into an already-broken client. The next normal deploy after this fix ships will correctly re-populate their cache (the same self-heal path `deploy-cache-busting` already documents), so no additional user action beyond a normal deploy cycle is needed.
- **[Risk]** The external `edge` reverse proxy might override or strip the `Cache-Control` header, or cache responses independently of it → **Mitigation**: decision 1 (`reload` mode) doesn't depend on that proxy's behavior at all, since it governs the browser's own HTTP cache directly. Flagged as an open question below since the proxy's config isn't in this repo.
- **[Risk]** `apps/terminal` has the identical gap and remains vulnerable → **Mitigation**: explicitly out of scope (see Non-Goals); flagged for a follow-up change.

## Migration Plan

No data migration. This ships as an ordinary deploy:
1. Update `apps/pip-boy/sw.js`'s install handler to use `{ cache: 'reload' }` requests.
2. Update `apps/pip-boy/nginx.conf` to extend the `no-cache` header beyond `/sw.js`.
3. Deploy normally — `BUILD_ID` changes as always, `sw.js` byte-differs, installed clients detect and install the update through the existing lifecycle (no change to that mechanism).
4. Clients that were already stuck on a poisoned cache from a *prior* deploy self-heal on this deploy, the same way any stale-cache client already self-heals per `deploy-cache-busting`'s documented contract.

No rollback concerns beyond a normal revert-and-redeploy: this change only tightens cache-freshness guarantees and does not alter runtime behavior, data shape, or API surface.

## Open Questions

- Should the identical `apps/terminal` gap be fixed in a follow-up change now, or left until it causes a reported defect there too?
- Does the external `edge` reverse proxy cache responses independently of origin `Cache-Control` headers? Not verifiable from this repo; worth checking directly if staleness is ever reported again after this fix ships.
