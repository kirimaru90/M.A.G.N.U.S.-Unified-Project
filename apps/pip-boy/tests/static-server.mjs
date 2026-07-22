// Minimal, dependency-free static file server for the Playwright suite.
// Serves the pip-boy directory (apps/pip-boy) so tests exercise the real
// index.html + ES modules over HTTP. Correct JS MIME types matter: Chromium
// refuses `<script type="module">` served as anything but a JS MIME.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // apps/pip-boy/
const PORT = Number(process.env.PORT) || 5174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Test-only per-path response overrides, controllable via a tiny JSON API so
// specs can exercise real browser HTTP-cache behavior (Cache-Control headers
// only take effect over a genuine network round trip — Playwright's
// context.route interception bypasses the HTTP cache entirely) without
// mutating files on disk. Keyed by pathname; a spec sets one, asserts, then
// clears it so state never leaks into later tests. `count` lets a spec tell
// whether a given request actually reached the server or was served from the
// browser's own HTTP cache without a network round trip.
const overrides = new Map();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/__test-override__') {
      if (req.method === 'PUT') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const { path, body, headers } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        // Preserve the hit counter across body updates for the same path — a
        // spec updates the body mid-test to simulate a deploy, and needs the
        // count to keep accumulating so it can tell whether a later request
        // actually reached the server.
        const count = overrides.get(path)?.count ?? 0;
        overrides.set(path, { body, headers: headers || {}, count });
        res.writeHead(204).end();
        return;
      }
      if (req.method === 'DELETE') {
        overrides.delete(url.searchParams.get('path'));
        res.writeHead(204).end();
        return;
      }
      if (req.method === 'GET') {
        const entry = overrides.get(url.searchParams.get('path'));
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ count: entry?.count ?? 0 }));
        return;
      }
    }

    const override = overrides.get(pathname);
    if (override) {
      override.count += 1;
      res.writeHead(200, {
        'Content-Type': MIME[extname(pathname).toLowerCase()] || 'application/octet-stream',
        ...override.headers,
      });
      res.end(override.body);
      return;
    }

    let filePathname = pathname;
    if (filePathname === '/' || filePathname.endsWith('/')) filePathname += 'index.html';
    const filePath = normalize(join(ROOT, filePathname));
    // Path-traversal guard: resolved file must stay under ROOT.
    if (filePath !== ROOT.slice(0, -1) && !filePath.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => console.log(`[static-server] http://127.0.0.1:${PORT} serving ${ROOT}`));
