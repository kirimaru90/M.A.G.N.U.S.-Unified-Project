## 1. Settings popup lifecycle signal

- [x] 1.1 In `apps/pip-boy/src/engine/settings-popup.js`, give `openSettingsPopup()` an `onClose` parameter (callback) and call it from the existing single `close()` closure, so both dismissal paths (the `✕` button and click-outside) report closure through the same choke point.
- [x] 1.2 Verify `openCreditsPopup` (and any other popup opened from within the settings popup) does not itself trigger the settings popup's `onClose` — only the settings overlay's own removal should fire it.

## 2. Markup: config knob and editor nub

- [x] 2.1 In `apps/pip-boy/index.html`, remove `#pb-nav-settings` from `#pb-statusbar-nav`, leaving `[◄ DOSSIER][ESCI]`.
- [x] 2.2 Change the left `<span class="pb-knob">` to `<button class="pb-knob" id="pb-config-knob" type="button" aria-label="Impostazioni" title="Impostazioni">⚙</button>`. Leave the right `<span class="pb-knob">` untouched (still `aria-hidden`, still a `<span>`).
- [x] 2.3 Change `<span class="pb-nub" aria-hidden="true"></span>` to `<button class="pb-nub" id="pb-editor-toggle" type="button" title="Modalità editor" hidden>✎</button>`, matching the id `chrome.js` already resolves. Keep it `hidden` by default only insofar as today's toggle was — reconcile with task 3.4 below, which changes this to "present but inert" rather than `hidden`.
- [x] 2.4 Remove the `.pb-bezel-editor` wrapper span and the `#pb-editor-led` element entirely from `index.html`.

## 3. Styling: idle, lit, and containment

- [x] 3.1 In `apps/pip-boy/src/styles/pipboy.css`, add interactive-state styles for `#pb-config-knob` and `#pb-editor-toggle`: `display: flex; align-items: center; justify-content: center;` so the glyph centers and stays fully contained, idle glyph color dim phosphor-green, transparent/inherited knob background unchanged from `.pb-knob`'s existing radial gradient.
- [x] 3.2 Grow `.pb-nub`'s dimensions (height primarily, width modestly) enough to hold the `✎` glyph legibly and offer a workable tap target, bounded so it never exceeds `.pb-knob`'s height (currently `22px`) — confirm in the browser that `.pb-bezel`'s rendered height is unchanged from before this change.
- [x] 3.3 Add a shared "lit" treatment (e.g. `.pb-knob.on`, `.pb-nub.on` or a shared class) matching the former `.pb-editor-led.on` intensity: solid `background: var(--phosphor)` with its glow box-shadow, and swap the glyph's `color` to `var(--screen-bg)` while lit. Remove the now-unused `.pb-bezel-toggle`, `.pb-bezel-editor`, and `.pb-editor-led` rules.
- [x] 3.4 Style the inert (non-editor, off-sheet) state of `#pb-editor-toggle`: glyph visible, no `hidden` attribute, but visually and functionally non-interactive (e.g. reduced opacity or `cursor: default`, no hover-fill) — distinct from both its idle-active and lit looks.
- [x] 3.5 Retain a hover/press affordance (analogous to today's `.pb-bezel-toggle:hover`) on both controls for the states where they are actually interactive, so idle interactive controls still signal clickability before any lit state.

## 4. Wiring: chrome.js

- [x] 4.1 In `apps/pip-boy/src/engine/chrome.js`, move the settings button lookup/bind (`#pb-config-knob`) out of `showSheetNav()`/`hideSheetNav()` into a one-time chrome-init step, wired to `openSettingsPopup` with the new `onClose` callback from task 1.1 that toggles the config knob's lit class off.
- [x] 4.2 Wire the config knob's lit class on when `openSettingsPopup()` is invoked (on, at open) and off via the `onClose` callback (at close), covering both dismissal paths.
- [x] 4.3 Update `showSheetNav()`/`hideSheetNav()`: stop referencing `#pb-editor-led`; instead of `hidden`/unhidden, toggle the editor nub between its active-interactive state and its inert state (per task 3.4) based on `canEdit`, and keep the click handler bound only when `canEdit` is true.
- [x] 4.4 Update `setEditorChrome(on)` to toggle a single lit class on `#pb-editor-toggle` (the nub) instead of separately toggling `.active` on the old toggle button and `.on` on the old LED element.

## 5. Update existing tests

- [x] 5.1 In `apps/pip-boy/tests/terminal-chrome.spec.ts`, remove `.pb-editor-led` and `.pb-bezel-toggle` from `ROUNDED_ALLOWLIST` (and any other reference), and update assertions that expect a separate LED element or the old toggle rectangle.
- [x] 5.2 In `apps/pip-boy/tests/settings.spec.ts`, update any assertion that expects `#pb-nav-settings` in the status bar to instead expect `#pb-config-knob` in the bezel.

## 6. New test coverage

- [x] 6.1 Add/extend a Playwright test asserting the bezel renders on every screen (`login`, campaign-select, character-select, sheet) with the config knob present and functional on each — opening the settings popup from a pre-login screen, not just the sheet.
- [x] 6.2 Add a test asserting the config knob is lit (computed background/glow matches the lit treatment) while the settings popup is open, and returns to idle after closing via the `✕` control, and separately via a click outside the popup.
- [x] 6.3 Add a test asserting a read-only sheet viewer (no write permission) sees the `✎` glyph on the nub but activating it has no effect (no editor mode entered, no lit state).
- [x] 6.4 Add a test asserting an editor toggling editor mode on/off lights and un-lights the nub itself (`#pb-editor-toggle`), with no separate LED element in the DOM.
- [x] 6.5 Add a test asserting both the `⚙` and `✎` glyphs render fully within their control's bounding box in both idle and lit states (no overflow), and that the glyph's computed color differs between idle and lit (the dark-ink swap).
- [x] 6.6 Confirm the right `.pb-knob` remains unchanged: still non-interactive, still `aria-hidden`, no lit-state classes ever applied to it.

## 7. Verification

- [x] 7.1 Run `npm test` (Playwright) from `apps/pip-boy` and confirm all specs pass, including the updated and new tests above.
- [x] 7.2 Manually open `index.html` (or the dev server) and visually confirm: config knob and editor nub sit in the bottom bezel; both glyphs are fully contained at every viewport size exercised by `pipboy-responsive-shell`; lit states are legible; the status bar no longer shows `⚙`.
