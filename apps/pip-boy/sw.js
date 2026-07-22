// Version segment is stamped at image-build time from the deployed commit
// (see deploy-cache-busting): the Dockerfile seds `__BUILD_ID__` → ${BUILD_ID}.
// The tracked source keeps the stable placeholder so `git pull` on deploy never
// dirties this file. A build with no BUILD_ID falls back to `pipboy-dev`.
const CACHE_VERSION = 'pipboy-__BUILD_ID__';

// Basemap tiles live in their own cache, deliberately unversioned: they are
// public third-party assets that do not change with a deploy, so re-downloading
// them on every release would be pure waste. Kept out of CACHE_VERSION so the
// activate sweep and the logout flush both leave them alone.
//
// The version segment here is bumped only to force a one-time purge of a
// previous version's accumulated tiles (the existing activate sweep below
// already deletes any cache name it doesn't recognise as current) — not on
// every deploy the way CACHE_VERSION is.
const TILE_CACHE = 'pipboy-tiles-v2';

// Cache-on-visit with no bound would grow forever (observed: 7GB on one
// long-running campaign). Entries are capped by count rather than by a byte
// budget — tiles are roughly uniform in size, and tracking exact response
// sizes would need a separate ledger Cache Storage doesn't provide for free.
// Trimming happens as evict-oldest (insertion order, which Cache Storage
// preserves), not true LRU: a cache hit never rewrites its entry (see
// tileCacheFirst), since hits are the hot path on every pan/zoom and a tile
// is cheap enough to re-fetch that recency-of-last-use isn't worth the extra
// write. Once the cap is exceeded, entries are trimmed down to a lower
// watermark rather than back to the cap exactly, so a burst of misses during
// fast panning only pays the keys() enumeration cost once, not per write.
const TILE_CACHE_MAX_ENTRIES = 4000;
const TILE_CACHE_WATERMARK = Math.floor(TILE_CACHE_MAX_ENTRIES * 0.9);

// The basemap host used by pipboy-map-tab. Coupled to the tile URL in
// src/tabs/map.js — change one and you must change the other, along with the
// attribution, or the new provider's terms are unmet.
const TILE_HOST_SUFFIX = '.basemaps.cartocdn.com';

function isTileHost(url) {
  return url.hostname.endsWith(TILE_HOST_SUFFIX);
}

const FONT_CDN_URLS = [
  'https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap',
];

// API origin is embedded in the SW registration URL as ?api=<origin> so the
// SW can classify cross-origin API requests without baking a URL into this file.
const API_ORIGIN = new URL(self.location).searchParams.get('api');

// Genuinely-required shell assets — same-origin files the app cannot run
// without. Fetched atomically via cache.addAll during install; a 404 here is a
// real deploy error and SHOULD fail the install.
const REQUIRED_SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './src/styles/pipboy.css',
  './src/main.js',
  './src/api/config.js',
  './src/api/client.js',
  './src/api/session.js',
  './src/api/campaigns.js',
  './src/api/characters.js',
  './src/api/catalogs.js',
  './src/api/last-selection.js',
  './src/state/store.js',
  './src/state/prefs.js',
  './src/engine/render.js',
  './src/engine/dice.js',
  './src/engine/device.js',
  './src/engine/settings-popup.js',
  './src/screens/login.js',
  './src/screens/campaign-select.js',
  './src/screens/character-select.js',
  './src/screens/sheet.js',
  './src/tabs/special.js',
  './src/tabs/health.js',
  './src/tabs/gear.js',
  './src/tabs/dice.js',
  './src/tabs/map.js',
  './src/tabs/map-geometry.js',
  './src/tabs/notes.js',
  './src/tabs/note-editor.js',
  './src/tabs/confirm-dialog.js',
  './src/api/campaign-map.js',
  './src/api/notes.js',
  './src/sheet/markdown.js',
  // Vendored Leaflet — without it the map tab cannot render offline. The
  // stylesheet's images/ are deliberately absent: the tab uses divIcon only and
  // mounts no layers control, so nothing requests them (see the vendor README).
  './src/vendor/leaflet/leaflet.esm.js',
  './src/vendor/leaflet/leaflet.css',
];

// Optional shell assets — cached individually (best-effort) so a single failed
// cross-origin fetch (e.g. the Google Fonts CSS being unreachable at install
// time) cannot reject the whole install.
const OPTIONAL_SHELL_URLS = [...FONT_CDN_URLS];

const SHELL_URLS = [...REQUIRED_SHELL_URLS, ...OPTIONAL_SHELL_URLS];

// Normalised shell URL set for fast O(1) lookup in classify().
const SHELL_URL_SET = new Set(
  SHELL_URLS.map((u) => new URL(u, self.location.href).href)
);

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><title>Pip-Boy — Offline</title>
<style>
  body{background:#06110a;color:#33ff66;font-family:'Share Tech Mono',monospace;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;
       text-shadow:0 0 5px rgba(51,255,102,0.55);text-align:center;}
</style></head>
<body><div><h2>SEGNALE PIP-BOY NON DISPONIBILE</h2><p>RICONNETTERSI ALLA RETE</p></div></body>
</html>`;

// Apart from basemap tiles, pip-boy has no anonymous/public content — every API
// call (catalogs included) requires a login. So the fetch handler needs three
// classes: 'shell' (precached same-origin/CDN shell assets), 'tile' (basemap
// tiles, which are public third-party assets), and everything else, which is
// always treated as authenticated API traffic and never cached.
function classify(request) {
  const url = new URL(request.url);
  if (request.method === 'GET' && SHELL_URL_SET.has(request.url)) {
    return 'shell';
  }
  if (request.method === 'GET' && isTileHost(url)) {
    return 'tile';
  }
  if (API_ORIGIN && url.origin !== API_ORIGIN && url.origin !== self.location.origin) {
    return null; // unrelated cross-origin request — let the browser handle it
  }
  return 'api';
}

// cache.addAll/cache.add's underlying fetch() can be satisfied by the
// browser's own HTTP cache, which is a separate layer from Cache Storage.
// Forcing { cache: 'reload' } makes every install-time fetch go to the
// network, so a freshly-versioned cache can never be stocked with a stale
// response the browser happened to already hold for that URL.
const toNetworkRequest = (url) => new Request(url, { cache: 'reload' });

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Required shell is atomic — only these determine install success.
      await cache.addAll(REQUIRED_SHELL_URLS.map(toNetworkRequest));
      // Optional assets are best-effort; a failure here does not reject install.
      await Promise.all(
        OPTIONAL_SHELL_URLS.map((u) =>
          cache.add(toNetworkRequest(u)).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Caches that survive a sweep: the current shell, and the tiles. Tiles are
// public and session-independent, so neither a new deploy nor a logout is a
// reason to make the player re-download them.
const isKeeper = (key) => key === CACHE_VERSION || key === TILE_CACHE;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !isKeeper(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  // The settings "CERCA AGGIORNAMENTI" button posts this so a freshly-installed
  // worker takes control at once rather than waiting for every tab to close.
  // (install already calls skipWaiting; this covers the case it is ever removed.)
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'FLUSH_CONTENT_CACHES') {
    // Logout: drop every non-shell cache except the tiles. They carry no player
    // or campaign data, so discarding them would force a full re-download on the
    // next login for no privacy benefit.
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => !isKeeper(k)).map((k) => caches.delete(k)))
      )
    );
    return;
  }
  if (event.data && event.data.type === 'CLEAR_TILE_CACHE') {
    // Manual escape hatch (settings "SVUOTA CACHE MAPPA"), independent of the
    // automatic purge that only runs when TILE_CACHE's own version changes.
    // Acks on the sent port, if any, so the caller can show a confirmation
    // once the delete has actually completed rather than optimistically.
    event.waitUntil(
      caches.delete(TILE_CACHE).then(() => {
        event.ports?.[0]?.postMessage({ type: 'TILE_CACHE_CLEARED' });
      })
    );
  }
});

async function cacheFirstWithOfflineFallback(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (_) {
    if (request.mode === 'navigate') {
      return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    throw _;
  }
}

/**
 * Cache-on-visit: serve a tile from cache, else fetch it and keep it. Tiles are
 * never pre-seeded — bulk-downloading a region violates the basemap provider's
 * terms, whereas retaining tiles a user actually browsed does not. Because the
 * map clamps zoom and pan bounds, the reachable tile set is finite, so a map the
 * player has visited keeps working offline.
 *
 * A miss on both cache and network fails quietly: the marker layer stays
 * rendered over empty tiles rather than the tab breaking.
 */
async function tileCacheFirst(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Opaque cross-origin responses are still worth keeping: they render fine.
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      await trimTileCache(cache);
    }
    return response;
  } catch (_) {
    return Response.error();
  }
}

/** Evict-oldest down to the watermark once the cap is exceeded — see the
 * TILE_CACHE_MAX_ENTRIES comment above for why this is count-based and
 * insertion-order-based rather than a byte budget or true LRU. */
async function trimTileCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= TILE_CACHE_MAX_ENTRIES) return;
  const excess = keys.length - TILE_CACHE_WATERMARK;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const cls = classify(event.request);

  if (cls === 'shell') {
    event.respondWith(cacheFirstWithOfflineFallback(event.request));
    return;
  }

  if (cls === 'tile') {
    event.respondWith(tileCacheFirst(event.request));
    return;
  }

  if (cls === 'api') {
    // Authenticated API traffic — always network-only, never written to any cache.
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch((err) => {
        if (event.request.mode === 'navigate') {
          return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        throw err;
      })
    );
    return;
  }

  // null: unrelated cross-origin request the SW should not intercept — let it pass.
});
