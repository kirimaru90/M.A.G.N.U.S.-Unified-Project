## Why

Four chrome/layout papercuts on the sheet, grouped because they all live in the case shell and its
theme tokens:

- **Edit mode is easy to miss.** The only cue is the green `◉ EDITOR` strip; there's no strong,
  always-visible signal that taps are now mutating data.
- **The `✎` toggle is in the wrong place.** It sits at the end of the tab bar, disconnected from the
  `◄ DOSSIER` / `ESCI` controls it belongs with — both are "sheet chrome" actions, not content tabs.
- **Selection dropdowns render white.** Native `<select>` option popups (skill level, PA source,
  reroll skill, add-skill/species) ignore the phosphor theme and appear as a bright OS-default list,
  breaking the CRT look.
- **The case doesn't fill the screen.** It's capped at `460px` (portrait) / `900px` (landscape) and
  floats in a large dead margin on desktop. It should grow to fill the viewport, keeping only a
  small uniform margin so it isn't flat against the edge — internal scrolling stays inside
  `.pb-screen-content` as today.

## What Changes

- **Move the `✎` editor toggle into the case status bar**, beside `◄ DOSSIER` and `ESCI`, styled as a
  `.pb-statusbar-btn` (same theme). It leaves the tab bar, which returns to exactly five equal-width
  tabs. The toggle is still shown only to a user who may write the character (owner or admin).
- **Add a green editor-mode ring** around the screen while editor mode is on — mirroring the existing
  amber critical-state ring mechanism (a non-interactive `14px` overlay, no layout shift). The green
  `◉ EDITOR` strip stays. When the character is also in critical state, the amber critical ring takes
  precedence (consistent with the banner precedence rule).
- **Theme native select dropdowns**: `<select>` option lists render on the phosphor theme (dark
  screen background, phosphor text) rather than the browser default.
- **Fill the viewport with a small margin**: `.pb-case` grows to fill the available width and height
  in every orientation, minus a small uniform margin, with no fixed pixel `max-width`/`max-height`
  cap. Scrolling remains confined to `.pb-screen-content`.

All client/CSS work in `apps/pip-boy`. No API changes.

## Capabilities

### Modified Capabilities

- `pipboy-character-sheet`: "Editor mode toggle" moves to the status bar; "Five-tab sheet layout"
  drops the trailing `✎` from the tab bar.
- `pipboy-app-shell`: the sheet status-bar navigation gains the `✎` toggle as a third control
  (owner/admin only), beside `◄ DOSSIER` and `ESCI`.
- `pipboy-terminal-chrome`: "Case and bezel chrome" lists the editor toggle among the status-bar
  controls; "Control vocabulary" requires `<select>` option lists to render on-theme; a new
  "Editor-mode ring" requirement adds the green ring and its precedence under the critical ring.
- `pipboy-responsive-shell`: "Responsive fullscreen shell" is tightened to fill the viewport minus a
  small uniform margin with no fixed pixel cap.

## Testing

- **pip-boy (Playwright, `apps/pip-boy/tests`)**:
  - Open a sheet as owner → the status bar shows `◄ DOSSIER`, `ESCI`, and `✎`; the tab bar shows
    exactly five tabs and no `✎`. As a non-owner viewer, no `✎` appears anywhere.
  - Activate `✎` → the green editor ring is present and the `◉ EDITOR` strip shows; deactivate → the
    ring is gone. With a critical character in editor mode, the amber ring is shown (green ring
    suppressed).
  - A `<select>`'s computed `option` background is the dark screen token, not white.
  - Measure `.pb-case` on a wide desktop viewport: its width fills the viewport minus the margin and
    exceeds the old `900px` cap; `html`/`body` produce no scrollbar; `.pb-screen-content` still
    scrolls when content overflows. Assert `.pb-case` size is unchanged across `login → dossier →
    sheet` (the responsive-shell invariant).
  - Regression: the "only named elements are rounded" chrome check still holds (the ring reuses the
    `14px` screen radius; nothing new is rounded).

## Impact

- **Code**:
  - `apps/pip-boy/index.html` — add the `✎` button to `#pb-statusbar-nav`; add a green
    `#pb-editor-ring` overlay sibling to `#pb-critical-ring`.
  - `apps/pip-boy/src/engine/chrome.js` — `showSheetNav` gains an `onToggleEdit` callback and manages
    the toggle's visibility/active state; add `setEditorChrome(on)` mirroring `setCriticalChrome`,
    with critical taking precedence.
  - `apps/pip-boy/src/screens/sheet.js` — remove the tab-bar `✎`; drive edit state through the
    status-bar toggle and `setEditorChrome`.
  - `apps/pip-boy/src/styles/pipboy.css` — `.pb-select option` theming; a `.pb-editor-ring` rule; and
    `.pb-case` sizing (drop the `460px`/`900px` caps, fill minus margin).
- **Architecture note**: the status-bar nav lives outside `#app` and is driven by `chrome.js`, while
  edit state lives in the sheet render. Moving the toggle crosses that boundary the same way
  `setCriticalChrome` already does — the proven pattern is copied, not invented.
- **Risk**: low. `<select>` option theming is only partially honored on some platforms (a known
  native limitation); the spec states the on-theme intent and the implementation applies
  `option { background; color }`, accepting platform variance rather than replacing the control.
- **Dependencies**: none. Independent of the other pip-boy changes.
