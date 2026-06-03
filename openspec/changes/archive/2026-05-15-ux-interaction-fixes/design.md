## Context

The engine is a single 600-line `index.html` with vanilla JS. Three subsystems are touched by this change:

1. **Typing animation** (`typeWriterHTML`, the global `keydown` listener, `typingSkip`, `typingSound`). The current implementation:
   - schedules character emission via `setTimeout(type, isTag ? 0 : speed)` in a recursive loop;
   - exposes a `typingSkip` function only while in flight;
   - is interrupted only by `Enter` and only when `typingSkip` is set;
   - has no abort handle, no cancellation token, and no link to the DOM node it is writing into.

2. **Keyboard navigation** (`makeNavHandler` for boot/login focusables, plus an inline handler inside `showChoices`). The handlers replace each other via `currentKeyHandler`. They assume the visible focusable list does not change and that no other shortcut competes for letter keys.

3. **Audio** (`typingSound = createLoopSound(...)`). It is started inside `renderNode` and stopped in the typewriter callback. There is no other call site that can stop it, so any path that bypasses the callback (disconnect mid-typing, login-back, error fall-throughs, page-hidden) leaks the loop.

The page CSS sets `overflow: hidden` on `body, html` and only re-enables `overflow: auto` under `@media (max-width: 768px)`, so the desktop terminal screen is currently un-scrollable.

PWA installability is **out of scope** for this change and is being handled separately in the `pwa-installability` change.

## Goals / Non-Goals

**Goals:**

- One coherent UX pass: cooldown, viewport follow, free scrolling, scroll-into-view on focus, Escape-as-skip, left-click/tap skip, audio cleanup, `w`/`s` shortcuts, generalized text-input suppression.
- Preserve the "single static file engine" contract. No bundler, no npm, no transpilation.
- Centralize all new tunables next to `typingSpeed` so authors can change them without hunting through handlers.

**Non-Goals:**

- No re-architecture of `index.html` into modules. Edits are surgical.
- No new content (`dati/` is untouched), no changes to the olonastro JSON schema.
- No changes to login/auth semantics, navigation history semantics, or Markdown rendering.
- No PWA work (manifest, service worker, offline support) — owned by the separate `pwa-installability` change.

## Decisions

### D1. Tunables centralized as a config object near `typingSpeed`

```
const ENGINE_CONFIG = {
  typingSpeed: 15,
  postTypingEnterCooldownMs: 1000,
  scrollStepPx: 40,
};
```

**Rationale:** the user explicitly requested authors be able to tune cooldown and scroll step without code changes. Grouping into one object documents the surface and makes future tunables obvious. Alternative: scatter `const POST_TYPING_COOLDOWN_MS = 1000` etc. — rejected, since by the third tunable the proximity rule breaks down.

### D2. Cancellation token on `typeWriterHTML` instead of a global mutable `typingSkip`

`typeWriterHTML` returns a small handle:

```
const handle = {
  skip()  { /* render full HTML, fire callback, mark done */ },
  cancel(){ /* mark cancelled; type() loop exits; callback NOT fired */ },
  isActive(): boolean
};
```

The current run's handle is stored in a single module-level slot (`currentTypingHandle`) so the global keydown / right-click / tap listeners can act on whichever animation is in flight.

- `skip()` is invoked by Enter, Escape, right-click, and tap. Identical behaviour to today's `typingSkip`.
- `cancel()` is invoked by every transition back to the boot screen (`disconnectTerminal`, login-back, error path). It guarantees the trailing callback (which would call `typingSound.stop()` and then `showChoices()`) is **not** fired, because by the time we cancel we have already hidden the terminal container and we don't want `showChoices` rendering into a hidden DOM.
- After `cancel()`, the caller must also call `typingSound.stop()` directly, because the callback that normally stops it will not run. This is wrapped in a single helper `abortCurrentTyping()` used by all "back to boot" paths.

**Rationale:** the current `typingSkip = null / function` pattern conflates "skip" and "cancel" and has no way to distinguish "the user wants to see the whole text now" from "we're navigating away, throw the work out." The cancellation token cleanly separates the two without introducing AbortController (which works but is heavier and harder to read for a static file).

**Alternative considered:** keep the global `typingSkip` and add a global `typingCancel`. Rejected — two parallel slots, easy to drift out of sync.

### D3. Post-typing Enter cooldown is enforced inside the `showChoices` Enter handler, not via a setTimeout that re-binds keys

When typing completes, we record `lastTypingEndAt = performance.now()`. The Enter branch of the `showChoices` keydown handler checks `performance.now() - lastTypingEndAt < ENGINE_CONFIG.postTypingEnterCooldownMs` and short-circuits (no click, no sound) if true. Arrow keys, mouse clicks, and other inputs are unaffected.

**Rationale:** simpler and race-free. The alternative — un-bind Enter for the cooldown duration and re-bind it — leaks listener slots if a node is navigated away from before the timer fires. A timestamp check is O(1), stateless, and naturally survives node transitions (a new `renderNode` resets `lastTypingEndAt` when it completes).

### D4. Viewport follow during typing — `scrollIntoView` on the trailing cursor, with user-scroll arbitration

The blinking cursor span (`<span class="cursor">_</span>`) already sits at the end of the content area. During typing we periodically call `cursor.scrollIntoView({ block: 'end', behavior: 'auto' })`. To avoid jitter, we only do it when the cursor's bounding rect is below the viewport bottom (i.e., we'd otherwise lose it). `behavior: 'auto'` (instant) is preferred over `'smooth'` because the typing speed already provides visual rhythm and smooth scroll competes with it.

**User-scroll arbitration:** the decision (already locked in) is *pause auto-follow as soon as the user scrolls manually; resume on the next node*. Implementation:

```
let autoFollowEnabled = true;
let suppressNextScrollEvent = false;

function autoFollow() {
  suppressNextScrollEvent = true;
  cursor.scrollIntoView({ block: 'end', behavior: 'auto' });
}

window.addEventListener('scroll', () => {
  if (suppressNextScrollEvent) { suppressNextScrollEvent = false; return; }
  autoFollowEnabled = false;
}, { passive: true });

// On renderNode entry: autoFollowEnabled = true;
```

The `suppressNextScrollEvent` flag eliminates the obvious false positive (our own programmatic scroll triggering the disable). For wheel-then-instant-stop edge cases where the scroll event arrives slightly later than the flag clear, we accept the risk — worst case auto-follow disables one node early, which the user-decision explicitly tolerates.

**Alternative considered:** listen for `wheel`/`touchmove`/`keydown(PageUp/PageDown)` events instead of `scroll`. Rejected — `scroll` is the single source of truth and works for every input modality, including the user dragging the scrollbar.

### D5. Free scrolling on desktop without breaking focus

Remove `overflow: hidden` from `body, html` on desktop. The CRT scanline overlay (`.crt::before`, position: absolute, `top:0;bottom:0`) currently relies on the viewport being non-scrolling — we re-anchor it to `position: fixed; inset: 0;` so it covers the visible viewport regardless of scroll position. The `#terminal-container` keeps its `max-width: 800px; margin: 0 auto` and grows in height naturally; the document body provides the scrollbar.

Focus is preserved automatically: scrolling the document does not blur the active button. Arrow keys inside `#choices-container` still call `e.preventDefault()`, so they do not cause native scrolling — they purely change focus, and the focus handler in D6 decides whether to scroll the new focus target into view.

### D6. Scroll-into-view on focus change, gated by visibility

Both `makeNavHandler` and the `showChoices` handler call a shared helper:

```
function scrollFocusIntoViewIfNeeded(el) {
  const rect = el.getBoundingClientRect();
  const above = rect.top < 0;
  const below = rect.bottom > window.innerHeight;
  if (above || below) {
    suppressNextScrollEvent = true; // re-use D4's flag, see note
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
}
```

`block: 'nearest'` is the key: if the button is already in view, this is a no-op; if it's off-screen above or below, it scrolls just enough to bring it to the nearest edge. This satisfies the "scroll only on focus change, no snap-back" requirement: between focus changes, the user's manual scroll is never overridden.

**Note on `suppressNextScrollEvent`:** during typing this flag is also used by D4. Outside typing, `autoFollowEnabled` is irrelevant, so re-using the flag is safe (it only suppresses one scroll event each time it's set).

### D7. Escape during typing skips; otherwise back/disconnect

The global keydown listener already handles `Enter` while `currentTypingHandle` is active. We extend it to handle `Escape` the same way: `if (currentTypingHandle && currentTypingHandle.isActive()) { currentTypingHandle.skip(); e.preventDefault(); return; }`. The `showChoices` handler's Escape branch (back/disconnect) is unchanged — it only runs after typing completes, because the global handler returns early during typing.

### D8. Left-click and tap as skip gestures

A single global `pointerdown` listener handles both, and a capture-phase `click` guard prevents the skip-press from leaking into a button activation when the user releases the mouse.

```
let suppressNextClickAfterSkip = false;

document.addEventListener('pointerdown', (e) => {
  if (!currentTypingHandle || !currentTypingHandle.isActive()) return;
  // Primary input only: left mouse button OR primary touch/pen contact.
  const isLeftClick = e.pointerType === 'mouse' && e.button === 0;
  const isPrimaryTouch = (e.pointerType === 'touch' || e.pointerType === 'pen') && e.isPrimary;
  if (!isLeftClick && !isPrimaryTouch) return;
  suppressNextClickAfterSkip = true;
  currentTypingHandle.skip();
  // Do NOT preventDefault here: blocking the default pointerdown breaks
  // focus handoff on some browsers. The click-capture guard below is the
  // real defence against accidental choice activation.
}, true);

// Capture-phase click guard: swallows exactly one click that originated
// from the same gesture chain as a skip pointerdown. Required because
// `showChoices` may render and focus the first button between mousedown
// (skip) and mouseup/click.
document.addEventListener('click', (e) => {
  if (!suppressNextClickAfterSkip) return;
  suppressNextClickAfterSkip = false;
  e.stopPropagation();
  e.preventDefault();
}, true);
```

- **Left-click** (desktop) and **tap** (mobile/tablet) both skip the in-flight animation. The press location does not matter — anywhere on the page works.
- After typing completes the `pointerdown` handler is a no-op, so left-click reverts to its normal role: selecting choices, activating buttons, focusing inputs. There is no special "right-click" mode and the browser context menu is never suppressed.
- The risk this design solves: the user presses the mouse during typing → skip fires on `pointerdown` → typing completes synchronously → `showChoices` renders and focuses the first button → the user releases the mouse → a `click` event would fire on the now-visible button under the cursor and activate the first choice. The capture-phase `click` guard consumes exactly the one click that belongs to the skip gesture, before any choice button receives it. The next click (a deliberate fresh press) activates normally.
- The post-typing **Enter cooldown** (D3) does NOT apply to mouse clicks; the click guard is the dedicated mechanism for mouse/tap. This is intentional — the failure mode for mouse is "the press that skipped also activates," which the guard catches precisely. For keyboard, the failure mode is "Enter is held down across the boundary," which the time-based cooldown catches precisely. Two different problems, two targeted defences.

**Alternative considered:** apply the Enter cooldown to clicks too (block any click for 1 s after typing ends). Rejected — feels broken to the user (clicks should always feel responsive); the click-guard is precise about *which* click to swallow.

**Alternative considered:** call `e.preventDefault()` on the skip `pointerdown`. Rejected — preventing default on pointerdown has inconsistent cross-browser side effects (suppressing focus, breaking subsequent click synthesis on some touch stacks). The click-capture guard is more reliable.

### D9. Audio cleanup on every back-to-boot path via `abortCurrentTyping()` helper

```
function abortCurrentTyping() {
  if (currentTypingHandle && currentTypingHandle.isActive()) {
    currentTypingHandle.cancel();
  }
  typingSound.stop();
}
```

Call sites:
- `disconnectTerminal()` (currently does not stop the sound)
- The `isRootLogin` branch of `login-back` that returns to boot
- The catch/error branches in `initBoot` and `loadServerFile` that re-render boot
- Anywhere else `bootScreen.style.display = 'flex'` is set while the terminal screen was previously visible

To avoid drift, the helper is also called from `initBoot()` itself as a defence in depth — `initBoot()` knows nothing should be typing when it runs, so unconditionally aborting is harmless and catches paths added in the future.

### D10. `w` / `s` page-scroll shortcuts + global suppression rule for text inputs

Helper:

```
function isTextInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    const textLike = ['text','password','email','search','url','tel','number'];
    return textLike.includes(type);
  }
  return el.isContentEditable === true;
}
```

Behaviour:
- A single global `keydown` listener handles `w` and `s`. If `isTextInputFocused()` returns true, the handler returns immediately. Otherwise, `w` scrolls the document up by `ENGINE_CONFIG.scrollStepPx`, `s` scrolls down.
- The rule generalises: every existing or future letter-based shortcut MUST gate on `isTextInputFocused()` first. The `w`/`s` handler is the first user.
- `w`/`s` MUST NOT call `e.preventDefault()` unconditionally — only when they actually consume the key (i.e., not in an input). This way typing "w" or "s" into `#hidden-input` or `#login-password` works normally.
- Arrow / Enter / Escape handlers are not letter-based and are unaffected.

The page-scroll is `window.scrollBy({ top: ±scrollStepPx, behavior: 'auto' })`. As with focus-change scrolling (D6), this fires `suppressNextScrollEvent = true` to avoid disabling auto-follow if `w`/`s` is pressed mid-typing. (Edge case: during typing the auto-follow is the source of truth; user pressing `w`/`s` mid-typing is a deliberate manual scroll, so it SHOULD disable auto-follow for the rest of that node. Therefore, `w`/`s` should *not* set `suppressNextScrollEvent`. Acceptable behaviour.)

## Risks / Trade-offs

- **[Risk] D2 cancellation logic skips the `showChoices` callback, which might leak state if `showChoices` was responsible for clearing something between nodes.** → Mitigation: `showChoices` only touches DOM inside `choicesDiv` and binds a keyhandler — both of which the back-to-boot paths already overwrite. Verified by inspection of `showChoices`/`disconnectTerminal`. A test scenario covers "disconnect mid-typing then start a new tape" to confirm no listener leak.
- **[Risk] D4's `suppressNextScrollEvent` flag has a one-frame race window: if the browser fires a user scroll event in the same tick as our programmatic one, we'd swallow the user's intent.** → Mitigation: in practice scroll events are coalesced per frame and our programmatic scroll runs synchronously from a setTimeout-driven typing loop, not from a user input handler — collision is extremely unlikely. If it ever surfaces, switch to comparing `lastProgrammaticScrollY` against `window.scrollY` instead of a boolean flag.
- **[Risk] D6 `scrollIntoView({ block: 'nearest' })` behaviour differs slightly across browsers when the target is partially visible.** → Mitigation: the visibility check (`rect.top < 0 || rect.bottom > innerHeight`) treats partially-visible as visible enough; we only force-scroll for fully off-screen targets. Tested in Chrome, Firefox, Safari.
- **[Risk] D8's capture-phase click guard could swallow a legitimate click if the user releases the mouse far enough later that the gesture chain is unclear.** → Mitigation: `suppressNextClickAfterSkip` is consumed by the very next `click` event regardless of timing; in practice the dispatched click that pairs with a mousedown arrives within the same gesture and is the right one to swallow. A fresh, deliberate click — which always begins with its own `pointerdown` — is unaffected because by then the flag is back to `false`.
- **[Risk] D8 on touchscreens: a long-press could trigger a context menu or text-selection callout that interferes with the skip gesture.** → Mitigation: `pointerdown` fires on initial contact regardless of duration; skip executes immediately. The platform's long-press UI may still appear momentarily but does not block the skip. CSS `user-select: none` on `body` is recommended (already applied via the CRT styling indirectly; can be made explicit if reports arise).
- **[Trade-off] D10's `w`/`s` shortcuts are anglocentric. Italian users may not associate them with up/down.** → Acceptable: the user explicitly requested these letters, presumably to match gaming convention (WASD). Documenting them in a `keybindings`-style comment near `ENGINE_CONFIG` is sufficient.

## Migration Plan

This is a UX change to a static site; deployment is "replace `index.html` in nginx." Steps:

1. Land all `index.html` edits in a single commit.
2. Deploy. Existing users get the new behaviour on next page load.

**Rollback:** revert the commit, deploy. No persistent state on the client to roll back.

**Coordination with `pwa-installability`:** if both changes land in the same release, this change's `index.html` edits touch the script body and CSS; the PWA change's edits touch `<head>` and append an SW registration block at the script tail. Disjoint regions — merge is trivial.

## Open Questions

- Should the `pointerdown` skip handler also fire on stylus (`pointerType === 'pen'`)? Current design says yes (touch-equivalent), but if stylus users tend to hover before tap, this could feel wrong. Defer until field feedback.
