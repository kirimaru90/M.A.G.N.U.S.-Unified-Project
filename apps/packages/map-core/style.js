// The map's basemap style, shared by the Pip-Boy MAPPA tab and the CMS filter
// preview: the phosphor theme triplets, the basemap tone tokens, and the tint
// built from them, as a reference function (`filterOutput`) and as the lookup
// tables the tinted tile layer runs on each tile's pixels (`tintTables`,
// `tintPixels`). Pure: no DOM.
//
// The tokens were chosen in apps/pip-boy/tools/map-lab, which tints its tiles
// through the same layer, so the lab and both apps cannot disagree.

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

/** The curve sampled at 256 evenly spaced luminances, one per 8-bit level. */
export function toneTable(tone = MAP_TONE) {
    return Array.from({ length: 256 }, (_, i) => toneLevel(i / 255, tone));
}

/** The theme colour (0–1 channels) desaturated toward its own luminance. */
export function tintColour(rgb, sat = MAP_TINT_SAT) {
    const c = parseRgb(rgb);
    const y = c.reduce((sum, ch, i) => sum + ch * LUMA[i], 0);
    return c.map((ch) => f4(y + (ch - y) * sat));
}

/**
 * The tint's output colour (0–1 channels) for a basemap pixel: the reference
 * maths, unrounded. `tintPixels` is tested against it, and the map lab's
 * contrast figures use it.
 *   luminance — through the land/road curve
 *   mask      — MAP_WATER_MASK_GAIN · (B − R), ≈1 on water, 0 on land
 *   level     — the curve's level, with the water level where the mask is
 *   then tinted by the desaturated theme colour.
 */
export function filterOutput(pixel, rgb, { tone = MAP_TONE, sat = MAP_TINT_SAT } = {}) {
    const [r, g, b] = pixel.map((n) => n / 255);
    const L = r * LUMA[0] + g * LUMA[1] + b * LUMA[2];
    const mask = Math.min(1, Math.max(0, MAP_WATER_MASK_GAIN * (b - r)));
    const level = toneLevel(L, tone) * (1 - mask) + tone.water * mask;
    return tintColour(rgb, sat).map((ch) => Math.min(1, ch * level));
}

/**
 * The lookup tables `tintPixels` runs on, built once per tint:
 *   level — the land/road curve at each 8-bit luminance
 *   mask  — the water mask at each `B − R`, indexed by `B − R + 255`
 *   tint  — the desaturated theme colour, 0–1 channels
 *   water — the water level
 * Plain data, so it can be posted to a worker.
 */
export function tintTables(rgb, { tone = MAP_TONE, sat = MAP_TINT_SAT } = {}) {
    const mask = new Float32Array(511);
    for (let d = -255; d <= 255; d++) mask[d + 255] = Math.min(1, Math.max(0, (MAP_WATER_MASK_GAIN * d) / 255));
    return {
        level: Float32Array.from(toneTable(tone)),
        mask,
        tint: tintColour(rgb, sat),
        water: tone.water,
    };
}

/**
 * Tints RGBA bytes in place: `filterOutput` with the luminance rounded to
 * 8 bits, within 2/255 of it. Alpha passes through; `tables = null` leaves
 * the pixels untouched.
 */
export function tintPixels(data, tables) {
    if (!tables) return data;
    const { level, mask, water } = tables;
    const [tr, tg, tb] = tables.tint.map((ch) => ch * 255);
    for (let p = 0; p < data.length; p += 4) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const m = mask[b - r + 255];
        const v = level[Math.round(r * LUMA[0] + g * LUMA[1] + b * LUMA[2])] * (1 - m) + water * m;
        // Uint8ClampedArray rounds and clamps at 255.
        data[p] = tr * v;
        data[p + 1] = tg * v;
        data[p + 2] = tb * v;
    }
    return data;
}
