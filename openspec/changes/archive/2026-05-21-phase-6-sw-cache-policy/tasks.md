## 1. Service worker: cache constants and classification

- [x] 1.1 In `sw.js`, bump `CACHE_VERSION` to `'robco-v7'` and add a `CONTENT_CACHE = 'robco-content-v1'` constant for public API content.
- [x] 1.2 Remove `dati/manifest.json` from `SHELL_URLS` if present (the modular shell list already excludes it; confirm no `dati/` entry remains).
- [x] 1.3 Read the API origin from the SW's own registration URL: `const API_ORIGIN = new URL(self.location).searchParams.get('api');`.
- [x] 1.4 Add a `classify(request)` helper returning `'shell' | 'public' | 'auth'`: `'auth'` when the method is not GET, the request has an `Authorization` header, the path matches `/auth/`, or the path matches `/fictional-login`; `'shell'` when the request is same-origin and its URL is in the precached shell set (or the marked.js CDN URL); otherwise `'public'` (API content). Treat a same-origin GET that is not shell and not a navigation request as `'public'`.

## 2. Service worker: per-class fetch strategies

- [x] 2.1 Keep `cacheFirstWithOfflineFallback` for the `'shell'` class (existing behaviour), serving from `CACHE_VERSION` and returning `OFFLINE_HTML` on a failed navigation request.
- [x] 2.2 Add an authenticated-only branch: for `'auth'` requests, `return fetch(request, { cache: 'no-store' })` and never call `cache.put`.
- [x] 2.3 Add a stale-while-revalidate branch for `'public'` requests against `CONTENT_CACHE`: return the cached copy immediately if present, fire a background fetch that does `cache.put` only when `response.ok && response.type !== 'opaque'`; on a cache miss, await the network, store a 2xx non-opaque response, and return it; propagate the network error on failure.
- [x] 2.4 In the `fetch` listener, dispatch on `classify(event.request)` to the matching branch; leave the early `return` for requests the SW should not handle (e.g. cross-origin requests that are neither the API origin nor the marked.js CDN).

## 3. Service worker: activation cleanup and logout flush

- [x] 3.1 Update the `activate` handler to retain BOTH `CACHE_VERSION` and `CONTENT_CACHE`, deleting every other cache (`keys.filter(k => k !== CACHE_VERSION && k !== CONTENT_CACHE)`).
- [x] 3.2 Add a `message` handler: on `{ type: 'FLUSH_CONTENT_CACHES' }`, delete every cache whose name is not `CACHE_VERSION` (drops `CONTENT_CACHE` and any other non-shell cache).

## 4. Client: registration and logout wiring

- [x] 4.1 Where the SW is registered (`index.html` or `src/main.js`), append the API origin to the registration URL: `register('sw.js?api=' + encodeURIComponent(new URL(API_BASE_URL || self.location.origin).origin), { scope: './' })`. (For an empty `API_BASE_URL` same-origin deploy, the API origin equals the page origin.)
- [x] 4.2 In `src/api/session.js#logout`, after clearing the token and user, post the flush message: `navigator.serviceWorker?.controller?.postMessage({ type: 'FLUSH_CONTENT_CACHES' })`.

## 5. Client: offline campaign list

- [x] 5.1 Inspect `src/screens/campaign-select.js`: confirm a failed `GET /campaigns` is caught and renders an Italian offline-appropriate message (e.g. `RETE NON DISPONIBILE — IMPOSSIBILE CARICARE LE CAMPAGNE`) in the CRT style.
- [x] 5.2 If it currently throws or renders blank on a fetch failure, add the catch and the offline message so the shell does not crash offline.

## 6. Cleanup: remove the legacy static-content flow

- [x] 6.1 Delete the `dati/` directory and all 8 JSON files within it.
- [x] 6.2 Delete `src/screens/boot.js` (dead code; its only `dati/manifest.json` reference, imported nowhere).
- [x] 6.3 Grep the codebase (`*.js`, `*.html`, `sw.js`) for any remaining `dati/` or `manifest.json` (the content manifest, not `manifest.webmanifest`) reference and remove it.

## 7. Cleanup: documentation and spec review

- [x] 7.1 Update `guida terminale.md`: replace the `dati/manifest.json` registration / static-file authoring steps with the API-backed (backoffice) flow; cross-reference `reference/terminal-authoring-guide.md` if it is the canonical replacement.
- [x] 7.2 Review `manuale_robco_olonastri.md` and `reference/robco-terminal-architecture.md`: flag or correct any text that still presents the static `dati/` flow as current (correct the authoring guide; the architecture reference may keep historical context but should not describe `dati/` as the live flow).
- [x] 7.3 Spec review pass: confirm no spec under `openspec/specs/` still describes the `dati/`-based behaviour as current; this change's `pwa-installability` delta covers the cache spec.

## 8. Verify against the spec (DevTools)

- [x] 8.1 Load the app online, then go offline (DevTools → Network → Offline) and reload: the shell boots and the campaign-selection screen shows the offline-appropriate Italian message; no crash.
- [ ] 8.2 Log in, fetch assigned-campaign content, then inspect DevTools → Application → Cache Storage: confirm no authenticated entries (no `Authorization`-bearing responses, no `/auth/*`, no fictional-login) appear in any cache.
- [x] 8.3 Log out and re-inspect Cache Storage: the content cache is gone and only the versioned shell cache remains; previously-fetched assigned-campaign content is not retrievable from cache.
- [x] 8.4 Confirm an anonymous `GET /campaigns` populates `robco-content-v1` and is served stale-while-revalidate on the next visit (cached copy returned, background fetch updates it).
- [x] 8.5 Confirm the activated SW is `robco-v7` and any prior `robco-v6` cache was deleted on activation.
- [x] 8.6 Confirm the app still loads with no console errors after `dati/` and `src/screens/boot.js` are deleted.
<!-- Tasks 8.1–8.6 require manual DevTools verification in a running browser. -->
