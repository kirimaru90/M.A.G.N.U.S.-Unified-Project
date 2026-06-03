const CACHE_VERSION = 'robco-v8';
const CONTENT_CACHE = 'robco-content-v1';

const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';

// API origin is embedded in the SW registration URL as ?api=<origin> so the
// SW can classify cross-origin API requests without baking a URL into this file.
const API_ORIGIN = new URL(self.location).searchParams.get('api');

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
  './src/main.js',
  './src/api/config.js',
  './src/api/client.js',
  './src/engine/typewriter.js',
  './src/engine/sounds.js',
  './src/engine/keynav.js',
  './src/engine/back-history.js',
  './src/engine/hidden-tape.js',
  './src/engine/login-fictional.js',
  './src/screens/campaign-select.js',
  './src/screens/terminal-list.js',
  './src/screens/terminal.js',
  './src/screens/login-fictional.js',
  './src/styles/terminal.css',
];

// Normalised shell URL set for fast O(1) lookup in classify().
const SHELL_URL_SET = new Set(
  SHELL_URLS.map(u => new URL(u, self.location.href).href)
);

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><title>RobCo — Offline</title>
<style>
  body{background:#0a0a0a;color:#33ff00;font-family:'Courier New',Courier,monospace;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;
       text-shadow:0 0 5px #33ff00;text-align:center;}
</style></head>
<body><div><h2>ARCHIVIO NON DISPONIBILE OFFLINE</h2><p>RICONNETTERSI ALLA RETE</p></div></body>
</html>`;

// Classify a request into 'shell' | 'public' | 'auth'.
// 'auth' wins first: non-GET, Authorization header present, /auth/ path, or
// /fictional-login path — these responses are never cached.
// 'shell' = same-origin URL in the precached shell set or the marked.js CDN.
// 'public' = everything else the SW should handle (API content, navigation
// outside the precache set for same-origin deploys, etc.).
function classify(request) {
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    request.headers.get('Authorization') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/fictional-login')
  ) {
    return 'auth';
  }

  if (
    (url.origin === self.location.origin && SHELL_URL_SET.has(request.url)) ||
    request.url === MARKED_CDN
  ) {
    return 'shell';
  }

  // Treat as public API content if it targets either the configured API origin
  // or is a same-origin non-navigation GET not in the shell set (same-origin
  // deploy where API_BASE_URL is empty).
  const targetsApi =
    (API_ORIGIN && url.origin === API_ORIGIN) ||
    (url.origin === self.location.origin && request.mode !== 'navigate');

  if (targetsApi) return 'public';

  return null; // let the browser handle it (other cross-origin, etc.)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await cache.addAll(SHELL_URLS);
      await cache.add(MARKED_CDN).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== CONTENT_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FLUSH_CONTENT_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
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
      return new Response(OFFLINE_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    throw _;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CONTENT_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((response) => {
    if (response.ok && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  });

  if (cached) {
    // Return stale copy immediately; background fetch updates the cache.
    networkFetch.catch(() => {});
    return cached;
  }

  // Cache miss: await the network and cache a successful response.
  const response = await networkFetch;
  return response;
}

self.addEventListener('fetch', (event) => {
  const cls = classify(event.request);

  if (cls === 'auth') {
    // Never cache — fetch with no-store and return immediately.
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (cls === 'shell') {
    event.respondWith(cacheFirstWithOfflineFallback(event.request));
    return;
  }

  if (cls === 'public') {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // null: cross-origin requests the SW should not intercept — let them pass.
});
