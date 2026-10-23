// Phosphor color theme — the pip-boy analog of apps/terminal's phosphor
// preset swap (config.js's applyConfig()). Every rule in pipboy.css derives
// its phosphor color from the `--phosphor-rgb`/`--phosphor-bright-rgb`
// channel-triplet custom properties, so switching the active theme is
// exactly this one choke point setting those two properties — no other rule
// needs to know the theme changed.
//
// The map's basemap tint follows from here too, without this module knowing a
// map exists: the triplet is kept behind `currentPhosphorRgb()` for a MAPPA tab
// that mounts later, and a `pb-phosphor-change` event (`detail.rgb`) on
// `document` tells a mounted one to re-tint its tiles in place. Markers need
// nothing extra: they draw in the theme's own `--phosphor-bright`.
//
// The triplets, the basemap tokens and the tint live in the shared map core
// (apps/packages/map-core/style.js), so the CMS filter preview tints exactly
// the same way.

import { PHOSPHOR_THEMES } from '../shared/map-core/style.js';

let currentRgb = PHOSPHOR_THEMES.green.rgb;

/** The active theme's triplet, which the map's tiles are tinted with. */
export const currentPhosphorRgb = () => currentRgb;

export function applyPhosphorTheme(color) {
    const theme = PHOSPHOR_THEMES[color] || PHOSPHOR_THEMES.green;
    const root = document.documentElement.style;
    root.setProperty('--phosphor-rgb', theme.rgb);
    root.setProperty('--phosphor-bright-rgb', theme.brightRgb);
    currentRgb = theme.rgb;
    document.dispatchEvent(new CustomEvent('pb-phosphor-change', { detail: { rgb: theme.rgb } }));
}
