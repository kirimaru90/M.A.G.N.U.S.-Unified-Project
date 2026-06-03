## 1. Engine configuration and typing animation refactor

- [x] 1.1 Introduce `ENGINE_CONFIG` object near the existing `typingSpeed` declaration with fields `typingSpeed: 15`, `postTypingEnterCooldownMs: 1000`, `scrollStepPx: 40`. Replace existing `typingSpeed` references to read from `ENGINE_CONFIG.typingSpeed`.
- [x] 1.2 Refactor `typeWriterHTML` to construct and return a typing handle exposing `skip()`, `cancel()`, and `isActive()`. Store the in-flight handle in a module-level `currentTypingHandle` slot. Starting a new `typeWriterHTML` MUST cancel any previous handle.
- [x] 1.3 Remove the legacy global `typingSkip` variable and the bare Enter handler at the top of the script. The Enter / Escape skip behaviour is consolidated in the unified global keydown handler added in 2.1.
- [x] 1.4 Implement `abortCurrentTyping()` helper that cancels the current typing handle (if any) and calls `typingSound.stop()`. Verify by opening `index.html` and inspecting `currentTypingHandle` becomes null after disconnect mid-typing.

## 2. Skip gestures (Enter, Escape, left-click, tap)

- [x] 2.1 Add a single global `keydown` handler that, while `currentTypingHandle?.isActive()`, intercepts `Enter` and `Escape` and calls `currentTypingHandle.skip()` with `preventDefault()`. The handler MUST early-return for these keys so the choices-panel handler does not also run.
- [x] 2.2 Add a global `pointerdown` handler (capture phase) that skips typing on left mouse button (`pointerType === 'mouse' && button === 0`) and on primary touch press (`pointerType === 'touch'` or `'pen'` with `isPrimary === true`). Skip MUST work regardless of which DOM element receives the event. Do NOT call `preventDefault()` on the pointerdown itself.
- [x] 2.3 Add a capture-phase global `click` listener gated on a `suppressNextClickAfterSkip` boolean. When set, it MUST call `stopPropagation()` + `preventDefault()` and consume the flag. The flag is set by the skip pointerdown handler from 2.2.
- [x] 2.4 Confirm no `contextmenu` handler is added — right-click must retain its default browser behaviour at all times, including during typing.
- [ ] 2.5 Manually verify: hold Enter during typing — animation skips and no choice activates after the cooldown elapses; press Escape during typing — animation skips and no `goBack`/disconnect occurs; left-click anywhere during typing — animation skips, no choice activates even if the cursor was over the spot where a button later renders; right-click during typing — context menu appears normally, animation continues; tap during typing on a touch device — animation skips, no choice activates from the tap; after typing finishes, a fresh left-click on a choice activates it normally.

## 3. Post-typing Enter cooldown

- [x] 3.1 In the typing completion path (both natural completion and post-`skip()`), record `lastTypingEndAt = performance.now()` before invoking the completion callback.
- [x] 3.2 In the `showChoices` keydown handler, gate the Enter branch on `performance.now() - lastTypingEndAt >= ENGINE_CONFIG.postTypingEnterCooldownMs`. When the cooldown is active, the handler MUST still call `preventDefault()` but MUST NOT call `document.activeElement.click()` and MUST NOT play any sound.
- [ ] 3.3 Manually verify: at default 1000 ms, holding Enter through a node's typing animation does not auto-trigger the first choice; pressing Enter ~1.2 s after typing completes activates the choice normally; arrow navigation during the cooldown moves focus normally; clicking a choice with the mouse during the cooldown works (the cooldown is keyboard-only).

## 4. Viewport auto-follow during typing

- [x] 4.1 Add module-level flags `autoFollowEnabled` and `suppressNextScrollEvent` (boolean). Initialise both to safe defaults.
- [x] 4.2 On `renderNode` entry, set `autoFollowEnabled = true`.
- [x] 4.3 In the `typeWriterHTML` tick (the `type()` inner function), when `autoFollowEnabled` is true and the cursor element's `getBoundingClientRect().bottom > window.innerHeight`, set `suppressNextScrollEvent = true` and call `cursor.scrollIntoView({ block: 'end', behavior: 'auto' })`. Only fire on visible characters (not inside tags) to avoid jitter.
- [x] 4.4 Add a `window` `scroll` listener (passive) that, when `suppressNextScrollEvent` is true, consumes the flag and returns; otherwise sets `autoFollowEnabled = false`.
- [ ] 4.5 Manually verify on a long node: cursor stays visible while typing; scrolling manually during typing freezes auto-follow for the rest of that node; navigating to the next node restores auto-follow.

## 5. Free scrolling and CRT overlay re-anchoring

- [x] 5.1 Remove `overflow: hidden` from the `body, html` rule. Remove the now-redundant `@media (max-width: 768px) { body, html { overflow: auto; } }` override.
- [x] 5.2 Re-anchor `.crt::before` to `position: fixed; inset: 0;` so it covers the visible viewport at every scroll position. Verify the scanline pattern still tiles correctly (sizes/gradients unchanged).
- [ ] 5.3 Manually verify on desktop and mobile: terminal screen scrolls vertically when content overflows; CRT overlay does not disappear or detach when scrolling; focus on a choice button is preserved across manual scrolls.

## 6. Scroll-into-view on focus change

- [x] 6.1 Add a shared helper `scrollFocusIntoViewIfNeeded(el)` that checks `rect.top < 0 || rect.bottom > window.innerHeight` and, if either is true, sets `suppressNextScrollEvent = true` then calls `el.scrollIntoView({ block: 'nearest', behavior: 'auto' })`.
- [x] 6.2 Wire the helper into the `showChoices` keydown handler immediately after each `focusables[...].focus()` call for both `ArrowUp` and `ArrowDown` branches.
- [x] 6.3 Wire the same helper into `makeNavHandler` for the `ArrowUp` / `ArrowDown` branches so boot-screen and login-screen navigation also scrolls newly-focused elements into view when off-screen.
- [ ] 6.4 Manually verify: with enough choices to exceed the viewport, ArrowDown past the visible area scrolls just enough to reveal the new focus; ArrowDown to an already-visible button does not scroll; manually scrolling after a focus change does not re-snap to the focused button until another focus change.

## 7. w / s page-scroll shortcuts and text-input suppression helper

- [x] 7.1 Add `isTextInputFocused()` helper returning true for `<textarea>`, `<input>` of types `text|password|email|search|url|tel|number`, and elements with `isContentEditable === true`.
- [x] 7.2 Add a global `keydown` handler for `w` and `s`. Early-return if `isTextInputFocused()` is true (so the key types into the input). Otherwise, call `e.preventDefault()` and `window.scrollBy({ top: ±ENGINE_CONFIG.scrollStepPx, behavior: 'auto' })`. Do NOT set `suppressNextScrollEvent` (a manual `w`/`s` mid-typing is a deliberate manual scroll and SHOULD disable auto-follow).
- [x] 7.3 Audit existing handlers (`makeNavHandler`, the `showChoices` handler) to confirm none of them consume letter keys today. Document the suppression rule in a one-line comment above `isTextInputFocused()`.
- [ ] 7.4 Manually verify: focus a choice button, press `w` — page scrolls up by 40 px; press `s` — page scrolls down; focus `#hidden-input`, type "wasd" — characters appear in the input, page does not scroll; focus `#login-password`, type "swordfish" — characters appear, page does not scroll.

## 8. Audio cleanup on every back-to-boot path

- [x] 8.1 Call `abortCurrentTyping()` as the first line of `disconnectTerminal()`.
- [x] 8.2 Call `abortCurrentTyping()` in the `isRootLogin` branch of the login-back button handler in `showLoginView`, before `initBoot()` runs.
- [x] 8.3 Call `abortCurrentTyping()` at the entry of every error fall-through that re-renders the boot screen: the `initBoot` catch block and the `loadServerFile` catch block.
- [x] 8.4 Call `abortCurrentTyping()` at the entry of `initBoot()` itself as defence-in-depth.
- [ ] 8.5 Manually verify: start a tape, click into a node with text, press the disconnect button mid-typing — typing sound stops before the boot screen appears, no "ghost" callback runs (verifiable by inspecting that no `showChoices` artifacts appear in the hidden terminal container).

## 9. Final integration tests and cleanup

- [ ] 9.1 Smoke test the full app on Chrome (desktop), Firefox (desktop), Safari (desktop), and Chrome/Safari on a real mobile device or emulator. Cover: boot, select a tape, navigate through nodes, skip typing via each gesture (Enter, Escape, left-click on empty area, left-click on the spot a button will appear, tap), arrow-navigate choices off-screen, w/s scroll, w/s while focused in `#login-password`, disconnect mid-typing.
- [ ] 9.2 Confirm no console errors and no listener leaks across at least 20 disconnect/reconnect cycles (the unused listener slots from the previous Enter-skip mechanism should be gone).
- [ ] 9.3 Confirm Italian-language UI strings are unchanged. Diff the file against the previous version and verify no string changes were introduced.
- [ ] 9.4 Verify that right-click anywhere on the page still opens the native browser context menu (including during typing).
