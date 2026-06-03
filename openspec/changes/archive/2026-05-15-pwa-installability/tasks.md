## 1. Manifest and head metadata

- [x] 1.1 Create `manifest.webmanifest` at project root with `name: "RobCo Terminal Simulator"`, `short_name: "RobCo"`, `start_url: "./"`, `display: "standalone"`, `background_color: "#0a0a0a"`, `theme_color: "#33ff00"`, `orientation: "any"`, and an `icons` array referencing four files (192/512 standard + 192/512 maskable).
- [x] 1.2 In `index.html` `<head>`, add `<link rel="manifest" href="manifest.webmanifest">`, `<meta name="theme-color" content="#33ff00">`, and `<link rel="apple-touch-icon" href="icons/icon-192.png">`.
- [ ] 1.3 Manually verify: load the page, open DevTools → Application → Manifest, confirm all fields parse with no warnings.

## 2. Icon assets

- [x] 2.1 Create `icons/icon-192.png` (192×192) and `icons/icon-512.png` (512×512), phosphor-green RobCo branding on near-black background.
- [x] 2.2 Create `icons/icon-192-maskable.png` and `icons/icon-512-maskable.png` with ~10% safe-zone padding so platform masks do not crop the logo.
- [ ] 2.3 Manually verify: DevTools → Application → Manifest icon preview shows both standard and maskable variants rendering as intended.

## 3. Service worker — install and activate

- [x] 3.1 Create `sw.js` at project root with `const CACHE_VERSION = 'robco-v1';` and a comment immediately above reminding maintainers to bump the version on every release that touches shell assets.
- [x] 3.2 Define `SHELL_URLS` array containing: `./`, `./index.html`, `./manifest.webmanifest`, all four icons, every file in `suoni/`, `./dati/manifest.json`, and the marked.js CDN URL.
- [x] 3.3 Implement the `install` handler: `caches.open(CACHE_VERSION)`, `cache.addAll(SHELL_URLS)` wrapped so a failure on the CDN URL does NOT abort the install (use per-URL `cache.add(url).catch(()=>{})` for the CDN entry). Then `self.skipWaiting()`.
- [x] 3.4 Implement the `activate` handler: iterate `caches.keys()`, delete every cache whose name differs from `CACHE_VERSION`, then `clients.claim()`.

## 4. Service worker — fetch handler

- [x] 4.1 Implement `staleWhileRevalidate(request)`: open the versioned cache, read the cached match, in parallel issue a network fetch that puts a clone in the cache on success; return cached if present, otherwise wait for and return the network response.
- [x] 4.2 Implement `cacheFirstWithOfflineFallback(request)`: read cache; on hit, return immediately; on miss, fetch network, cache a clone on success; on network failure with `request.mode === 'navigate'`, return the offline fallback HTML response; on non-navigation network failure, propagate the error so existing in-page error handlers render.
- [x] 4.3 Wire the dispatch: in the `fetch` event listener, route requests under `/dati/` to SWR and everything else to cache-first-with-offline-fallback. Skip non-GET requests (`if (request.method !== 'GET') return;`).
- [x] 4.4 Embed the offline fallback HTML as a hard-coded string in `sw.js` (Italian: `ARCHIVIO NON DISPONIBILE OFFLINE — RICONNETTERSI ALLA RETE`), styled CRT-green on near-black.

## 5. Service worker registration in index.html

- [x] 5.1 At the bottom of `index.html` (or end of the existing script block), add an SW registration block: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}); }); }`.
- [ ] 5.2 Manually verify: load the page, DevTools → Application → Service Workers shows `sw.js` as activated and running with status "running". No console errors.

## 6. Offline behaviour validation

- [ ] 6.1 Online install path: load the page online, click into a tape, return to boot. Confirm DevTools → Cache Storage → `robco-v1` contains every entry in `SHELL_URLS` and any olonastri visited.
- [ ] 6.2 Offline shell: with the page open, toggle DevTools Network to Offline, reload. The boot menu MUST render from cached `dati/manifest.json` and the startup sound MUST play.
- [ ] 6.3 Offline cached content: while offline, click a previously-visited tape. It MUST load and render normally (SWR returns cached, the parallel network update fails silently).
- [ ] 6.4 Offline uncached content: while offline, attempt to load a never-visited tape. `loadServerFile`'s existing catch block MUST render its standard error UI.
- [ ] 6.5 Offline navigation fallback: in a fresh incognito window with the SW installed (visit once online first), go offline, force a hard reload that bypasses the in-memory cache. The fallback HTML MUST render.

## 7. Release ritual and Lighthouse audit

- [ ] 7.1 Run Lighthouse PWA installability audit against a production-like deploy. Confirm passes for: manifest validity, service worker controlling the page, theme-color meta, icon sizes (192/512), maskable icons.
- [x] 7.2 Document the release ritual in a comment near `CACHE_VERSION`: "Bump this constant whenever any file in SHELL_URLS changes content. The new version's activate handler deletes prior caches; the next navigation gets fresh shell."
- [ ] 7.3 Smoke test on Chrome (desktop install prompt + standalone launch), Edge (desktop install prompt), Safari iOS (Add to Home Screen + standalone launch). Confirm theme/background colours match `#33ff00` / `#0a0a0a` in the standalone window.
