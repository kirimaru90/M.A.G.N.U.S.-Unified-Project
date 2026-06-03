## 1. Font Assets & CSS Foundation

- [x] 1.1 Download `FixedsysExcelsior.ttf` and place it at `fonts/FixedsysExcelsior.ttf`
- [x] 1.2 Add `@font-face` rule in `src/styles/terminal.css` declaring `'Fixedsys Excelsior'` from `../fonts/FixedsysExcelsior.ttf`
- [x] 1.3 Add `.font-fixedsys` and `.font-sharetech` utility classes to `terminal.css`
- [x] 1.4 Add `--phosphor-rgb: 51,255,0` CSS custom property to `:root` in `terminal.css`
- [x] 1.5 Add Google Fonts preconnect and Share Tech Mono `<link>` tags to `index.html`

## 2. Runtime Config

- [x] 2.1 Create `src/config.js` exporting `APP_CONFIG = { useModernFont: false }`
- [x] 2.2 In `src/main.js` (or `src/screens/terminal.js`), import `APP_CONFIG` and apply `.font-fixedsys` or `.font-sharetech` to `document.body` on DOMContentLoaded

## 3. Flicker Reduction

- [x] 3.1 Update `.crt::after` animation duration in `terminal.css` from `0.15s` to `10s`
- [x] 3.2 Rewrite `@keyframes crt-flicker` so the opacity change occupies ≤ 5% of the cycle (e.g. flash at 92%, 95%, 98% keyframes; transparent otherwise)

## 4. CRT Wave Engine Module

- [x] 4.1 Create `src/engine/crt-wave.js` exporting `mountCrtWave(containerEl, params)`
- [x] 4.2 Implement `injectOverlays(containerEl)` — append `.crt-scanlines`, `.crt-vignette`, `.crt-flicker` divs with correct z-indices and `pointer-events: none`
- [x] 4.3 Add `.crt-scanlines`, `.crt-vignette`, `.crt-flicker` CSS rules to `terminal.css` (absolute inset, pointer-events none, z-index 2/3/4)
- [x] 4.4 Implement `setVignette(el, strength)` that sets the radial-gradient background on `.crt-vignette`; initialize to strength 1.0 on mount
- [x] 4.5 Implement `spawnWaves(params)` and `rand(min, max)` helpers per the reference guide
- [x] 4.6 Implement `gaussian(dist, width)` and `tick(t, rows, waves, params)` per the reference guide, reading `--phosphor-rgb` from computed styles for glow color
- [x] 4.7 Implement the `startLoop` / `destroy` rAF pattern; expose `destroy` as the return value of `mountCrtWave`
- [x] 4.8 Ensure all `.crt-line` elements inside the container are indexed with `data-row` before the first frame

## 5. Terminal Integration

- [x] 5.1 Ensure existing terminal content lines have or receive the `.crt-line` class (wrap in JS if not already block elements)
- [x] 5.2 Apply `position: relative; z-index: 5` to all text content inside `#terminal-container` so it renders above overlays
- [x] 5.3 Import `mountCrtWave` in `src/screens/terminal.js` and call it with `#terminal-container` after mount; store the `destroy` reference
- [x] 5.4 Call `destroy()` when the terminal unmounts or `onDisconnect` fires

## 6. Live Controls Panel

- [x] 6.1 Create `src/engine/crt-controls.js` exporting `mountCrtControls(waveParams, onParamChange, onVignetteChange)`
- [x] 6.2 Render a `<div id="crt-controls">` appended to `<body>` with all 7 sliders (IDs and ranges per reference guide Step 5)
- [x] 6.3 Wire slider `input` events: non-vignette sliders call `onParamChange(key, value)` which respawns waves; vignette slider calls `onVignetteChange(value)`
- [x] 6.4 Style `#crt-controls` in `terminal.css`: absolutely positioned top-right, translucent dark background, green text, z-index above overlays

## 7. Verification

- [ ] 7.1 Open `index.html` in browser — confirm Fixedsys Excelsior font renders on terminal text
- [ ] 7.2 Set `useModernFont: true` in `src/config.js`, reload — confirm Share Tech Mono renders
- [ ] 7.3 Observe flicker: confirm it occurs roughly once every 8–12 seconds, not constantly
- [ ] 7.4 Observe wave effect on terminal rows — confirm brightness gradient moves vertically over time
- [ ] 7.5 Adjust each slider in the controls panel — confirm wave respawns / vignette updates
- [ ] 7.6 Open browser DevTools → confirm no errors and no pointer-event blockage on buttons/inputs
