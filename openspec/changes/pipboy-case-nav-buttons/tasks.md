## 1. Case markup and styles

- [x] 1.1 In `apps/pip-boy/index.html`, remove `#pb-statusbar-nav` and its two children (`#pb-nav-dossier`, `#pb-nav-logout`).
- [x] 1.2 Add two new permanent `.pb-nub` buttons inside `#pb-statusbar`, centered between the status dot/label group and the `PIP-BOY OS` label — e.g. `#pb-nav-back` and `#pb-nav-exit` — both `type="button"`, starting with empty text content and `disabled` (the login default).
- [x] 1.3 In `apps/pip-boy/src/styles/pipboy.css`, adjust `.pb-statusbar` layout (flex alignment/gap) so the two new nubs sit centered without disturbing the existing left/right groups; confirm `.pb-nub`'s fixed 40×20 sizing and `:disabled` dimming apply unchanged to the new buttons with no new CSS class needed for the no-glyph state.

## 2. `chrome.js` case-nav API

- [x] 2.1 In `apps/pip-boy/src/engine/chrome.js`, replace `showSheetNav`/`hideSheetNav` with `setCaseNav({ back, exit })`, where each of `back`/`exit` is either `{ label, onActivate }` or `null` (per design.md's decision on a single nullable slot rather than a separate `enabled` flag).
- [x] 2.2 `setCaseNav` sets each nub's `textContent` (glyph or empty), `title`/`aria-label` (the `label` or none), `disabled` (`!!record`), and rebinds the click listener (removing any previously bound handler first, following the existing rebind pattern `showSheetNav` used for `boundBack`/`boundLogout`).
- [x] 2.3 Confirm neither nub's styling path ever adds an `.on` class — no code in `setCaseNav` (or anywhere else) touches `.on` for these two elements.

## 3. Screen wiring

- [x] 3.1 In `apps/pip-boy/src/main.js`, call `setCaseNav(...)` from `showLogin`, `showCampaignSelect`, `showCharacterSelect`, and `showSheet`, per the state matrix in design.md (`back`/`exit` null on login; campaign-select back null, exit → logout; character-select back → campaign-select, exit → logout; sheet back → character-select, exit → logout).
- [x] 3.2 Remove the now-redundant `hideSheetNav()` call from `resetChrome()`. (Its editor-toggle-disabling half was still load-bearing off-sheet, so `resetChrome()` now calls a new `setEditorToggle({ canEdit: false, onToggleEdit: null })` — see chrome.js — to keep that behavior, which design.md's non-goals require staying unaffected.)
- [x] 3.3 In `apps/pip-boy/src/screens/campaign-select.js`, remove the `#pb-camp-logout` button and its markup/wiring; logout is now driven by `main.js`'s `setCaseNav` call, not this screen module.
- [x] 3.4 In `apps/pip-boy/src/screens/character-select.js`, remove the `#pb-char-logout` and `#pb-char-back` buttons and their markup/wiring; both are now driven by `main.js`'s `setCaseNav` call.
- [x] 3.5 In `apps/pip-boy/src/screens/sheet.js`, remove the `showSheetNav({...})` call (back/exit now set by `main.js`'s `showSheet`); keep the sheet's own `onToggleEdit`/`canEdit` wiring for the editor toggle as-is, now via the new `setEditorToggle()` (unaffected in behavior by this change).

## 4. Test updates

- [x] 4.1 In `apps/pip-boy/tests/terminal-chrome.spec.ts`: update `'the bottom bezel renders two knobs, a ridged grille and a slider nub'` (bezel `.pb-nub` count stays 1 — the editor toggle is still the only bezel nub); add/replace the sheet-nav section (`'the status bar carries the sheet-only nav...'`, `'◄ DOSSIER returns to character selection...'`, `'the owner sees ◄ DOSSIER and ESCI in the status bar...'`) with assertions against the new `#pb-nav-back`/`#pb-nav-exit` status-bar nubs and their per-screen state.
- [x] 4.2 Add new test coverage (in `terminal-chrome.spec.ts` or a new spec file) for: both nubs present in the DOM on login/campaign-select/character-select/sheet; fixed 40×20 size regardless of glyph presence; the per-screen enabled/glyph/label matrix from the proposal; back-nub activation navigates to the correct target per screen; exit-nub activation logs out; neither nub ever gains `.on`.
- [x] 4.3 Update `apps/pip-boy/tests/sheet-layout.spec.ts`, `dice-roller.spec.ts`, `settings.spec.ts`, `responsive-shell.spec.ts`, `map-fullscreen.spec.ts` for any reference to the removed elements (`#pb-nav-dossier`, `#pb-nav-logout`, `#pb-camp-logout`, `#pb-char-logout`, `#pb-char-back`) or to sheet navigation, swapping in the new `#pb-nav-back`/`#pb-nav-exit` selectors where equivalent coverage is needed.
- [x] 4.4 Run `npx playwright test` from `apps/pip-boy` and confirm all tests pass. (339 passed; the one unrelated `map-place-focus.spec.ts` failure in the first run was a pre-existing flake — confirmed by re-running it standalone and the full suite again, both clean.)

## 5. Manual verification

- [x] 5.1 Open the app in a browser and walk login → campaign-select → character-select (dossier) → sheet → back to dossier → back to campaign-select → exit, confirming both case nubs show the right glyph/label/enabled state at each step and neither ever lights up like the editor toggle. (Verified via the Playwright case-nav matrix/activation/`.on` tests in `terminal-chrome.spec.ts`, which exercise this exact walk in a real Chromium instance, plus real-browser screenshots of the status bar on login/dossier/sheet confirming the nubs render centered, dim-and-glyph-less when disabled, and `◄`/`⏻` when active — no standalone dev backend was available to click through by hand.)

## 6. Amendment (2026-07-23): exit-nub icon and critical-red color

Reopened after completion — the exit nub's glyph and idle color are revised; scope stays confined to that one control (back nub, sizing, and every other decision above are unchanged). See design.md's amendment section for rationale.

- [x] 6.1 In `apps/pip-boy/src/engine/chrome.js`'s `setCaseNav`, change the exit nub's glyph from `⏻` to `✕` (the `textContent` assignment for `exitBtn`); the back nub's `◄` is untouched.
- [x] 6.2 In `apps/pip-boy/src/styles/pipboy.css`, give `#pb-nav-exit` a critical-red idle glyph: `color: var(--critical)` and `text-shadow: var(--critical-glow)` (matching the status-bar label's existing critical treatment), applied whenever the nub is enabled — not conditional on the character's own critical state. Body/border/background stay the shared `.pb-nub` styling (dark gradient, `#444a37` border) — only the glyph color changes, so the nub still reads as the same physical hardware as the back nub and editor toggle, just marked destructive. `:disabled` dimming (`opacity: 0.5`) continues to apply on top, per the existing `.pb-nub:disabled` rule.
- [x] 6.3 In `apps/pip-boy/tests/terminal-chrome.spec.ts`, update every assertion expecting `#pb-nav-exit` to have text `'⏻'` to expect `'✕'` instead; add a color assertion (computed `color`/`text-shadow` equals the critical-red token) for the exit nub, scoped so it does NOT assert the same for `#pb-nav-back`.
- [x] 6.4 Run `npx playwright test` from `apps/pip-boy` and confirm all tests pass. (346 passed.)
