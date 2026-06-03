## Why

The current CRT simulation relies solely on a fast CSS flicker animation (0.15 s) that is visually fatiguing and lacks depth. Adding a vertical phosphor brightness-wave effect and a configurable period-accurate font will make the terminal feel authentically worn and alive without increasing cognitive load.

## What Changes

- Reduce flicker animation frequency to a calmer interval (≈ 8–12 s) so occasional glitches feel incidental rather than constant strobing
- Inject three JS-managed overlay divs (scanlines, vignette, flicker) inside the terminal container — no `::before` / `::after` pseudo-elements needed for the wave
- Implement a per-row phosphor brightness-wave engine driven by `requestAnimationFrame` as documented in `reference/crt-wave-effect.md`, with live controls panel (sliders for brightness, wave width, wave count, speed, vignette strength)
- Load **Fixedsys Excelsior** as the default terminal font (self-hosted TTF); fall back to Share Tech Mono (Google Fonts CDN) when the runtime config flag `useModernFont` is `true`

## Capabilities

### New Capabilities
- `crt-phosphor-wave`: Per-row Gaussian brightness-wave animation layered on the terminal via JS-injected overlays, with a live parameter controls panel and clean `destroy()` teardown
- `crt-font-config`: Runtime-configurable terminal font: Fixedsys Excelsior by default (`useModernFont: false`), Share Tech Mono when `useModernFont: true`; phosphor color token exposed as a shared CSS custom property

### Modified Capabilities

## Impact

- `src/styles/terminal.css` — reduce `crt-flicker` animation duration; add `@font-face` for Fixedsys Excelsior; add `.font-fixedsys` / `.font-sharetech` utility classes
- `src/screens/terminal.js` — inject overlay divs, start/destroy wave rAF loop, apply font class based on runtime config
- `index.html` — add `<link>` for Share Tech Mono (Google Fonts); add Fixedsys Excelsior font file reference
- Static assets — add `fonts/FixedsysExcelsior.ttf` (self-hosted)
- No breaking changes to JSON content authoring or node-graph format
