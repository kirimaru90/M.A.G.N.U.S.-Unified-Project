## 1. Service worker: bypass HTTP cache during install

- [x] 1.1 In `apps/pip-boy/sw.js`, wrap each URL in `REQUIRED_SHELL_URLS` and `OPTIONAL_SHELL_URLS` in a `new Request(url, { cache: 'reload' })` before passing it to `cache.addAll`/`cache.add`, so install-time fetches always go to the network regardless of the browser's HTTP cache state.
- [x] 1.2 Confirm the `install` handler's atomic (`cache.addAll`) vs. best-effort (`cache.add(...).catch(...)`) semantics for required vs. optional assets are unchanged — only the request's cache mode changes, not the failure handling.

## 2. nginx: stop letting default caching mask shell-asset changes

- [x] 2.1 In `apps/pip-boy/nginx.conf`, extend the `Cache-Control: no-cache` treatment currently scoped to `location = /sw.js` so it also covers the shell assets the service worker precaches (e.g. broaden to the whole `location /` block, since every precached file lives under it and runtime performance is unaffected once the service worker controls the page).
- [x] 2.2 Verify `gzip`/`try_files` behavior is unaffected by the header change (no regression to SPA fallback routing or compression).

## 3. Tests

- [x] 3.1 Extend `apps/pip-boy/tests/pwa-installability.spec.ts` (or add a new spec) with a test that seeds a stale HTTP-cache-like response for a shell URL via the Playwright route/context cache before the app's first load, then changes the served content and triggers an install, asserting the versioned Cache Storage entry ends up holding the *new* content rather than the previously-cached one.
- [x] 3.2 Add/extend a scenario asserting the install-time `Request`s for shell URLs are issued with `cache: 'reload'` semantics (e.g. by asserting on request headers/mode observed by the test static server, or by the behavioral test in 3.1 standing in for this if request-mode inspection isn't practical in Playwright).
- [x] 3.3 Run `npm test` (Playwright) from `apps/pip-boy` and confirm all specs pass, including the new/extended ones.

## 4. Manual verification

- [ ] 4.1 After deploying, `curl -I` a shell asset (e.g. `/src/tabs/dice.js`) against the built nginx image and confirm the response's `Cache-Control` header prevents silent staleness, matching the updated `deploy-cache-busting` spec.
- [ ] 4.2 On an Android device with a previously-installed pip-boy PWA, deploy a visible dice-screen change, tap "CERCA AGGIORNAMENTI", and confirm the reloaded app reflects the change (repeating the original reproduction that surfaced this bug).
