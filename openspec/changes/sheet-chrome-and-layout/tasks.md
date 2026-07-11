# Tasks

## 1. Relocate the editor toggle to the status bar

- [ ] 1.1 In `apps/pip-boy/index.html`, add a `✎` button to `#pb-statusbar-nav`, after `ESCI`,
      styled `.pb-statusbar-btn`; keep the nav container hidden outside the sheet.
- [ ] 1.2 In `apps/pip-boy/src/engine/chrome.js`, extend `showSheetNav` to accept an `onToggleEdit`
      callback and a `canEdit` flag: bind the toggle, reflect active state via a class, and hide the
      toggle entirely when `!canEdit`. Rebind cleanly on sheet re-mount (as `showSheetNav` already
      does for back/logout).
- [ ] 1.3 In `apps/pip-boy/src/screens/sheet.js`, remove the tab-bar `✎` (`.pb-tab--editor`) and its
      handler; drive `editMode` from the status-bar toggle, keeping the reset-on-open and
      owner/admin-only rules.
- [ ] 1.4 In `pipboy.css`, add `.pb-statusbar-btn` active styling for the toggle and remove the now
      unused `.pb-tab--editor` rule.

## 2. Editor-mode ring

- [ ] 2.1 In `index.html`, add a non-interactive `#pb-editor-ring` overlay sibling to
      `#pb-critical-ring` (same `14px` radius, `pointer-events: none`), green:
      `border: 1px solid var(--green-border-strong)` with an inset green glow.
- [ ] 2.2 In `chrome.js`, add `setEditorChrome(on)` mirroring `setCriticalChrome`; when the character
      is in critical state the amber critical ring SHALL take precedence and the green ring stays
      hidden.
- [ ] 2.3 In `sheet.js`, call `setEditorChrome(editMode)` from `renderStrip`/toggle handling, and
      ensure `resetChrome` (on leaving the sheet) clears it.

## 3. Theme native select dropdowns

- [ ] 3.1 In `pipboy.css`, add `.pb-select option { background: var(--screen-bg); color: var(--phosphor); }`
      (and the same for any `optgroup`), so option popups render on-theme. Accept documented
      platform variance in native option styling.

## 4. Fill the viewport with a small margin

- [ ] 4.1 In `pipboy.css`, remove the fixed `max-width: 460px` (`.pb-case`) and the landscape
      `max-width: min(90vw, 900px)` / `height: min(94dvh, 700px)` caps; size `.pb-case` to fill the
      available viewport width and height minus the existing small `body` padding (the "tiny margin"),
      in both orientations.
- [ ] 4.2 Confirm the responsive-shell invariants still hold: scrolling stays inside
      `.pb-screen-content`; `html`/`body` never scroll; `.pb-case` size depends only on viewport and
      orientation, identical across screens.

## 5. Tests

- [ ] 5.1 Playwright: status bar shows `◄ DOSSIER`, `ESCI`, `✎` for an owner; tab bar has five tabs
      and no `✎`; a non-owner sees no `✎`.
- [ ] 5.2 Playwright: toggling editor mode adds/removes the green ring and the `◉ EDITOR` strip; a
      critical character in editor mode shows the amber ring (green suppressed).
- [ ] 5.3 Playwright: a `<select>` option's computed background is the dark screen token, not white.
- [ ] 5.4 Playwright: on a wide desktop viewport `.pb-case` fills the viewport minus the margin and
      exceeds `900px`; no page scrollbar; `.pb-screen-content` scrolls on overflow; `.pb-case` size is
      identical across `login → dossier → sheet`.
- [ ] 5.5 Run `npx playwright test` from `apps/pip-boy`; confirm all pass, including the existing
      "only named elements are rounded" chrome check.
