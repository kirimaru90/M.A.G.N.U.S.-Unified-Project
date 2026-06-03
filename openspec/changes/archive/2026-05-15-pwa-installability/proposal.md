## Why

The Fallout Terminal Simulator is a static site with no backend and rarely-changing assets — a natural candidate for installation as a Progressive Web App. Today it has no manifest, no service worker, and no offline support: users on flaky connections lose access mid-session, and there is no way to install the app to a desktop or home screen for a one-tap launch.

Splitting PWA work into its own change keeps the deployment ritual (cache versioning, icon assets, manifest validation) isolated from the UX-polish work being done in parallel under `ux-interaction-fixes`. The two changes share no code dependencies and can land independently.

## What Changes

- Add a web app manifest (`manifest.webmanifest`) at the project root declaring name, short_name, start_url, `display: standalone`, theme/background colours matching the CRT aesthetic (`#33ff00` / `#0a0a0a`), and a maskable+standard icon set at 192×192 and 512×512.
- Add a service worker (`sw.js`) at the project root that pre-caches the application shell (`index.html`, sounds, `dati/manifest.json`, the marked.js CDN dependency) and serves it offline.
- Adopt **cache-first** for the shell and **stale-while-revalidate** for content under `dati/`, with cache versioning so releases can invalidate stale entries.
- On cache+network miss for a navigation request, respond with a hard-coded Fallout-styled Italian offline message (`ARCHIVIO NON DISPONIBILE OFFLINE — RICONNETTERSI ALLA RETE`). Non-navigation misses propagate the network error so existing in-page error handlers in `initBoot` / `loadServerFile` render their usual UI.
- Add `<link rel="manifest">`, `<meta name="theme-color">`, and apple-touch-icon links to `index.html` `<head>`.
- Register the service worker from `index.html` on `window.load`, gated on feature detection; silent fallback to non-PWA behaviour if registration fails.
- Pass Lighthouse PWA installability audits in a production-like deployment.

No build step is introduced. No npm/Workbox. No changes to the olonastro JSON authoring format. The engine's UX behaviour is untouched.

## Capabilities

### New Capabilities

- `pwa-installability`: web app manifest, service worker, pre-cache + SWR strategies, cache versioning and activation cleanup, offline navigation fallback, installability metadata.

### Modified Capabilities

_None._ This change adds capabilities without modifying existing spec-level behaviour.

## Impact

- **Code**: `index.html` `<head>` (3 new tags + an SW registration block before `</body>`). No changes to the engine's behaviour, no changes to handlers.
- **New static assets**: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-192-maskable.png`, `icons/icon-512-maskable.png`, all at the project root.
- **Deployment**: nginx/Docker static serving is unaffected; nginx's default `Content-Type: application/javascript` for `.js` covers `sw.js`. Service worker scope is the project root (`./`), so no `Service-Worker-Allowed` header is needed.
- **Release ritual**: every release that changes a shell asset MUST bump `CACHE_VERSION` in `sw.js`. Documented as a comment near the constant.
- **Content-creator workflow**: unchanged. Authors continue to edit JSON in `dati/` only.
- **Dependencies**: none added. `marked.js` remains the only CDN dependency; it is opportunistically cached on first online load.
- **Risk**: stale shell after a release if cache invalidation is mishandled — addressed in `design.md` with `skipWaiting()` + `clients.claim()` and a versioned cache name.
