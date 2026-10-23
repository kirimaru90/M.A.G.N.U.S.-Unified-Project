// Serves the map lab on localhost with the CARTO key stamped in memory.
// Dependency-free, like tests/static-server.mjs. See README.md.
//
// A page opened from disk can neither read .env nor load the vendored Leaflet
// (ESM-only; module scripts do not load from file://), so the lab needs a
// server. Stamping here, in memory, also keeps the key out of every file.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const LAB_DIR = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = fileURLToPath(new URL('../../', import.meta.url)); // apps/pip-boy/
const ENV_FILE = fileURLToPath(new URL('../../../../.env', import.meta.url)); // repo root
const PORT = Number(process.env.MAP_LAB_PORT) || 5180;
const HOST = '127.0.0.1';

// Only what the page needs from the app: the vendored Leaflet and the synced
// map core (tokens, tinted tile layer and its worker, icons). Nothing else under apps/pip-boy is
// reachable.
const SERVED_PREFIXES = ['/src/vendor/leaflet/', '/src/shared/map-core/'];

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

/** CARTO_BASEMAP_KEY from the environment, else from the repo-root .env; '' when neither has it. */
async function cartoKey() {
    if (process.env.CARTO_BASEMAP_KEY) return process.env.CARTO_BASEMAP_KEY.trim();
    try {
        const env = await readFile(ENV_FILE, 'utf8');
        const line = env.split(/\r?\n/).find((l) => /^\s*CARTO_BASEMAP_KEY\s*=/.test(l));
        return line ? line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
    } catch {
        return '';
    }
}

const key = await cartoKey();

async function handle(req, res) {
    const path = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);

    if (path === '/' || path === '/index.html') {
        const page = await readFile(join(LAB_DIR, 'map-lab.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        // The quoted literal, not the mention in the page's header comment.
        res.end(page.replace("'__CARTO_KEY__'", JSON.stringify(key)));
        return;
    }

    if (!SERVED_PREFIXES.some((p) => path.startsWith(p))) {
        res.writeHead(404).end();
        return;
    }
    const file = normalize(join(APP_ROOT, path));
    if (!file.startsWith(normalize(APP_ROOT) + (APP_ROOT.endsWith(sep) ? '' : sep))) {
        res.writeHead(403).end();
        return;
    }
    try {
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(body);
    } catch {
        res.writeHead(404).end();
    }
}

function openBrowser(url) {
    const [cmd, args] =
        process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
        : process.platform === 'darwin' ? ['open', [url]]
        : ['xdg-open', [url]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

createServer((req, res) => {
    handle(req, res).catch(() => res.writeHead(500).end());
}).listen(PORT, HOST, () => {
    const url = `http://localhost:${PORT}/`;
    console.log(`Map lab: ${url}`);
    if (!key) {
        console.warn('No CARTO_BASEMAP_KEY in the environment or the repo-root .env: tiles will show "API KEY REQUIRED".');
    }
    console.log('Ctrl+C to stop.');
    if (!process.env.MAP_LAB_NO_OPEN) openBrowser(url);
});
