## 1. Viewport-filling, orientation-aware sizing

- [x] 1.1 Replace `100vh`-rooted sizing (`body`'s `min-height: 100vh`, `.pb-case`'s
      `height: min(96vh, 960px)`) with `100dvh`-based equivalents so mobile browser-chrome
      show/hide doesn't over/undershoot the fit.
- [x] 1.2 Add an `@media (orientation: landscape)` rule (or equivalent) for `.pb-case` that widens
      its `max-width` bound so landscape (mobile or desktop) actually uses the available width,
      instead of keeping the portrait-shaped `460px` cap in every orientation.
- [x] 1.3 Keep `.pb-case`/`.pb-screen`'s existing `min-height: 0` flex chain intact through the new
      sizing rules (no regression to the current scroll-containment pane).

## 2. Scroll containment

- [x] 2.1 Add explicit `overflow: hidden` to `html, body` in `src/styles/pipboy.css` so page-level
      scroll cannot occur, regardless of future content changes to non-`.pb-screen-content` screens
      (e.g. `.pb-center-screen`).

## 3. Constant case size across screens

- [x] 3.1 Confirm no screen module (`login.js`, `campaign-select.js`, `character-select.js`,
      `sheet.js`) sets an inline width/height/max-width on `.pb-case` — it must stay one static CSS
      rule, not a per-render computed value.

## 4. Tests

- [x] 4.1 Add a new Playwright spec (`apps/pip-boy/tests/`) asserting no page-level scrollbar at
      mobile-portrait, mobile-landscape, and desktop viewport presets.
- [x] 4.2 In the same spec, assert `.pb-case`'s `boundingBox()` is identical across `login` →
      `campaign-select` → `character-select` → `sheet` at a fixed desktop viewport size.
- [x] 4.3 Assert `.pb-case`'s rendered width in landscape is meaningfully greater than the current
      fixed `460px` portrait cap.
- [x] 4.4 Run `npm test` (Playwright) from `apps/pip-boy` and confirm all pass.
