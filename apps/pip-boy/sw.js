const CACHE_VERSION = 'pipboy-v1';

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
  './src/engine/render.js',
  './src/engine/dice.js',
  './src/screens/login.js',
  './src/screens/campaign-select.js',
  './src/screens/character-select.js',
  './src/screens/sheet.js',
  './src/tabs/special.js',
  './src/tabs/health.js',
  './src/tabs/gear.js',
  './src/tabs/dice.js',
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

// Unlike the terminal emulator, pip-boy has no anonymous/public content — every
// API call (catalogs included) requires a login. So the fetch handler only
// needs two classes: 'shell' (precached same-origin/CDN shell assets) and
// everything else, which is always treated as authenticated API traffic and
// never cached, regardless of method, path, or headers.
function classify(request) {
  const url = new URL(request.url);
  if (request.method === 'GET' && SHELL_URL_SET.has(request.url)) {
    return 'shell';
  }
  if (API_ORIGIN && url.origin !== API_ORIGIN && url.origin !== self.location.origin) {
    return null; // unrelated cross-origin request — let the browser handle it
  }
  return 'api';
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Required shell is atomic — only these determine install success.
      await cache.addAll(REQUIRED_SHELL_URLS);
      // Optional assets are best-effort; a failure here does not reject install.
      await Promise.all(
        OPTIONAL_SHELL_URLS.map((u) => cache.add(u).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FLUSH_CONTENT_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
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

self.addEventListener('fetch', (event) => {
  const cls = classify(event.request);

  if (cls === 'shell') {
    event.respondWith(cacheFirstWithOfflineFallback(event.request));
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
