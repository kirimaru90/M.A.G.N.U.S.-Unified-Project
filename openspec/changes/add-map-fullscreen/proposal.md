## Why

The `MAPPA` tab shares its screen with the sheet's chrome — the PA header, the tab bar, the footer, and the breadcrumb row — so the actual map canvas is a fraction of an already-small phone screen. Reading a dense campaign map (nested regions, vaults, rooms) is cramped, and on an installed PWA there is no browser-level way to reclaim the space. A player wants to be able to give the map the whole screen when they are actually navigating it.

## What Changes

- Add an **immersive (full-screen) mode** to the `MAPPA` tab: a toggle that expands the Leaflet canvas to fill the entire CRT screen, hiding the PA header, the first-level tab bar, the subtab row, the footer, and the reserved breadcrumb row — while keeping the physical bezel and the CRT overlays (scanline, vignette, sweep) so the map still reads as filling the Pip-Boy, not escaping it.
- Add an **explicit exit affordance**: a toggle control in the canvas's corner control cluster (beside the existing search lens) and the `Escape` key. **BREAKING** relative to the current spec: immersive mode hides the always-visible first-level tab bar, so the tab bar is no longer the only way to leave — the map tab must now provide its own exit, and this is a deliberate, documented exception to the "tab bar always visible" invariant of `pipboy-map-tab`.
- Move the zone **breadcrumb** from a reserved row above the canvas to a floating overlay on the canvas, so it survives into immersive mode (still answering "where am I") without costing vertical space.
- Recompute the map's **level of detail** on toggle: entering/leaving immersive resizes the canvas, and because visibility is a function of viewport size (`vr` in metres derives from `map.getSize()`), the set of visible places changes with the resize — the toggle must revalidate Leaflet's size and re-sync markers and the breadcrumb.
- Immersive is **ephemeral view state** (like editor mode): off on every sheet open, never persisted.

## Capabilities

### New Capabilities
<!-- None: full-screen is behavior of the existing map tab, not a new capability. -->

### Modified Capabilities
- `pipboy-map-tab`: add a full-screen/immersive requirement; amend the existing "map surface owns horizontal gestures" requirement so that hiding the first-level tab bar in immersive mode is permitted **provided** the tab exposes its own exit (toggle button + `Escape`); state that the breadcrumb is presented as a canvas overlay; and require the level-of-detail set to be revalidated when the canvas is resized by a mode toggle.

## Impact

- **Code**: `apps/pip-boy/src/screens/sheet.js` (owns immersive state; hides/shows its own chrome; exposes enter/exit to the tab via ctx), `apps/pip-boy/src/tabs/map.js` (toggle control, `Escape` handling, breadcrumb-as-overlay, `invalidateSize` + `syncMarkers` + `renderZone` on toggle), `apps/pip-boy/src/styles/pipboy.css` (immersive layout, floating breadcrumb, corner control cluster).
- **No API, data, or dependency changes.** Leaflet is already vendored; no new library.
- **Spec**: delta to `openspec/specs/pipboy-map-tab/spec.md`.

## Testing

Verified by Playwright against the live `apps/pip-boy` DOM (the tab already has `apps/pip-boy/tests/map-tab.spec.ts` and siblings driving `__PB_MAP__`):

- **e2e (Playwright)** — Entering immersive: toggle control hides the header/tab bar/footer/breadcrumb row and the canvas fills the screen. Exiting via the toggle **and** via `Escape` both restore normal chrome. Immersive resets to off when the sheet is re-opened / tab is re-mounted. The floating breadcrumb remains visible in immersive and still names the entered chain.
- **e2e (Playwright)** — Level-of-detail revalidation: with a controlled viewport, toggling immersive changes `map.getSize()` and the visible marker set is re-synced to the new `vr` (assert marker count/visibility before vs after via `__PB_MAP__`), and `invalidateSize` has run (no stale grey tiles / correct centre).
- **Not covered by tests**: the exact easing/timing of the expand transition is a visual design token, asserted only insofar as the post-toggle `invalidateSize` fires after the canvas reaches its final size.
