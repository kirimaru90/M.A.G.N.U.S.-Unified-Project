## Why

`apps/pip-boy`'s shell (`src/styles/pipboy.css`) has the same class of viewport-fit bug that the
`reference/cloud design` prototype it's modeled on had, plus one gap the prototype didn't have:

- **No landscape treatment at all.** `.pb-case` is a single fixed-shape rule — `max-width: 460px`,
  `height: min(96vh, 960px)` — sized for a phone in portrait. There is no `@media (orientation:
  landscape)` rule and no JS orientation branch anywhere under `src/`. On a desktop window or a
  phone rotated to landscape, the terminal renders as a narrow vertical card in the middle of a much
  wider viewport instead of using the available width, unlike the `reference/cloud design` prototype
  (which at least swaps `wrapMaxW`/`wrapMaxH` by orientation, even though its version had its own
  per-screen drift bug).
- **`100vh`, not `100dvh`.** `body`'s `min-height: 100vh` is measured against the largest possible
  mobile viewport (browser chrome hidden), so the shell can be taller than what's actually visible
  while the address bar is shown, or leave a gap once it hides.
- **Scroll containment is close, but not guaranteed.** `.pb-screen-content` is already the one
  `flex: 1; overflow-y: auto; min-height: 0` pane, which is correct. But `html`/`body` have no
  explicit `overflow: hidden`, so nothing actually prevents page-level scroll if a future screen
  (e.g. a long `.pb-center-screen` message) ends up taller than the viewport.
- **Case-size constancy is likely already true, but by accident, not by contract.** `.pb-case` is one
  static CSS class applied once in `index.html`; no screen module (`login.js`, `campaign-select.js`,
  `character-select.js`, `sheet.js`) sets an inline width/height on it. That's exactly the "constant
  case size across screens" behavior the reference prototype had to be *fixed* to get (its version
  computed `wrapMaxW`/`wrapMaxH` in JS per render, which drifted per screen). Here it's structurally
  safe today, but nothing stops a future screen from adding an inline override — worth locking in as
  an explicit, tested requirement rather than leaving it as an emergent property of the current CSS.

**Explicitly not touching PWA.** `manifest.webmanifest`, the icon set, and `sw.js` already exist and
are covered by `pipboy-pwa-installability`; this change does not modify any of them.

## What Changes

1. **Viewport-filling layout in every orientation.** Add landscape-aware sizing to `.pb-case`
   (parallel to what the prototype does with `wrapMaxW`/`wrapMaxH`, but without reintroducing its
   per-screen drift bug), and replace `100vh`-rooted sizing with `100dvh` so mobile browser-chrome
   show/hide doesn't over/undershoot the fit.
2. **Scrolling stays inside the screen.** `html`/`body` get a hard `overflow: hidden` so page-level
   scroll can never leak out, on top of the existing `.pb-screen-content` scroll pane.
3. **Case size stays constant across screens.** Codify, as a requirement backed by a Playwright
   assertion, that `.pb-case`'s rendered bounding box is identical across `login` →
   `campaign-select` → `character-select` → `sheet` at a fixed viewport size and orientation — so
   this stays true by contract, not just by the current absence of inline overrides.

## Rationale

Same root fix as the prototype's: viewport-pinned sizing (`100dvh` instead of `100vh`) plus a
`min-height: 0` flex chain removes the ambiguity that causes both bad viewport fit and case-size
drift. The difference here is scope — `apps/pip-boy` already got the "one static CSS class, no
per-screen inline sizing" part right, so (3) is mostly a regression guard (spec + test) rather than a
CSS rewrite, and the real net-new work is (1) landscape support, which the prototype has some version
of but this app has none of at all.

## Out of scope

- `manifest.webmanifest`, icons, `sw.js`, and anything owned by `pipboy-pwa-installability` — not
  touched.
- Game rules, persistence, and API contracts — not touched.
- No new screens, tabs, or content.

## Impact

- `apps/pip-boy/src/styles/pipboy.css`: `html, body` sizing/overflow, `.pb-case` (add
  landscape-aware bounds, switch `100vh` inputs to `100dvh`).
- No anticipated JS changes — this is achievable as a pure CSS fix (media query on orientation, plus
  `dvh`), which also keeps (3)'s constancy guarantee trivial (still one static class, no per-screen
  JS sizing introduced).
- `apps/pip-boy/tests/`: a new Playwright spec asserting viewport fill, no page-level scroll, and a
  constant `.pb-case` bounding box across all four screens.

## Testing

- New Playwright spec (`apps/pip-boy/tests/`) covering:
  - No page-level scrollbar at mobile-portrait, mobile-landscape, and desktop viewport presets.
  - `.pb-case`'s bounding box (via `boundingBox()`) is identical across `login` → `campaign-select` →
    `character-select` → `sheet` at a fixed desktop viewport size.
  - `.pb-case` uses meaningfully more of the viewport width in landscape than the current fixed
    `460px` cap.
- Final task runs `npm test` (Playwright) from `apps/pip-boy` and confirms all pass.
