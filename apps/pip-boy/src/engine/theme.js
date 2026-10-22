// Phosphor color theme — the pip-boy analog of apps/terminal's phosphor
// preset swap (config.js's applyConfig()). Every rule in pipboy.css derives
// its phosphor color from the `--phosphor-rgb`/`--phosphor-bright-rgb`
// channel-triplet custom properties, so switching the active theme is
// exactly this one choke point setting those two properties — no other rule
// needs to know the theme changed.
//
// The map's theme-derived tokens are set here too: the basemap tint (an SVG
// feColorMatrix built from the same triplet) and the contrasting marker colour
// (`--map-marker-rgb`), so a mounted MAPPA tab re-tints with no remount.

const AMBER_RGB = '255, 176, 46';
const GREEN_RGB = '51, 255, 102';

const PHOSPHOR_THEMES = {
    green: { rgb: GREEN_RGB, brightRgb: '170, 255, 192', markerRgb: AMBER_RGB },
    amber: { rgb: AMBER_RGB, brightRgb: '255, 210, 122', markerRgb: GREEN_RGB },
    white: { rgb: '240, 240, 240', brightRgb: '255, 255, 255', markerRgb: GREEN_RGB },
};

/**
 * The basemap tint's gain, a design token of pipboy-map-tab. The previous fixed
 * chain (grayscale → sepia → hue-rotate(90deg) → saturate(8) → brightness(2))
 * works out to green ≈ 3.98 × luminance until it clips, so 4 keeps the green
 * theme's brightness.
 */
export const MAP_TINT_GAIN = 4;

/** The id `pipboy.css` references as `filter: url(#…)` on the tile pane. */
export const MAP_TINT_FILTER_ID = 'pb-phosphor-tint';

// Rec. 709 luminance — the weights CSS grayscale() uses.
const LUMA = [0.2126, 0.7152, 0.0722];

/**
 * The feColorMatrix `values` mapping each pixel's luminance onto the theme
 * colour `c = rgb / 255`, scaled by the gain: every output channel is
 * `k · c · L`, alpha passes through.
 */
export function tintMatrix(rgb, gain = MAP_TINT_GAIN) {
    const rows = rgb.split(',').map((n) => {
        const c = (gain * Number(n)) / 255;
        return [...LUMA.map((w) => +(c * w).toFixed(4)), 0, 0];
    });
    return [...rows, [0, 0, 0, 1, 0]].map((r) => r.join(' ')).join('  ');
}

/** The single hidden <svg> holding the tint filter, created on first use. */
function tintMatrixNode() {
    const existing = document.getElementById(MAP_TINT_FILTER_ID);
    if (existing) return existing.querySelector('feColorMatrix');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    const filter = document.createElementNS(NS, 'filter');
    filter.id = MAP_TINT_FILTER_ID;
    // The default linearRGB washes the dark basemap out.
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const matrix = document.createElementNS(NS, 'feColorMatrix');
    matrix.setAttribute('type', 'matrix');
    filter.appendChild(matrix);
    svg.appendChild(filter);
    (document.body ?? document.documentElement).appendChild(svg);
    return matrix;
}

export function applyPhosphorTheme(color) {
    const theme = PHOSPHOR_THEMES[color] || PHOSPHOR_THEMES.green;
    const root = document.documentElement.style;
    root.setProperty('--phosphor-rgb', theme.rgb);
    root.setProperty('--phosphor-bright-rgb', theme.brightRgb);
    root.setProperty('--map-marker-rgb', theme.markerRgb);
    tintMatrixNode().setAttribute('values', tintMatrix(theme.rgb));
}
