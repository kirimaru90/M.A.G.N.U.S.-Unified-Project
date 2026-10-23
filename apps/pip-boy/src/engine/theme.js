// Phosphor color theme — the pip-boy analog of apps/terminal's phosphor
// preset swap (config.js's applyConfig()). Every rule in pipboy.css derives
// its phosphor color from the `--phosphor-rgb`/`--phosphor-bright-rgb`
// channel-triplet custom properties, so switching the active theme is
// exactly this one choke point setting those two properties — no other rule
// needs to know the theme changed.
//
// The map's basemap tint is set here too: an SVG filter built from the same
// triplet, so a mounted MAPPA tab re-tints with no remount. Markers need
// nothing extra: they draw in the theme's own `--phosphor-bright`.
//
// The triplets, the basemap tokens and the filter graph live in the shared
// map core (apps/packages/map-core/style.js), so the CMS filter preview builds
// exactly the same filter.

import { PHOSPHOR_THEMES, ensureTintFilter } from '../shared/map-core/style.js';

export function applyPhosphorTheme(color) {
    const theme = PHOSPHOR_THEMES[color] || PHOSPHOR_THEMES.green;
    const root = document.documentElement.style;
    root.setProperty('--phosphor-rgb', theme.rgb);
    root.setProperty('--phosphor-bright-rgb', theme.brightRgb);
    ensureTintFilter(document, theme.rgb);
}
