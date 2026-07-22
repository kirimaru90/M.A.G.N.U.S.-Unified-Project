## 1. Case markup and styles

- [ ] 1.1 In `apps/pip-boy/index.html`, remove `#pb-statusbar-nav` and its two children (`#pb-nav-dossier`, `#pb-nav-logout`).
- [ ] 1.2 Add two new permanent `.pb-nub` buttons inside `#pb-statusbar`, centered between the status dot/label group and the `PIP-BOY OS` label — e.g. `#pb-nav-back` and `#pb-nav-exit` — both `type="button"`, starting with empty text content and `disabled` (the login default).
- [ ] 1.3 In `apps/pip-boy/src/styles/pipboy.css`, adjust `.pb-statusbar` layout (flex alignment/gap) so the two new nubs sit centered without disturbing the existing left/right groups; confirm `.pb-nub`'s fixed 40×20 sizing and `:disabled` dimming apply unchanged to the new buttons with no new CSS class needed for the no-glyph state.

## 2. `chrome.js` case-nav API

- [ ] 2.1 In `apps/pip-boy/src/engine/chrome.js`, replace `showSheetNav`/`hideSheetNav` with `setCaseNav({ back, exit })`, where each of `back`/`exit` is either `{ label, onActivate }` or `null` (per design.md's decision on a single nullable slot rather than a separate `enabled` flag).
- [ ] 2.2 `setCaseNav` sets each nub's `textContent` (glyph or empty), `title`/`aria-label` (the `label` or none), `disabled` (`!!record`), and rebinds the click listener (removing any previously bound handler first, following the existing rebind pattern `showSheetNav` used for `boundBack`/`boundLogout`).
- [ ] 2.3 Confirm neither nub's styling path ever adds an `.on` class — no code in `setCaseNav` (or anywhere else) touches `.on` for these two elements.

## 3. Screen wiring

- [ ] 3.1 In `apps/pip-boy/src/main.js`, call `setCaseNav(...)` from `showLogin`, `showCampaignSelect`, `showCharacterSelect`, and `showSheet`, per the state matrix in design.md (`back`/`exit` null on login; campaign-select back null, exit → logout; character-select back → campaign-select, exit → logout; sheet back → character-select, exit → logout).
- [ ] 3.2 Remove the now-redundant `hideSheetNav()` call from `resetChrome()`.
- [ ] 3.3 In `apps/pip-boy/src/screens/campaign-select.js`, remove the `#pb-camp-logout` button and its markup/wiring; logout is now driven by `main.js`'s `setCaseNav` call, not this screen module.
- [ ] 3.4 In `apps/pip-boy/src/screens/character-select.js`, remove the `#pb-char-logout` and `#pb-char-back` buttons and their markup/wiring; both are now driven by `main.js`'s `setCaseNav` call.
- [ ] 3.5 In `apps/pip-boy/src/screens/sheet.js`, remove the `showSheetNav({...})` call (back/exit now set by `main.js`'s `showSheet`); keep the sheet's own `onToggleEdit`/`canEdit` wiring for the editor toggle as-is (unaffected by this change).

## 4. Test updates

- [ ] 4.1 In `apps/pip-boy/tests/terminal-chrome.spec.ts`: update `'the bottom bezel renders two knobs, a ridged grille and a slider nub'` (bezel `.pb-nub` count stays 1 — the editor toggle is still the only bezel nub); add/replace the sheet-nav section (`'the status bar carries the sheet-only nav...'`, `'◄ DOSSIER returns to character selection...'`, `'the owner sees ◄ DOSSIER and ESCI in the status bar...'`) with assertions against the new `#pb-nav-back`/`#pb-nav-exit` status-bar nubs and their per-screen state.
- [ ] 4.2 Add new test coverage (in `terminal-chrome.spec.ts` or a new spec file) for: both nubs present in the DOM on login/campaign-select/character-select/sheet; fixed 40×20 size regardless of glyph presence; the per-screen enabled/glyph/label matrix from the proposal; back-nub activation navigates to the correct target per screen; exit-nub activation logs out; neither nub ever gains `.on`.
- [ ] 4.3 Update `apps/pip-boy/tests/sheet-layout.spec.ts`, `dice-roller.spec.ts`, `settings.spec.ts`, `responsive-shell.spec.ts`, `map-fullscreen.spec.ts` for any reference to the removed elements (`#pb-nav-dossier`, `#pb-nav-logout`, `#pb-camp-logout`, `#pb-char-logout`, `#pb-char-back`) or to sheet navigation, swapping in the new `#pb-nav-back`/`#pb-nav-exit` selectors where equivalent coverage is needed.
- [ ] 4.4 Run `npx playwright test` from `apps/pip-boy` and confirm all tests pass.

## 5. Manual verification

- [ ] 5.1 Open the app in a browser and walk login → campaign-select → character-select (dossier) → sheet → back to dossier → back to campaign-select → exit, confirming both case nubs show the right glyph/label/enabled state at each step and neither ever lights up like the editor toggle.
