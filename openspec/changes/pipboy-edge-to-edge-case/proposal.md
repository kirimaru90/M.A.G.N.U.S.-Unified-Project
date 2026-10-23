## Why

Installed as an app on an Android phone, the Pip-Boy case does not reach the top of the display: a near-black strip sits where the camera cutout is, the case starts beneath it, and the case then reserves a second, empty band for the same cutout. The safe-area inset is applied twice (once as `body` padding, once as `.pb-statusbar` padding), and the same happens at the bottom (`body` padding plus `.pb-footer` padding). The two status-bar nubs (back, exit) are also centred on the row the camera now overlaps, and every case control is a small tap target (22px knob, 40×20 nub).

## What Changes

- **Edge-to-edge case when installed.** In fullscreen/standalone, `body` stops padding by the safe-area insets. `.pb-case` reaches all four display edges, and each inset is absorbed **inside** the case exactly once:
  - **Top (portrait):** the status bar's height equals the top inset, with no padding above it, so the status text sits in line with the camera. With no inset (browser tab, desktop), the status bar keeps today's spacing.
  - **Sides (landscape):** the case's side padding becomes `max(14px, inset)`, so the camera sits on case material, never over the screen.
  - **Bottom (gesture bar / home indicator):** the case's bottom padding becomes `max(12px, inset)`, so the bezel controls sit above the gesture handle. `.pb-footer` stops adding the bottom inset a second time.
  - **Installed:** the case drops its outer `26px` corner radius and outer drop shadow; the display's own rounded corners become the case's corners. A browser tab keeps the floating, rounded case.
- **BREAKING (UI): status-bar nubs removed.** The status bar shows only the status dot and label (left) and the OS label (right); its centre is left empty for a centred punch-hole camera.
- **Navigation moves into IMPOSTAZIONI.** The settings popup gains a navigation section, below its existing actions, that depends on the current screen: `CAMBIA PERSONAGGIO` (sheet), `CAMBIA CAMPAGNA` (sheet and character select), `ESCI` (critical-red, every logged-in screen, keeping the existing confirmation). On login the section is absent.
- **Android back gesture.** The system back action (Android back gesture or button, browser back) is handled in this order: close the topmost open popup or dialog → leave the map's immersive mode → go up one level (sheet → character select → campaign select). On a screen with nothing above it, back does nothing: the installed app does not close because of back, and is left through the system home/recents gestures. Platform limit: browsers skip history entries added without user activation, so a back press made with no tap since the previous one (or since launch) may still close the app; one tap in between restores the protection. (In a plain browser tab, back at the top is left to the browser, so the tab is not trapped.) Back **never** logs out.
- **Bigger bezel controls, same bezel band.** The decorative right knob is removed. The `⚙` knob grows to ~38×38px, unconditionally (every device). The `✎` editor toggle becomes a second knob, identical to the `⚙` one (same 38px circle and body) except for its glyph. The gap and padding are rebalanced so the band from the screen's bottom edge to the case's bottom edge stays 56px: the screen loses no height.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pipboy-responsive-shell`: the safe-area rule changes from "outer inset around the case" to "case reaches every display edge when installed; each inset is absorbed once inside the case"; adds flat corners when installed and the single-application rule for the bottom inset.
- `pipboy-terminal-chrome`: case and bezel chrome: status bar without nubs, sized to the top inset; bezel with two identical knobs (`⚙`, `✎`) either side of the grille, at the new size, within an unchanged 56px band; installed-mode corners. Rounded-element list and lit-state requirement drop the back/exit nubs and the exit nub's critical-red glyph rule.
- `pipboy-app-shell`: the navigation requirement replaces the two status-bar nubs with the settings popup's navigation actions plus the system back action, with the back-handling order above.
- `pipboy-settings`: adds the screen-dependent navigation section (`CAMBIA PERSONAGGIO`, `CAMBIA CAMPAGNA`, `ESCI`) to the settings popup.

## Impact

- **Code (`apps/pip-boy`):**
  - `index.html`: remove `#pb-nav-back`, `#pb-nav-exit` and the decorative `.pb-knob` span.
  - `src/styles/pipboy.css`: safe-area handling on `body`, `.pb-case`, `.pb-statusbar` and `.pb-footer`; installed-mode media query; bezel sizing; remove the status-bar nub and `#pb-nav-exit` rules.
  - `src/engine/chrome.js`: `setCaseNav` stops driving buttons and instead records the current screen's navigation actions.
  - `src/engine/settings-popup.js`: renders the navigation section.
  - `src/main.js`: back-gesture handling through the History API.
- **No API, data, or deployment changes.** The PWA manifest (`display_override: fullscreen`) and `viewport-fit=cover` are unchanged and remain required.
- **Specs:** `pipboy-pwa-installability`'s iOS requirement ("screen extends under the status bar, header content kept clear by safe-area insets") stays satisfied; it needs no delta.

## Testing

All verification is **e2e (Playwright)** in `apps/pip-boy/tests`, loading `index.html` and asserting on the live DOM. Insets are simulated by overriding the `--pb-safe-*` custom properties, and installed mode by `--pb-edge-margin: 0` / emulated `display-mode`, as `mobile-swipe-fullscreen.spec.ts` already does.

- **Shell geometry** (`responsive-shell`, `mobile-swipe-fullscreen`): with a top inset, the case's top edge is at y=0 and the status bar's height equals the inset; with side insets, the screen's left/right edges are at least the inset from the viewport edge; with a bottom inset, the bezel controls are above the inset and `.pb-footer` does not add it again; installed mode has a `0` outer radius; a browser tab keeps the floating, rounded case.
- **Chrome** (`terminal-chrome`): the status bar contains no buttons; the bezel holds exactly `⚙`, the grille and `✎`; both controls are at least 36px tall; the screen-bottom-to-case-bottom band is 56px (±1); the rounded-element list matches.
- **Navigation** (`settings`, `sheet-layout`, `dice-roller`, `map-fullscreen` updated wherever they reference the nubs): the popup shows the right actions on each screen; each action navigates correctly; `ESCI` confirms before logging out.
- **Back gesture**: `page.goBack()` closes an open popup first, then leaves immersive map mode, then goes up one level; on campaign select and login in installed mode it is consumed (the app stays on the same screen, an app history entry is still on top, nothing logs out); in a browser tab it is not intercepted.
- **Not automatable:** what a real Android cutout and gesture bar look like on a phone. The final visual check is done manually on the user's installed PWA.
