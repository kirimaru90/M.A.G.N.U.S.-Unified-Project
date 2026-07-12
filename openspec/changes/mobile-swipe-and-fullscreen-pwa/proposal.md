## Why

On mobile, horizontal swipe navigation on the character sheet does not work: the swipe listeners live on the scroll container (`.pb-screen-content`) but no `touch-action` is declared, so the browser claims every gesture for native scrolling and fires `pointercancel` before `pointerup` — the swipe never completes. The bug reproduces only on touch devices (desktop mouse has no native panning to cancel). Separately, when installed to the home screen the app runs in `standalone` mode, which keeps the OS status bar (notch area) and the bottom navigation buttons on screen; players want the Pip-Boy to take over the whole display for an immersive, edge-to-edge terminal.

## What Changes

- **Fix mobile swipe.** Declare `touch-action: pan-y` on the sheet content pane so vertical scroll stays native while horizontal gestures are handed to the app and never cancelled.
- **Make the whole screen swipeable.** Replace the "gesture must start off an interactive control" opt-out with distance-based tap/swipe discrimination: a gesture anywhere on the sheet navigates if it clears the horizontal deadzone; otherwise the underlying tap (chip, stepper, button) still fires. A gesture that resolves to a swipe suppresses the trailing `click` so navigation does not also toggle a control.
- **Go true edge-to-edge when installed.** Switch the manifest to request fullscreen (`display_override: ["fullscreen", "standalone"]`, `display: "standalone"` fallback) so Android hides the status bar and navigation buttons. **BREAKING (visual):** the installed app no longer shows OS chrome and the outer floating margin collapses to the display edges.
- **Add iOS standalone support.** `index.html` gains `mobile-web-app-capable` / `apple-mobile-web-app-capable` = `yes` and `apple-mobile-web-app-status-bar-style` = `black-translucent`, so iOS runs it chrome-free and draws the green screen under the status bar (iOS cannot fully hide the status bar or home indicator for a PWA — documented as a known platform limit).
- **Make the shell safe-area-aware.** Replace the fixed uniform page margin with `env(safe-area-inset-*)`-derived insets so the case bleeds to the display edges (truly edge-to-edge where the OS allows) while header/footer content never sits under the notch or home indicator. Relies on the already-present `viewport-fit=cover`.

## Capabilities

### New Capabilities
<!-- None: all changes modify existing pip-boy capabilities. -->

### Modified Capabilities
- `pipboy-sheet-navigation`: the "Swipe gesture navigation with deadzone" requirement changes — the gesture is now available across the whole content pane (not only off interactive controls), tap-vs-swipe is decided by travel distance, a resolved swipe suppresses the trailing click, and reliable delivery on touch devices is guaranteed via `touch-action: pan-y`.
- `pipboy-pwa-installability`: the manifest display requirement changes from `standalone` to a fullscreen-preferring `display_override` chain; the "Installable on desktop and Android" requirement changes so the installed app launches fullscreen (no OS chrome) rather than standalone; a new requirement covers iOS standalone meta tags and their documented status-bar limitation.
- `pipboy-responsive-shell`: the fixed "small uniform margin so the case is never flat against the viewport edge" rule is replaced by safe-area-aware insets that allow the case to reach the display edges (edge-to-edge) while keeping content clear of the notch and home indicator.

## Impact

- **Code:**
  - `apps/pip-boy/src/screens/sheet.js` — swipe gesture logic (pointerdown/move/up, tap-vs-swipe discrimination, click suppression).
  - `apps/pip-boy/src/styles/pipboy.css` — `touch-action` on `.pb-screen-content`; safe-area insets on `body` / `.pb-case` (and header/footer padding).
  - `apps/pip-boy/manifest.webmanifest` — `display_override`, `display`.
  - `apps/pip-boy/index.html` — Apple/mobile web-app meta tags.
- **No API, backend, or data changes.** Purely client-side in the `apps/pip-boy` static app.
- **Platform behavior:** Android gains true fullscreen (status bar + nav buttons hidden). iOS gains chrome-free standalone but retains its status bar / home indicator per platform policy. Desktop/browser-tab behavior is unchanged apart from safe-area insets resolving to zero.

## Testing

Automated Playwright tests (the harness is already wired in `apps/pip-boy` via `playwright.config.ts`) load the app against the live DOM and supersede manual browser checks where practical:

- **Swipe navigation (e2e, touch-emulated):** synthesize a horizontal touch drag over the content pane and assert the active tab advances/retreats; assert a below-threshold drag does not navigate; assert a predominantly-vertical drag scrolls without navigating; assert a swipe that begins over an interactive control (chip/stepper) still navigates, while a *tap* on that control fires the control and does not navigate. Assert `.pb-screen-content` carries `touch-action: pan-y` (computed style).
- **Manifest & meta (integration, DOM/HTTP):** fetch `manifest.webmanifest` and assert `display_override` contains `fullscreen` with a `display` fallback; assert `index.html` declares the `mobile-web-app-capable`, `apple-mobile-web-app-capable`, and `apple-mobile-web-app-status-bar-style` meta tags and retains `viewport-fit=cover`.
- **Safe-area layout (e2e):** with an emulated safe-area inset, assert the case reaches the viewport edges and that header/footer content is inset from the notch/home-indicator regions.
- **Not automatable — stated explicitly:** whether Android actually hides the OS status bar / nav buttons, and iOS status-bar rendering under `black-translucent`, depend on the real installed OS shell and cannot be asserted in Playwright/Chromium; these are verified by manual on-device install checks and are documented as such.
