// The CARTO basemap behind the MAPPA tab: its key, its tile URL, and the credit
// its terms require. One module so map.js and settings-popup.js share one
// wording and the Dockerfile has one obvious file to stamp.
//
// Coupled to sw.js's TILE_HOST_SUFFIX — change provider here and you must change
// it there too, along with the attribution, or the new provider's terms are unmet.

/**
 * Stamped at image-build time from the CARTO_BASEMAP_KEY build arg (see the
 * Dockerfile). The tracked source keeps the placeholder so the key never enters
 * git. It still ships to every browser: CARTO's per-key domain lock, not
 * secrecy, is what protects it.
 *
 * The placeholder must appear exactly once in this file — the Dockerfile's sed
 * rewrites every line it is on — so it is recognised below by shape, not by
 * comparing against a second copy of the literal.
 */
const STAMPED_KEY = '__CARTO_BASEMAP_KEY__';

/**
 * How long the basemap attribution stays on the map, in ms.
 *   null  → permanent. Required by the CARTO Basemaps Terms ("visible on the
 *           map itself … not hidden, faded or behind a click"). Default.
 *   5000  → collapse after five seconds, the OSM Attribution Guidelines'
 *           mechanism ("automatically after five seconds"), with CREDITI as the
 *           fallback. OSM-compliant, NOT CARTO-compliant: only use it if the
 *           basemap provider allows it.
 *
 * Deliberately not a player setting: whether the credit may be hidden is a
 * licence decision for whoever deploys, not for each player.
 */
export const ATTRIBUTION_COLLAPSE_MS = null;

const TILE_TEMPLATE = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';

/** An unstamped source still holds `__…__`; that, like an empty stamp, is no key. */
const usableKey = (key) => (typeof key === 'string' && key !== '' && !/^__.*__$/.test(key) ? key : '');

/**
 * The tile URL template, keyed when a key is stamped. With no key it is the
 * bare template: CARTO then serves its watermark, which is the honest signal
 * that the deploy is missing CARTO_BASEMAP_KEY — better than a bogus `?key=`.
 *
 * `__PB_CARTO_KEY__` exists only so the Playwright spec can exercise the keyed
 * branch without a build; nothing in the app sets it.
 */
export function tileUrl() {
    const key = usableKey(globalThis.__PB_CARTO_KEY__ ?? STAMPED_KEY);
    return key ? `${TILE_TEMPLATE}?key=${encodeURIComponent(key)}` : TILE_TEMPLATE;
}

const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
const CARTO_ATTRIBUTION_URL = 'https://carto.com/attribution';

const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

/** The credit the CARTO terms ask for, word for word, both names linked. */
export const ATTRIBUTION_HTML =
    `© ${link(OSM_COPYRIGHT_URL, 'OpenStreetMap contributors')}, © ${link(CARTO_ATTRIBUTION_URL, 'CARTO')}`;

/** The same two links, for the longer CREDITI wording. */
export const OSM_LINK_HTML = link(OSM_COPYRIGHT_URL, 'OpenStreetMap');
export const CARTO_LINK_HTML = link(CARTO_ATTRIBUTION_URL, 'CARTO');
