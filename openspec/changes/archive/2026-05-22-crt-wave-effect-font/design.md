## Context

The terminal currently uses CSS `::before` / `::after` pseudo-elements on `.crt` for scanlines and flicker. The flicker animation runs at 0.15 s step-start — effectively ~6.6 Hz — which is visually aggressive for extended sessions. No phosphor depth or glow wave effect exists. The font is hardcoded to `Courier New`. The project is pure-static (no build step), so all new code must be vanilla JS/CSS.

## Goals / Non-Goals

**Goals:**
- Replace the rapid CSS flicker with an occasional glitch burst (≈ 8–12 s period) so it reads as ambient, not strobing
- Implement the phosphor brightness-wave engine from `reference/crt-wave-effect.md` as a self-contained JS module (`src/engine/crt-wave.js`) with a `destroy()` method
- Inject scanlines, vignette, and flicker as JS-managed `div` overlays inside `#terminal-container` so the module is portable and testable independently of pseudo-elements
- Load Fixedsys Excelsior as default font (self-hosted); switch to Share Tech Mono when `useModernFont: true` in runtime config
- Expose a live controls panel (7 sliders) driven by the wave engine params

**Non-Goals:**
- Modifying `index.html` structure beyond adding font `<link>` tags and one `<script>` config block
- Any server-side logic or build-time compilation
- Changing the Fallout green phosphor color default (`#33ff00` / `77,255,165`)

## Decisions

### D1 — Wave engine as a standalone ES module

**Decision:** Create `src/engine/crt-wave.js` exporting `{ mountCrtWave(containerEl, params) → destroy }`.

**Rationale:** Keeps wave logic isolated and reusable if the terminal is ever embedded in multiple contexts. `terminal.js` calls `mountCrtWave` on mount and stores the returned `destroy` for cleanup.

**Alternative considered:** Inlining the rAF loop directly in `terminal.js`. Rejected because it would entangle visual effect lifecycle with narrative state logic.

### D2 — Runtime config via `src/config.js`

**Decision:** Add a new `src/config.js` that exports `APP_CONFIG = { useModernFont: false, ... }`. `terminal.js` and the wave module import from it.

**Rationale:** Consistent with the existing `src/api/config.js` pattern. Operators can override the constant at deploy time without touching HTML or CSS.

**Alternative considered:** Reading from `window.APP_CONFIG` injected by a `<script>` block in `index.html`. Rejected because it breaks the existing ES-module import graph and makes config invisible to static analysis.

### D3 — Flicker reduction: CSS duration change + keyframe rework

**Decision:** Change `.crt::after` animation duration from `0.15s` to `10s` and rewrite `@keyframes crt-flicker` so the visible flash occupies only 3% of the cycle (matching the reference guide's `crt-greentint` pattern).

**Rationale:** The overlay divs injected by `crt-wave.js` handle per-row flicker internally. The global `::after` pseudo-element remains as a rare full-screen glitch, not a constant strobe.

**Alternative considered:** Removing `crt-flicker` entirely. Rejected — the occasional full-screen glitch is atmospherically important.

### D4 — Font loading strategy

**Decision:**
- Self-host `FixedsysExcelsior.ttf` at `fonts/FixedsysExcelsior.ttf` with a `@font-face` rule in `terminal.css`.
- Preload Share Tech Mono from Google Fonts CDN via a `<link>` in `index.html`.
- `terminal.js` applies `.font-fixedsys` or `.font-sharetech` class to `<body>` based on `APP_CONFIG.useModernFont`.

**Rationale:** Self-hosting avoids an external CDN dependency for the default path. The CDN fallback for Share Tech Mono is acceptable because `useModernFont: true` is an opt-in configuration, not the default experience.

### D5 — Controls panel placement

**Decision:** The wave controls panel is rendered as a `<div id="crt-controls">` appended to `<body>` (outside the terminal container), absolutely positioned top-right with a translucent dark background.

**Rationale:** Placing it outside the terminal avoids z-index conflicts with the overlay stack and keeps it independent of scroll containers.

## Risks / Trade-offs

- **rAF performance on low-end devices** → The wave engine skips frames automatically via `requestAnimationFrame` backpressure. Row count is bounded by visible DOM content, not a fixed canvas resolution.
- **Fixedsys Excelsior rendering on non-Windows** → The font includes TTF vector outlines for cross-platform use; however, hinting may differ from the original bitmap. Acceptable trade-off; the spec notes this explicitly.
- **Google Fonts CDN unavailability** → If CDN is unreachable and `useModernFont: true`, the browser falls back to the CSS stack (`'Courier New', monospace`). This is graceful degradation.
- **Overlay z-index conflicts** → The injected divs use z-index 2–4; terminal text content needs `position: relative; z-index: 5`. Any future UI widgets inside the terminal must be aware of this layering.
