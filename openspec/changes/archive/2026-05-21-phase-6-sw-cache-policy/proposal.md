## Why

The service worker (`sw.js`) applies one blunt policy — cache-first for every same-origin GET — and bypasses every cross-origin request. That was fine for the old static `dati/*.json` flow, but the client is now an API consumer where some responses are public and some are authenticated-only (assigned campaigns, gated terminal payloads, campaign/terminal state, fictional-login outcomes). A single cache-everything policy would leak authenticated content into a shared cache that survives logout; a single bypass-everything policy would lose offline installability. The architecture (§4.4, §10) requires the shell to stay installable while authenticated content never persists client-side. This phase makes the cache policy aware of authentication state. It also bundles the cross-cutting cleanup deferred until the rework landed (legacy `dati/` removal, stale doc/spec pruning), now safe because every phase that depended on `dati/` is done.

## What Changes

- **Three-class cache policy in `sw.js`.** The `fetch` handler distinguishes:
  1. **App shell** (same-origin static: `index.html`, JS modules under `src/`, CSS, `suoni/*`, icons, `manifest.webmanifest`, the marked.js CDN file) — cache-first, served from a versioned cache, pre-cached on install. Unchanged behaviour, minus the now-deleted `dati/manifest.json` precache entry.
  2. **Public API content** (GET requests to the API that carry **no** `Authorization` header and are not `/auth/*`) — stale-while-revalidate into a *separate* content cache, so it can be flushed independently of the shell.
  3. **Authenticated-only responses** (any request carrying an `Authorization` header, any `/auth/*` request, any fictional-login request, and all non-GET methods) — **never cached**: fetched network-only with a no-store policy and never written to any cache.
- **Logout flushes the content cache.** `src/api/session.js#logout` posts a message to the active service worker; the SW deletes every non-shell cache. Defensive: by design no authenticated content is ever cached, but logout enforces a clean slate so a shared device cannot surface a prior session's public-content cache either.
- **Offline boot degrades gracefully.** When the shell loads offline and the campaign list cannot be fetched, the campaign-selection screen shows an offline-appropriate Italian message instead of crashing. (The shell itself already boots from cache.)
- **Cleanup (deferred cross-cutting work, now unblocked):**
  - Delete the `dati/` directory (legacy static holotapes — no live code path reads it).
  - Delete `src/screens/boot.js`, dead code whose only `dati/manifest.json` reference remains; it is imported nowhere.
  - Update `guida terminale.md` so it describes the API-backed flow rather than the `dati/manifest.json` static-file workflow.
  - Review pass: archive or correct specs that no longer reflect implemented behaviour (notably this `pwa-installability` rewrite; flag `manuale_robco_olonastri.md` if it still documents the static flow).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `pwa-installability`: cache-policy requirements rewritten. The single cache-first/stale-while-revalidate-`dati/` model is replaced by the three-class split (shell cache-first, public API content stale-while-revalidate in a separate cache, authenticated-only never cached). The shell precache list drops `dati/manifest.json`. New requirement: logout flushes non-shell caches. The install/manifest/icon/offline-fallback requirements are preserved at the observable level.

## Impact

- **Modified files**: `sw.js` (three-class `fetch` handler, separate content cache name, `message` handler for logout flush, no-store for authenticated requests, drop `dati/manifest.json` from precache, bump `CACHE_VERSION`), `src/api/session.js#logout` (postMessage the SW to flush), `src/screens/campaign-select.js` (offline-appropriate message if not already graceful), `guida terminale.md` (API-backed authoring flow).
- **Deleted files**: `dati/` (8 JSON files incl. `manifest.json`), `src/screens/boot.js` (dead legacy screen).
- **API contract used**: no new endpoints. The policy keys off the existing transport signal — `src/api/client.js` attaches `Authorization: Bearer <token>` only when a session token exists, so the presence of that header is the authenticated-request marker the SW reads. Cross-origin API deploys (`API_BASE_URL`) are addressed in design.
- **No `index.html` change**: SW registration and manifest link are already in place from prior PWA work; only `sw.js` logic and the logout/screen hooks change.
- **Content-creator workflow**: holotape authoring shape is unchanged. The only authoring-facing change is documentation: `guida terminale.md` stops describing the obsolete `dati/manifest.json` registration step and points authors at the backoffice/API-backed flow.
- **Out of scope**: push notifications, background sync, or any PWA capability beyond cache policy; changes to the icon set or `manifest.webmanifest` (already in place).
