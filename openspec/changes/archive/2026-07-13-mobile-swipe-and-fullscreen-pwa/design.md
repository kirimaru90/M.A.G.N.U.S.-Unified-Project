## Context

`apps/pip-boy` is a build-step-free static app (vanilla JS/CSS/HTML) that renders a Fallout-style Pip-Boy character sheet. Two mobile problems motivate this change:

1. **Swipe is dead on touch devices.** `sheet.js` attaches `pointerdown`/`pointerup` swipe listeners to `.pb-screen-content`, which is `overflow-y: auto`. No `touch-action` is declared anywhere in `pipboy.css`. With the default `touch-action: auto`, the browser treats the container's touches as pannable and, the moment a gesture looks like a scroll, dispatches `pointercancel` and stops the pointer stream — so `pointerup` never carries a completed swipe. On desktop (mouse) there is no native panning to cancel, which is why the bug is mobile-only. The current handler also opts a gesture out entirely if it *starts* on any interactive control (`INTERACTIVE` selector), and the sheet bodies are dense with chips/steppers/buttons, leaving little swipeable surface even once the cancel bug is fixed.

2. **Installed app keeps OS chrome.** `manifest.webmanifest` declares `display: "standalone"`, which hides browser chrome but keeps the OS status bar (notch) and the bottom navigation buttons. The layout also uses a fixed `body { padding: 12px }` outer margin and no `env(safe-area-inset-*)`, so it is not prepared to render safely under a notch/home indicator even though `viewport-fit=cover` is already present.

Constraints: no build step (so all changes are hand-authored source), Italian CRT-styled UI, Playwright is already wired (`playwright.config.ts`), and the existing `pipboy-responsive-shell` spec currently *mandates* a small uniform margin — which this change deliberately relaxes.

## Goals / Non-Goals

**Goals:**
- Horizontal swipe navigation works reliably on touch devices, from anywhere on the content pane, without breaking taps on controls or vertical scroll.
- When installed, the app takes over the whole display: Android hides status bar + nav buttons (fullscreen); iOS runs chrome-free with content drawn under the status bar.
- Content never hides behind the notch or home indicator, on any target platform.

**Non-Goals:**
- No animated page-transition / rubber-band drag preview during the swipe (still a discrete commit on release, matching current behavior).
- No attempt to fully hide the iOS status bar or home indicator (platform-forbidden for PWAs).
- No changes to the flattened traversal order, tab layout, service worker, API, or any backend.
- No new dependencies or build tooling.

## Decisions

### D1: `touch-action: pan-y` on the scroll container (not JS `preventDefault`)
Declaring `touch-action: pan-y` on `.pb-screen-content` tells the browser to keep native **vertical** scrolling but hand **horizontal** gestures to the app, so it never fires `pointercancel` on a horizontal swipe. 

- *Alternative — `preventDefault()` in a `touchmove` listener:* would require a non-passive listener and manual scroll re-implementation, fighting the browser and risking janky scroll. Rejected.
- *Alternative — `touch-action: none`:* would kill native vertical scroll and force us to reimplement scrolling. Rejected.

`pan-y` is the minimal, declarative fix that keeps native scroll and is the root cause of the mobile failure.

### D2: Distance-based tap/swipe discrimination, replacing the start-target opt-out
Instead of `swipeCandidate = !e.target.closest(INTERACTIVE)`, every `pointerdown` starts a candidate gesture. On `pointerup` we measure total travel:
- Travel within a small **tap threshold** → do nothing; let the native `click` reach the control.
- Horizontal travel past the **swipe threshold** and horizontally direction-locked (`|dx| > |dy| * SWIPE_RATIO`) → navigate (`next()`/`prev()`), and **suppress the trailing click** so the swipe does not also toggle a control it passed over.

Click suppression: on a resolved swipe, set a one-shot flag and add a capture-phase `click` listener that calls `stopPropagation()`/`preventDefault()` for the next click, then clears itself. This keeps existing controls fully tappable while making the whole surface swipeable.

- *Alternative — keep the interactive opt-out and only add `touch-action`:* simplest, but the dense control layout leaves little swipeable area, so swipe would still feel broken. Rejected per the explore-phase decision to make the whole screen swipeable.

### D3: Fullscreen via `display_override`, standalone as fallback
`display_override: ["fullscreen", "standalone"]` with `display: "standalone"`. Browsers that support `display_override` and fullscreen (Android/Chromium PWAs) hide the status bar and nav buttons; everything else falls back to standalone (desktop, older browsers) with no regression.

### D4: iOS handled via Apple meta tags, with an explicit documented limit
iOS ignores the manifest `display` field, so `index.html` gains `mobile-web-app-capable`, `apple-mobile-web-app-capable`, and `apple-mobile-web-app-status-bar-style=black-translucent`. `black-translucent` + `viewport-fit=cover` + safe-area insets makes the green screen render under the status bar. iOS cannot hide the status bar or home indicator for a PWA — we accept and document this rather than chase an impossible parity with Android.

### D5: Safe-area insets replace the fixed page margin (edge-to-edge)
The outer inset around `.pb-case` becomes `env(safe-area-inset-*)`-derived rather than a flat `12px`. Where the OS exposes no inset (Android fullscreen with bars hidden, desktop), the case reaches the display edge — true edge-to-edge. Where a notch/home indicator exists, the inset keeps the case and its chrome clear of them. In a plain browser tab the insets resolve to zero, so a small fallback margin keeps the case off the very edge, satisfying the relaxed `pipboy-responsive-shell` rule. Header/footer additionally pad by the relevant inset so no text or button lands under the notch or home indicator.

Concretely: `body` padding uses `max(<fallback>, env(safe-area-inset-<side>))` per side; the status bar/header pad top by the top inset and the footer pads bottom by the bottom inset.

## Risks / Trade-offs

- **Click-suppression could swallow a legitimate tap** → scope the suppression to exactly one click immediately following a resolved swipe, cleared on a timeout/next pointerdown; covered by a Playwright test asserting a plain tap on a stepper still fires.
- **`touch-action: pan-y` blocks any intended horizontal *scroll* inside the pane** → the sheet's own horizontally-scrolling regions (`overflow-x: auto` tables/strips) are descendants that can set their own `touch-action` if a conflict shows up; none currently rely on horizontal touch-drag, so risk is low. Flagged for verification during apply.
- **Edge-to-edge removes the "floating device" framing some may prefer** → deliberate, per the explore-phase decision; the bezel still renders, now flush to the safe area instead of a fixed margin.
- **On-device fullscreen/iOS behavior can't be asserted in CI** → Playwright covers manifest/meta/computed-style and gesture logic; true OS-chrome hiding is verified by a manual install checklist in tasks.
- **Notch overlap regressions on future layout edits** → the safe-area scenarios in `pipboy-responsive-shell` act as guard tests.

## Migration Plan

Pure client-side, static assets; no data or API migration. Deploy is the normal `apps/pip-boy` static deploy (service worker cache version is stamped per-deploy by the existing `deploy-cache-busting` mechanism, so installed clients pick up the new shell on next online launch). Rollback is reverting the four touched files. Users who already installed the app get the new fullscreen/manifest behavior after the service worker updates; no reinstall required.

## Open Questions

- None blocking. To confirm during apply: whether any existing `overflow-x: auto` region inside `.pb-screen-content` needs its own `touch-action` override once `pan-y` is set on the parent.
