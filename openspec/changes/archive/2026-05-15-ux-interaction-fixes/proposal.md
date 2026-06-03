## Why

The terminal interaction model has accumulated several UX papercuts that break immersion or cause accidental input: holding Enter through the typing animation instantly selects the first choice; long nodes scroll off-screen on mobile; the page is locked from scrolling on desktop even when choices are visible; the typing sound bleeds into the boot screen on disconnect; and the only way to skip the typewriter is the keyboard. This change is a focused UX polish pass on `index.html`.

PWA installability work is handled in a separate change (`pwa-installability`) and shares no code dependencies with this one.

## What Changes

- Add a configurable **post-typing Enter cooldown** (default 1000 ms) so holding/spamming Enter to skip typing cannot accidentally activate the first choice.
- Make the typing animation **auto-follow the viewport** so the currently-typing character stays in view; auto-follow pauses if the user scrolls manually and resumes on the next node.
- **Enable scrolling on desktop** for the terminal screen (currently locked by `overflow: hidden` on `body,html`) without breaking the "selected" focus state on choices.
- On Arrow / `w` / `s` navigation, **scroll the newly-focused choice into view** only when it would be off-screen, and only on the focus-change event (no snap-back during user scroll).
- During the typing animation, **`Escape` skips typing** identically to `Enter`; after typing completes, `Escape` reverts to its existing back/disconnect behaviour.
- Add a **mouse / touch skip gesture**: during typing, a **left-click or single tap anywhere on the page** skips the animation. The gesture works regardless of where in the screen the press occurs. Once typing finishes, left-click reverts to its normal role — selecting choices and activating buttons — with no choice activation leaking from the skip gesture.
- **Stop the typing sound on every path back to the boot screen** (`disconnectTerminal`, login-back at root, error fall-throughs), and render the in-flight `typeWriterHTML` inert so its trailing callback cannot restart audio or render into hidden DOM.
- Add **`w` (up) and `s` (down) as page-scroll shortcuts**, suppressed whenever a text-accepting input/textarea/contenteditable has focus. Generalize suppression of letter-based shortcuts behind a single helper.

All new tunables (cooldown ms, scroll step px) live as named constants near `typingSpeed` in `index.html`. Italian-language UI strings are preserved verbatim. No build step is introduced.

## Capabilities

### New Capabilities

- `typing-animation-flow`: the lifecycle of `typeWriterHTML` as user-observable behaviour — skip triggers (Enter/Escape/left-click/tap), the post-typing Enter cooldown, viewport auto-follow with user-scroll arbitration, and cancellation semantics when navigating away mid-animation.
- `scroll-and-shortcuts`: page-scroll behaviour while choices are visible, scroll-into-view on focus change, `w`/`s` page-scroll shortcuts, and the global suppression rule for letter-based shortcuts when a text input is focused.

### Modified Capabilities

- `keyboard-navigation`: Escape gains a typing-skip mode while typing is in flight; the Enter handler in the choices panel honours the post-typing cooldown; Arrow / `w` / `s` focus changes trigger conditional scroll-into-view.
- `terminal-sound-effects`: typing sound lifecycle extended to stop on every transition back to the boot screen and on mid-animation cancellation, not only at typing completion.

## Impact

- **Code**: `index.html` (single-file engine) — touches the global `keydown` handler, `typeWriterHTML`, `showChoices` handler, `makeNavHandler`, `disconnectTerminal`, and the login-back path. Adds a global `pointerdown` handler for left-click/tap skip and a global `click` capture-phase guard to prevent the skip-press from leaking into a choice activation. CSS overflow rules on `body,html` and the `@media (max-width: 768px)` override are revisited.
- **Content-creator workflow**: unchanged. Authors continue to edit JSON in `dati/` only; nothing in the olonastro authoring contract changes.
- **Dependencies**: none added.
- **Coordination**: `pwa-installability` (separate change) edits the same `<head>` and the same script tail; if both land in the same release, the merge is trivial because they touch disjoint regions.
