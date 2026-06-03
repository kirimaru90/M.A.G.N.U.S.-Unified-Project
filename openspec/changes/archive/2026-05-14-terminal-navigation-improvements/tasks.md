## 1. CSS — Focus and Exit Button Styles

- [x] 1.1 Add `.choice-btn:focus` rule to CSS matching the existing `:hover` style (green background, dark text, no text-shadow), so focused buttons are visually distinct within the CRT aesthetic
- [x] 1.2 Add `.choice-btn-system` class to CSS: inherits from `.choice-btn` layout but sets `opacity: 0.5` and `text-shadow: none`, for the discrete disconnect button
- [x] 1.3 Add `.system-separator` style for the `---` divider element (e.g. `opacity: 0.3`, no margin excess)

## 2. Disconnect Button — Terminal Exit

- [x] 2.1 Add a `disconnectTerminal()` function that resets `terminalData = {}`, `navigationHistory = []`, `seenNodes = new Set()`, hides `terminalContainer`, shows `bootScreen`, and calls `initBoot()`
- [x] 2.2 In `showChoices()`, after rendering all choice buttons and the optional back button, check `if (navigationHistory.length === 1)` and if true: append a `.system-separator` `<p>---</p>` and a `.choice-btn-system` button labelled `"[ disconnetti terminale ]"` whose `onclick` calls `disconnectTerminal()`
- [x] 2.3 Apply `addBtnSounds()` to the disconnect button so hover/click sounds are consistent
- [x] 2.4 Verify in browser: open a terminal, reach `start` node → disconnect button appears; navigate to another node → disconnect button is absent

## 3. Keyboard Navigation — Arrow Keys and Enter

- [x] 3.1 Declare a module-level variable `let currentKeyHandler = null` to hold the active keyboard listener reference
- [x] 3.2 At the end of `showChoices()`, remove the previous listener (`if (currentKeyHandler) document.removeEventListener('keydown', currentKeyHandler)`) then build and attach a new handler that reads all buttons from `#choices-container`
- [x] 3.3 Implement `ArrowDown` in the handler: find the currently focused button's index, move focus to `(index + 1) % buttons.length` (wraps to first)
- [x] 3.4 Implement `ArrowUp` in the handler: move focus to `(index - 1 + buttons.length) % buttons.length` (wraps to last)
- [x] 3.5 Implement `Enter` in the handler: call `.click()` on `document.activeElement` if it is one of the choices buttons
- [x] 3.6 Call `preventDefault()` on ArrowUp, ArrowDown, and Enter events to prevent page scrolling
- [x] 3.7 Auto-focus the first button at the end of `showChoices()` after attaching the keyboard handler
- [x] 3.8 Verify in browser: after a node loads, ArrowDown/Up cycles focus, Enter triggers the choice, focus wraps correctly

## 4. Keyboard Navigation — Escape Key

- [x] 4.1 Implement `Escape` in the keyboard handler: if `navigationHistory.length > 1` call `goBack()`; otherwise call `disconnectTerminal()`
- [x] 4.2 Verify in browser: Escape from a deep node goes back one step; Escape from `start` node returns to the boot screen

## 5. Keyboard Navigation — Boot Screen

- [x] 5.1 Extract shared nav logic into `makeNavHandler(focusables)`: ArrowDown/Up navigate between focusable elements (skipping SELECTs where arrows change options); Enter on BUTTON triggers click; Enter on SELECT advances focus to next element; wraps at both ends
- [x] 5.2 In `initBoot()` success path, after attaching the hiddenInput Enter listener, set up `makeNavHandler` for all `button` and `input` elements in `#boot-screen`; auto-focus the first tape button
- [x] 5.3 In `initBoot()` error path, attach `makeNavHandler` for the single back button and auto-focus it
- [x] 5.4 In `loadServerFile()` error path, attach `makeNavHandler` for the single back button and auto-focus it

## 6. Keyboard Navigation — Login Screen

- [x] 6.1 In `showLoginView()`, after setting up submit/back onclick handlers, attach `makeNavHandler` for `[loginUsernameEl, loginPasswordEl, login-submit, login-back]`; auto-focus `loginUsernameEl`
- [x] 6.2 Verify in browser: on boot screen, ArrowDown cycles through tape buttons and reaches the archive input and submit; on login screen, Tab/ArrowDown cycles through fields; Enter on username select advances to password

## 7. Selection Sound

- [x] 7.1 Add `selectionSound = createSound('suoni/selection.mp3')` near the other sound declarations
- [x] 7.2 In `addBtnSounds()`, replace `hoverSound` with `selectionSound` on `mouseenter` so mouse hover and keyboard focus use the same sound
- [x] 7.3 In the `showChoices()` keyboard handler, call `selectionSound()` after moving focus on `ArrowDown` and `ArrowUp`
- [x] 7.4 In `makeNavHandler()`, call `selectionSound()` after moving focus on `ArrowDown` and `ArrowUp`

## 8. Click Sound on Textbox Confirm and Escape

- [x] 8.1 In `initBoot()`, at the top of `lookupHidden()`, call `clickSound()` so it plays once whenever the user confirms the tape search — whether via the submit button click or Enter on the hidden input
- [x] 8.2 In `showLoginView()`, add `clickSound()` at the start of the login-submit `onclick` handler (before the password check) so it plays once on any login attempt — whether via button click or Enter on the password field
- [x] 8.3 In the `showChoices()` keyboard handler's `Escape` branch, call `clickSound()` before `goBack()` or `disconnectTerminal()` so pressing Esc always plays a click sound
