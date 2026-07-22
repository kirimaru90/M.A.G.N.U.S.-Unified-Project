// Phosphor color theme — the pip-boy analog of apps/terminal's phosphor
// preset swap (config.js's applyConfig()). Every rule in pipboy.css derives
// its phosphor color from the `--phosphor-rgb`/`--phosphor-bright-rgb`
// channel-triplet custom properties, so switching the active theme is
// exactly this one choke point setting those two properties — no other rule
// needs to know the theme changed.

const PHOSPHOR_THEMES = {
    green: { rgb: '51, 255, 102', brightRgb: '170, 255, 192' },
    amber: { rgb: '255, 176, 46', brightRgb: '255, 210, 122' },
    white: { rgb: '240, 240, 240', brightRgb: '255, 255, 255' },
};

export function applyPhosphorTheme(color) {
    const theme = PHOSPHOR_THEMES[color] || PHOSPHOR_THEMES.green;
    const root = document.documentElement.style;
    root.setProperty('--phosphor-rgb', theme.rgb);
    root.setProperty('--phosphor-bright-rgb', theme.brightRgb);
}
