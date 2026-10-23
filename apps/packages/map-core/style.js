// The map's basemap style, shared by the Pip-Boy MAPPA tab and the CMS filter
// preview: the phosphor theme triplets, the basemap tone tokens, and the SVG
// filter graph built from them. Pure, apart from `ensureTintFilter`, which
// writes the one hidden <filter> node into the document it is given.
//
// The tokens were chosen in apps/pip-boy/tools/map-lab, which builds its filter
// with `filterMarkup` from this file, so the lab and both apps cannot disagree.

export const PHOSPHOR_THEMES = {
    green: { rgb: '51, 255, 102', brightRgb: '170, 255, 192' },
    amber: { rgb: '255, 176, 46', brightRgb: '255, 210, 122' },
    white: { rgb: '240, 240, 240', brightRgb: '255, 255, 255' },
};

/**
 * The basemap's levels, as a fraction of the phosphor colour, design tokens of
 * pipboy-map-tab. CARTO's dark_nolabels water (#2c353c, L 0.202) is lighter
 * than its land (#0e0e0e, L 0.055), so a linear gain made the sea the
 * brightest surface on screen. Water is masked out and set on its own.
 *   land   — the land fill
 *   water  — the sea, below the land
 *   lineLo — coastlines and minor roads
 *   lineHi — major roads, the basemap's ceiling (markers sit above it)
 */
export const MAP_TONE = { land: 0.2, water: 0.05, lineLo: 0.35, lineHi: 0.55 };

/** The tint's saturation: the theme colour pulled toward its own luminance. */
export const MAP_TINT_SAT = 0.8;

/** Water's blue cast `B − R` (16/255) times this is the mask alpha: ≈1 on water, 0 on land. */
export const MAP_WATER_MASK_GAIN = 18;

/** The id both apps reference as `filter: url(#…)` on the tile pane. */
export const MAP_TINT_FILTER_ID = 'pb-phosphor-tint';

// Rec. 709 luminance — the weights CSS grayscale() uses.
const LUMA = [0.2126, 0.7152, 0.0722];
const LAND_L = 0.055;

const f4 = (n) => +n.toFixed(4);
const parseRgb = (rgb) => rgb.split(',').map((n) => Number(n) / 255);

/** The land/road curve's knots `[input L, output level]`, piecewise linear between them. */
const curveKnots = (tone) => [[0, 0], [LAND_L, tone.land], [0.13, tone.lineLo], [0.5, tone.lineHi], [1, tone.lineHi]];

/** The output level for an input luminance on the land/road curve. */
export function toneLevel(L, tone = MAP_TONE) {
    const knots = curveKnots(tone);
    for (let i = 1; i < knots.length; i++) {
        const [x0, y0] = knots[i - 1];
        const [x1, y1] = knots[i];
        if (L <= x1) return y0 + ((L - x0) / (x1 - x0)) * (y1 - y0);
    }
    return tone.lineHi;
}

/** The curve sampled at 256 evenly spaced luminances, for feComponentTransfer's `tableValues`. */
export function toneTable(tone = MAP_TONE) {
    return Array.from({ length: 256 }, (_, i) => f4(toneLevel(i / 255, tone)));
}

/** The theme colour (0–1 channels) desaturated toward its own luminance. */
export function tintColour(rgb, sat = MAP_TINT_SAT) {
    const c = parseRgb(rgb);
    const y = c.reduce((sum, ch, i) => sum + ch * LUMA[i], 0);
    return c.map((ch) => f4(y + (ch - y) * sat));
}

/**
 * The filter's output colour (0–1 channels) for a basemap pixel — the same
 * maths the SVG graph runs, for tests and for reasoning about contrast.
 */
export function filterOutput(pixel, rgb, { tone = MAP_TONE, sat = MAP_TINT_SAT } = {}) {
    const [r, g, b] = pixel.map((n) => n / 255);
    const L = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
    const mask = Math.min(1, Math.max(0, MAP_WATER_MASK_GAIN * (b - r)));
    const level = toneLevel(L, tone) * (1 - mask) + tone.water * mask;
    return tintColour(rgb, sat).map((ch) => Math.min(1, ch * level));
}

/**
 * The filter's primitives:
 *   lum   — every channel set to the pixel's luminance
 *   base  — lum through the land/road curve
 *   wm    — alpha = MAP_WATER_MASK_GAIN · (B − R): the water mask
 *   water — a flood at the water level, kept where the mask is
 *   then base and water merged, and tinted by the desaturated theme colour.
 */
export function filterMarkup(rgb, { tone = MAP_TONE, sat = MAP_TINT_SAT } = {}) {
    const lumRow = `${LUMA.join(' ')} 0 0`;
    const table = toneTable(tone).join(' ');
    const k = MAP_WATER_MASK_GAIN;
    const w = Math.round(tone.water * 255);
    const [cr, cg, cb] = tintColour(rgb, sat);
    return [
        `<feColorMatrix in="SourceGraphic" type="matrix" values="${lumRow}  ${lumRow}  ${lumRow}  0 0 0 0 1" result="lum"/>`,
        `<feComponentTransfer in="lum" result="base">`,
        `<feFuncR type="table" tableValues="${table}"/>`,
        `<feFuncG type="table" tableValues="${table}"/>`,
        `<feFuncB type="table" tableValues="${table}"/>`,
        `</feComponentTransfer>`,
        `<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${-k} 0 ${k} 0 0" result="wm"/>`,
        `<feFlood flood-color="rgb(${w},${w},${w})" result="wf"/>`,
        `<feComposite in="wf" in2="wm" operator="in" result="water"/>`,
        `<feMerge result="merged"><feMergeNode in="base"/><feMergeNode in="water"/></feMerge>`,
        `<feColorMatrix in="merged" type="matrix" values="${cr} 0 0 0 0  0 ${cg} 0 0 0  0 0 ${cb} 0 0  0 0 0 1 0"/>`,
    ].join('');
}

/**
 * The single hidden <svg> holding the tint filter in `doc`, created on first
 * use, its graph rebuilt from `rgb`. Replacing the children keeps the <filter>
 * element, and so every CSS reference to it, in place: a mounted map re-tints
 * without a remount.
 */
export function ensureTintFilter(doc, rgb) {
    let filter = doc.getElementById(MAP_TINT_FILTER_ID);
    if (!filter) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = doc.createElementNS(NS, 'svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        filter = doc.createElementNS(NS, 'filter');
        filter.id = MAP_TINT_FILTER_ID;
        // The default linearRGB washes the dark basemap out.
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        svg.appendChild(filter);
        (doc.body ?? doc.documentElement).appendChild(svg);
    }
    filter.innerHTML = filterMarkup(rgb);
    return filter;
}
