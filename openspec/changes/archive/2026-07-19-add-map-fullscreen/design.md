## Context

The `MAPPA` tab (`apps/pip-boy/src/tabs/map.js`) renders a Leaflet map into `#pb-sheet-content`. That element is one child among the sheet shell's siblings, all owned by `apps/pip-boy/src/screens/sheet.js`: `.pb-header` (PA control), `.pb-tabs` (first-level bar), `.pb-subtabs`, `#pb-sheet-strip`, `#pb-sheet-content`, `.pb-resource-band`, `.pb-footer`. All of this lives inside `.pb-screen`, which also carries the CRT overlays (scanline, vignette, sweep) and sits inside `.pb-case` between `.pb-statusbar` and the physical `.pb-bezel`.

The map tab therefore **cannot** hide the chrome it wants gone: that chrome is not its DOM. This is the central design constraint. The codebase is disciplined about ownership — e.g. the resources band is rendered by the sheet shell "outside the scrolling content" rather than duplicated per subtab, and chrome effects go through `chrome.js` (`showSheetNav`, `setEditorChrome`) rather than tabs poking the status bar. The design honours that discipline.

The map already has: a corner control cluster (the search lens `mountSearch()`), a floating attribution line and a `data-pb-no-swipe` marker that hands horizontal gestures to Leaflet. Visibility (level of detail) is geometry-driven: `vr = viewportRadius(map.getSize(), zoom, lat)` in metres, and `syncMarkers(vrNow())` reconciles markers by difference. There is already a `requestAnimationFrame(() => map.invalidateSize())` on mount because "the pane has no size until the tab is laid out" — the same class of problem this change hits on every toggle.

Existing spec constraints this change touches: `pipboy-map-tab` states the first-level tab bar "is always visible" and is how the user leaves the tab; the breadcrumb is currently a reserved row (`.pb-map-zone`, `flex: 0 0 auto`).

## Goals / Non-Goals

**Goals:**
- Give the map the full CRT screen on demand, hiding sheet chrome, keeping bezel + CRT overlays.
- Never trap the user: an explicit exit (toggle + `Escape`) replaces the hidden tab bar.
- Keep the level-of-detail correct across the resize (invalidate size, re-sync markers/breadcrumb against the new `vr`).
- Keep ownership clean: the sheet shell hides its own chrome; the tab asks.
- Ephemeral state, consistent with `editMode`.

**Non-Goals:**
- The browser/OS Fullscreen API (`requestFullscreen`). The app is already a `display: standalone` PWA; the value here is reclaiming *app* chrome, not browser chrome. Explicitly out of scope.
- Edge-to-edge over the bezel. The bezel and CRT overlays stay — the fantasy is "map fills the Pip-Boy," not "map replaces the device."
- Persisting immersive across sessions or tab switches.
- Any change to the CMS campaign map or the API.

## Decisions

### Decision 1: The sheet shell owns immersive state; the tab requests it via ctx

`sheet.js` holds an `immersive` boolean (module/closure view state next to `editMode`). It exposes `enterImmersive()` / `exitImmersive()` (or a single `setImmersive(bool)`) to the map tab through the existing `ctx` object that `renderActiveTab()` already passes to `leaf.render(contentEl, { ... })`. Entering toggles a class — e.g. `pb-immersive` — on a stable shell element (the sheet root or `.pb-screen`) and CSS does the hiding; `sheet.js` also drives whatever imperative bits are needed (e.g. `subBarEl.hidden`, resource band).

**Why over the alternative (a CSS class set from `map.js` reaching up to an ancestor):** the lighter option is fewer lines — `map.js` does `document.querySelector('.pb-screen').classList.toggle('pb-immersive')`. But it makes the tab reach outside its container to manipulate sibling chrome it does not own, which is exactly the coupling the resources-band and `chrome.js` patterns avoid. The map tab already uses `globalThis` only for test seams (`__PB_MAP__`), never to mutate app chrome. Keeping the hide/show on the owner means the invariant "immersive resets on re-mount" falls out naturally (a fresh `renderSheet` starts with `immersive = false` and never adds the class), rather than relying on cleanup of a class some other module stamped.

**Reset semantics:** `renderSheet` initialises `immersive = false` like `editMode`. Because `renderMapTab` already tears down and rebuilds `currentMap` on every (re)render, and the sheet re-renders chrome from its own state, a re-mount is clean by construction. If immersive is entered and then the tab is somehow re-rendered, the shell's `immersive=false` default wins.

### Decision 2: Exit affordances — toggle control + `Escape`

A toggle button joins the canvas corner cluster next to the search lens (`mountSearch` already builds a `data-map-search` box; the fullscreen toggle is a sibling control, or the two share a cluster container). Same event-isolation treatment as search: `L.DomEvent.disableClickPropagation` so a tap on the control never reaches the map.

`Escape` is handled with a keydown listener installed on entering immersive and removed on leaving (bind/unbind, matching the wake-lock and `chrome.js` teardown pattern), so there is no stray global listener when not immersive. Note the search input already `stopPropagation`s its own `Escape` (it collapses the search box) — the immersive `Escape` handler must not fight it; scoping the global `Escape` to "immersive and search not open" (or letting search's `stopPropagation` win first) keeps the two from colliding.

**Why both:** the toggle is discoverable; `Escape` is the expected desktop reflex and cheap. On touch there is no tab bar and no swipe-out over the map, so the visible toggle is load-bearing, not a nicety.

### Decision 3: Breadcrumb becomes a floating overlay

`.pb-map-zone` moves from a reserved flex row into an absolutely-positioned overlay on `.pb-map-canvas`, styled like the existing attribution/search controls (phosphor styling, `pointer-events` managed so it does not eat pans). This serves both modes with one code path: normal mode reclaims the row; immersive keeps "where am I" without chrome. `renderZone()` already writes into `zoneEl` — only the element's placement/CSS changes, not the render logic. Left-truncation and the `CHAIN_MAX` elision are preserved.

**Alternative considered:** keep the row in normal mode and only float it in immersive. Rejected — two layouts for one indicator is more CSS and a second code path for no benefit; the overlay works in both.

### Decision 4: Level-of-detail revalidation on toggle

On every enter/leave the tab runs, in order: `map.invalidateSize()` → `syncMarkers(vrNow())` → `renderZone()`. Because `vr` grows with the canvas, entering immersive can drop markers (places open later) and leaving can restore them — this is correct behaviour, not a bug, and the re-sync makes the on-screen set match the geometry.

**Timing against the transition:** if the canvas expands with a CSS transition, `getSize()` reads an intermediate size mid-transition. Two viable approaches:
- (a) run `invalidateSize` + re-sync on `transitionend` of the canvas, or
- (b) make the size change instant (no transition on the dimensions that drive `getSize`) and animate only non-size properties.

Preference: **(a)** — listen for `transitionend` on the canvas (guarded to the size-driving property) and revalidate then; fall back to a `requestAnimationFrame`/timeout equal to the transition duration if `transitionend` does not fire (e.g. reduced-motion, or no actual size delta). This keeps a pleasant expand animation while guaranteeing Leaflet measures the final size. The existing mount-time `rAF(invalidateSize)` is the precedent for "measure after layout settles."

### Decision 5: Test seam

Follow the existing convention (`__PB_MAP__`, `map.__pbFocus`, `__PB_MAP_ATTRIBUTION_MS__`). Expose a way for Playwright to toggle immersive deterministically and to read back state — e.g. the toggle is clickable via its control, and immersive state is observable from the DOM (the shell class) so the spec asserts on the live DOM rather than internal booleans. If a transition delay would make the test wait, add an override akin to `__PB_MAP_ATTRIBUTION_MS__` to zero it under test.

## Risks / Trade-offs

- **[Escape collides with the search box's own Escape]** → Scope the immersive `Escape` handler so search's `Escape` (collapse box) wins when the box is open; only an `Escape` with search closed exits immersive. Covered by an e2e assertion.
- **[Leaflet measures an intermediate size during the expand transition, leaving grey tiles or an off-centre view]** → Decision 4(a): revalidate on `transitionend` against the final size, with a timeout fallback.
- **[Marker set visibly popping on toggle as `vr` changes]** → This is the geometry working as specified; it is not a regression. The bloom/collapse animation is zoom-driven and does not run on a resize, so markers appear/disappear rather than animate — acceptable, and consistent with `syncMarkers` on `zoomend`. If jarring, a follow-up could animate, but that is out of scope.
- **[User enters immersive, backgrounds the PWA, returns]** → Immersive is view state on the live sheet; nothing persists it, and a re-mount resets it. No wake-lock interaction (that is independent sheet state).
- **[Reduced-motion / no size delta means `transitionend` never fires]** → Timeout fallback triggers the revalidation regardless.
- **[CRT overlays or bezel overlap the enlarged canvas edges]** → The canvas fills `.pb-screen` (inside the bezel), and overlays are designed to sit above screen content already; immersive does not move them, so their compositing is unchanged.

## Migration Plan

Additive, single app, no data or API changes. Ship `sheet.js` state + ctx hooks, `map.js` toggle/Escape/overlay/revalidation, and `pipboy.css` immersive layout together. Rollback is reverting the three files; no persisted state or schema to unwind. The spec delta archives into `openspec/specs/pipboy-map-tab/spec.md` on completion.

## Open Questions

- Icon/label for the toggle (a `⤢`/expand glyph vs a labelled control) — a visual-token call, deferrable to implementation against the live phosphor look.
- Whether the statusbar (`.pb-statusbar`, outside `.pb-screen`, owned by `chrome.js`) should also hide in immersive, or only the in-screen chrome. Leaning: keep the statusbar (it is device chrome like the bezel, and hiding it is a `chrome.js` concern), but confirm against the live look during implementation.
