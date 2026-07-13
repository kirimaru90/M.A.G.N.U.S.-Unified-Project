## 1. Swipe: reliable touch delivery

- [x] 1.1 Add `touch-action: pan-y` to `.pb-screen-content` in `apps/pip-boy/src/styles/pipboy.css`.
- [x] 1.2 Verify no descendant `overflow-x: auto` region inside `.pb-screen-content` relies on horizontal touch-drag; if any does, give it its own `touch-action` override.

## 2. Swipe: whole-screen tap/swipe discrimination

- [x] 2.1 In `apps/pip-boy/src/screens/sheet.js`, remove the start-on-interactive opt-out (`swipeCandidate = !e.target.closest(INTERACTIVE)`) and instead record the pointer start position for every `pointerdown` on `contentEl`.
- [x] 2.2 On `pointerup`, classify the gesture by travel: within the tap threshold → do nothing (let the native click through); past the swipe distance threshold and horizontally direction-locked (`|dx| > SWIPE_THRESHOLD` and `|dx| > |dy| * SWIPE_RATIO`) → call `next()` (dx < 0) or `prev()` (dx > 0).
- [x] 2.3 When a gesture resolves to a swipe, suppress the trailing synthetic `click` (one-shot capture-phase click handler that `preventDefault()`/`stopPropagation()`s the next click, then removes itself), so navigating does not also activate a control the gesture passed over.
- [x] 2.4 Keep `pointercancel` resetting gesture state; confirm the `INTERACTIVE` constant is removed or no longer used.

## 3. Fullscreen: manifest & iOS meta

- [x] 3.1 In `apps/pip-boy/manifest.webmanifest`, add `"display_override": ["fullscreen", "standalone"]` and keep `"display": "standalone"` as fallback.
- [x] 3.2 In `apps/pip-boy/index.html` `<head>`, add `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`.
- [x] 3.3 Confirm the viewport meta still includes `viewport-fit=cover` (already present) and theme-color meta is retained.

## 4. Shell: safe-area edge-to-edge layout

- [x] 4.1 In `pipboy.css`, replace the fixed `body` padding with per-side `max(<small fallback>, env(safe-area-inset-<side>))` so the case reaches display edges when no inset exists and stays clear of notch/home indicator when insets exist.
- [x] 4.2 Pad the status bar/header top by `env(safe-area-inset-top)` and the footer bottom by `env(safe-area-inset-bottom)` so no chrome lands under the notch or home indicator.
- [x] 4.3 Sanity-check `.pb-case` still fills the viewport with no fixed max-width/height cap and no page-level scrollbar (existing `pipboy-responsive-shell` behavior intact).

## 5. Automated tests (Playwright)

- [x] 5.1 Add a test asserting `.pb-screen-content` computed `touch-action` is `pan-y`.
- [x] 5.2 Add touch-emulated tests: horizontal swipe left advances / right retreats the active tab; a below-threshold drag does not navigate; a predominantly-vertical drag scrolls without navigating.
- [x] 5.3 Add a test that a swipe beginning over an interactive control still navigates AND does not activate that control, and that a plain tap on the same control fires the control without navigating.
- [x] 5.4 Add tests asserting `manifest.webmanifest` has `display_override: ["fullscreen","standalone"]` and `display: "standalone"`, and that `index.html` declares the three web-app meta tags plus `viewport-fit=cover`.
- [x] 5.5 Add a safe-area layout test (emulated inset): case reaches the viewport edge where no inset exists; header/footer content is inset from non-zero safe-area regions.

## 6. Manual on-device verification (not CI-automatable)

- [ ] 6.1 Install on Android; confirm the launched app hides the OS status bar and navigation buttons (fullscreen) and content is not clipped by the notch.
- [ ] 6.2 Add to iOS home screen; confirm it launches chrome-free with the green screen under the status bar and header/footer content clear of the status bar and home indicator.
- [ ] 6.3 Confirm swipe navigation works by finger on both a dense tab (over chips/steppers) and a scrollable tab, and that vertical scroll and taps still behave.

## 7. Wrap-up

- [x] 7.1 Run the pip-boy Playwright suite (`npm test` in `apps/pip-boy`) and confirm it passes. (142 passed)
- [x] 7.2 Run `openspec validate mobile-swipe-and-fullscreen-pwa --strict` and resolve any issues. (valid)
