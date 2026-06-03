## Context

The engine is a single `index.html` with a small set of static assets (sounds under `suoni/`, content JSON under `dati/`, marked.js from a CDN). Deployment is nginx serving static files from a Docker image, or any equivalent static host. There is no backend.

This change introduces PWA infrastructure with three new files at the project root: `manifest.webmanifest`, `sw.js`, and an `icons/` directory. The only edit to `index.html` is three `<head>` tags and an SW registration block; no engine logic is touched.

This change is intentionally decoupled from the parallel `ux-interaction-fixes` change. Either can land first.

## Goals / Non-Goals

**Goals:**

- Lighthouse PWA installability passes on a production-like deployment.
- After a single online visit, the app launches and operates fully offline (boot menu, sounds, Markdown rendering).
- Authors iterating on content under `dati/` see fresh content on the next visit without forcing a hard reload.
- Release ritual is one line in `sw.js` (bump `CACHE_VERSION`) — no build step, no dependency on a library.

**Non-Goals:**

- No background sync, push notifications, periodic sync, or any service-worker feature beyond pre-cache + offline fallback.
- No build-time generation of the pre-cache list (`SHELL_URLS` is a hand-maintained array).
- No vendoring of marked.js (it is opportunistically cached from the CDN; first-ever-offline-with-no-prior-online-visit will fail to render Markdown — accepted).
- No changes to the engine's interaction model. Belongs to the parallel UX change.
- No CSP work. If a CSP is added later, `script-src 'self'` plus the marked.js CDN is the minimum.

## Decisions

### D1. Cache-first for shell, stale-while-revalidate for `dati/`

The application shell is content-addressable per release: `index.html`, `manifest.webmanifest`, icons under `icons/`, every file in `suoni/`, and the marked.js CDN URL. These almost never change between deploys. Cache-first gives instant offline boot and zero network round-trips on warm starts.

Content under `dati/` is where authors iterate (new olonastri, edits to existing ones). Stale-while-revalidate keeps the app responsive (cached response served immediately) while picking up fresh content on the next visit.

**Alternative considered:** SWR for shell too. Rejected — wasteful network on every boot for files that change once per release, and the installed-PWA experience expects instant launch.

**Alternative considered:** network-first for `dati/`. Rejected — defeats the purpose offline; a momentary network blip would hang the boot menu.

### D2. Cache versioning + `skipWaiting` + `clients.claim`

```
const CACHE_VERSION = 'robco-v1';
```

On `install`: open the versioned cache, `addAll(SHELL_URLS)`, call `self.skipWaiting()`.
On `activate`: enumerate `caches.keys()`, delete every cache whose name does not match `CACHE_VERSION`, call `clients.claim()`.

`skipWaiting()` + `clients.claim()` makes the new SW active for the next navigation rather than waiting until every tab is closed. Trade-off: a tab that's currently open during a deploy may receive mixed shell+content during its lifetime. For a single-page narrative app with short sessions, acceptable.

The release ritual: bump `CACHE_VERSION` whenever any file in `SHELL_URLS` changes content. Document this as a comment immediately above the constant.

**Alternative considered:** content-hashed cache name auto-generated at install (e.g., compute SHA over fetched assets). Rejected — runtime hashing adds complexity and a manual version bump is one extra line in a release commit.

### D3. Pre-cache list is hand-maintained and explicit

```
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './suoni/click.mp3',
  './suoni/data_terminal.mp3',
  './suoni/old-typing.mp3',
  './suoni/selection.mp3',
  './suoni/typing.mp3',
  './dati/manifest.json',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
];
```

Including `./` AND `./index.html` covers the two URLs the browser may request for navigation (the directory root, and the file directly).

`dati/manifest.json` is pre-cached so a fresh install can render the boot menu offline even before the user clicks anything. Individual olonastri are NOT pre-cached — they are discovered at fetch time and cached via SWR. This keeps install size predictable as content grows.

Marked.js is fetched cross-origin; pre-caching requires `cache.add` with a `Request` that has `mode: 'no-cors'` is acceptable but produces an opaque response. The cleaner approach is to fetch normally and let CDN CORS headers handle it (jsdelivr does serve CORS-friendly responses for npm). If `cache.addAll` fails on the CDN URL, the install handler MUST still complete by catching that specific failure and continuing — fallback path is the opportunistic-cache-on-first-fetch behaviour built into the fetch handler.

### D4. Fetch handler strategy dispatch

```
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isContent = isSameOrigin && url.pathname.startsWith('/dati/');

  if (isContent) {
    event.respondWith(staleWhileRevalidate(event.request));
  } else {
    event.respondWith(cacheFirstWithOfflineFallback(event.request));
  }
});
```

- `cacheFirstWithOfflineFallback`: try cache; on miss, fetch network and put a clone in cache; on network failure with `request.mode === 'navigate'`, return the offline fallback HTML; otherwise propagate the network error.
- `staleWhileRevalidate`: read cache; in parallel issue a fetch that, on success, puts a clone in cache. Return cached if present; otherwise wait for network and cache its response.

### D5. Offline fallback is a hard-coded HTML string

For navigation requests that miss both cache and network, the SW returns a tiny inline HTML page styled to match the CRT aesthetic, with Italian copy:

```html
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><title>RobCo — Offline</title>
<style>
  body { background:#0a0a0a; color:#33ff00; font-family:'Courier New',Courier,monospace;
         display:flex; align-items:center; justify-content:center; height:100vh; margin:0;
         text-shadow:0 0 5px #33ff00; text-align:center; }
</style></head>
<body><div><h2>ARCHIVIO NON DISPONIBILE OFFLINE</h2><p>RICONNETTERSI ALLA RETE</p></div></body>
</html>
```

**Rationale:** one fewer asset to manage. Inline string is ~600 bytes; lives in `sw.js` next to the strategy logic so it cannot drift out of sync.

**Alternative considered:** a separate `offline.html` file added to `SHELL_URLS`. Rejected for now — if a designer wants to skin it later, switching to a separate file is mechanical.

### D6. `<head>` additions and SW registration

In `index.html` `<head>`:

```html
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#33ff00">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

Before `</body>` (or at the bottom of the existing script block):

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
  });
}
```

The catch swallows registration errors silently — the app must continue to work as a non-PWA if the SW fails to register (e.g., user has SW disabled, HTTPS not available in a dev preview).

### D7. Icons

Four PNG files under `icons/`:

- `icon-192.png` — 192×192, standard purpose, RobCo branding on dark background.
- `icon-512.png` — 512×512, standard purpose.
- `icon-192-maskable.png` — 192×192, maskable purpose, with ~10% safe-zone padding so platform masks (circle, squircle) don't crop content.
- `icon-512-maskable.png` — 512×512, maskable purpose.

The icon design is out of scope for this design doc — anything that reads as "phosphor green RobCo logo on near-black" satisfies the brief.

## Risks / Trade-offs

- **[Risk] Stale shell after a release if `CACHE_VERSION` is not bumped.** → Mitigation: leave a prominent comment above the constant. Optionally, a tiny pre-commit reminder can be added later, but is out of scope here.
- **[Risk] Marked.js CDN pre-cache failure breaks install.** → Mitigation: wrap the CDN URL's `addAll` in its own try/catch or use `cache.add(request).catch(()=>{})` for that specific URL; first online navigation will re-fetch and opportunistically cache it on success.
- **[Risk] `clients.claim()` mid-session can change shell behaviour while the user is interacting.** → Mitigation: the only "shell behaviour" served by the SW is the static `index.html` and assets; an in-flight session reads the JS already in memory, not the cached file, so claim does not affect a running tab.
- **[Trade-off] Offline-first-ever (no prior online visit) fails to render Markdown because marked.js was never cached.** → Acceptable: this is a one-time edge case; the boot flow already requires online for `dati/manifest.json` to be present in cache.
- **[Trade-off] Hard-coded offline HTML in `sw.js` is harder to skin than a separate file.** → Acceptable: trivial to extract later.

## Migration Plan

This is purely additive. Steps:

1. Land all new files (`manifest.webmanifest`, `sw.js`, `icons/*`) and the three `<head>` tags + SW registration block in `index.html` in a single commit.
2. Deploy. Existing online users register the SW on next page load.
3. Subsequent releases: bump `CACHE_VERSION` whenever any shell file changes.

**Rollback:** revert the commit. Clients with the v1 SW still active will continue to be served from cache until their SW updates (next navigation will detect the missing `sw.js` if it was removed from the deploy, or fetch the new version if it was replaced).

**Hot rollback (disabling PWA entirely):** deploy an `sw.js` whose only behaviour is `self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', (e) => e.waitUntil((async () => { for (const k of await caches.keys()) await caches.delete(k); await self.registration.unregister(); await clients.claim(); })()));`. On next navigation every client unregisters the SW and clears caches.

## Open Questions

- Should the offline fallback HTML embed the boot screen layout (CRT scanlines etc.) for closer visual continuity, or stay minimal as drafted? Default: minimal. Revisit if a designer asks.
- Vendor marked.js locally to remove the CDN dependency entirely? Would make first-ever-offline-no-cache renderable but adds a static file to maintain. Out of scope; track as follow-up.
