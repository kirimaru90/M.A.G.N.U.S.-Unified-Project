## 1. Sheet shell owns immersive state

- [x] 1.1 In `apps/pip-boy/src/screens/sheet.js`, add ephemeral `immersive` view state initialised to `false` on every `renderSheet` (next to `editMode`), never persisted.
- [x] 1.2 Add `setImmersive(bool)` (or `enterImmersive`/`exitImmersive`) that toggles a `pb-immersive` class on a stable shell element (sheet root or `.pb-screen`), drives any imperative chrome bits (subtab row, resource band), and is idempotent.
- [x] 1.3 Pass the immersive enter/exit hook to the map tab through the existing `ctx` object built in `renderActiveTab()`.
- [x] 1.4 Ensure a re-mount / re-render resets immersive to off (falls out of the `false` default; verify no path leaves the class stamped).

## 2. Immersive layout (CSS)

- [x] 2.1 In `apps/pip-boy/src/styles/pipboy.css`, under `.pb-immersive`, hide `.pb-header`, `.pb-tabs`, `.pb-subtabs`, `#pb-sheet-strip`, `.pb-resource-band`, and `.pb-footer`, and let `#pb-sheet-content` / `.pb-map-canvas` fill `.pb-screen`.
- [x] 2.2 Keep the bezel and CRT overlays (scanline, vignette, sweep) rendering above the enlarged canvas; confirm the statusbar decision from design.md Open Questions (default: keep statusbar).
- [x] 2.3 Add the expand transition, structured so the size-driving dimension reaches its final value before Leaflet measures (see task 4.2); respect `prefers-reduced-motion`.

## 3. Breadcrumb as floating overlay

- [x] 3.1 Reposition `.pb-map-zone` from a reserved flex row to an absolutely-positioned overlay on `.pb-map-canvas`, phosphor-styled like the attribution/search controls, with `pointer-events` managed so it does not intercept map gestures.
- [x] 3.2 Verify `renderZone()` still writes into the same `zoneEl` with left-truncation and `CHAIN_MAX` elision intact, and that the overlay is visible in both normal and immersive modes.

## 4. Map tab: toggle, Escape, and level-of-detail revalidation

- [x] 4.1 In `apps/pip-boy/src/tabs/map.js`, add an immersive toggle control to the canvas corner cluster beside the search lens, with `L.DomEvent.disableClickPropagation` so a tap never reaches the map; wire it to the ctx enter/exit hook.
- [x] 4.2 On every enter/leave, run `map.invalidateSize()` → `syncMarkers(vrNow())` → `renderZone()`, triggered on the canvas `transitionend` (guarded to the size-driving property) with a timeout fallback equal to the transition duration for the reduced-motion / no-size-delta case.
- [x] 4.3 Install an `Escape` keydown handler on entering immersive and remove it on leaving (bind/unbind, matching the wake-lock teardown pattern); scope it so the search box's own `Escape` (collapse) wins when the search box is open, and only an `Escape` with search closed exits immersive.
- [x] 4.4 Add a deterministic test seam consistent with `__PB_MAP__` (immersive state observable from the live DOM via the shell class; add a transition-duration override akin to `__PB_MAP_ATTRIBUTION_MS__` if the transition would slow tests).

## 5. Tests (Playwright, apps/pip-boy)

- [x] 5.1 Add a spec (e.g. `apps/pip-boy/tests/map-fullscreen.spec.ts`) asserting: activating the toggle hides `.pb-header`/`.pb-tabs`/`.pb-subtabs`/`.pb-resource-band`/`.pb-footer` and the reserved breadcrumb row, and the canvas fills `.pb-screen` while bezel + CRT overlays remain.
- [x] 5.2 Assert exit via the toggle **and** via `Escape` both restore normal chrome (including the first-level tab bar), and that `Escape` with the search box open collapses search instead of exiting immersive.
- [x] 5.3 Assert immersive resets to off after the sheet is re-opened / the `MAPPA` tab is re-mounted.
- [x] 5.4 Assert the floating breadcrumb is visible in immersive and still names the entered chain, and that a pan/zoom beneath it reaches the map.
- [x] 5.5 Assert level-of-detail revalidation: with a controlled viewport, toggling immersive changes `__PB_MAP__.getSize()`, `invalidateSize` has run (no stale/off-centre view), and the visible marker set is re-synced to the new `vr`.

## 6. Verify

- [x] 6.1 Run `npm test` (Playwright) from `apps/pip-boy` and confirm the new spec and the existing map specs (`map-tab`, `map-search`, `map-geometry`, `map-place-focus`, `map-attribution`) all pass.
