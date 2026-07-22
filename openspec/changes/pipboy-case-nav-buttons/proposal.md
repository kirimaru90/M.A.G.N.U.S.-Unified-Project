## Why

Today `◄ DOSSIER`/`ESCI`/`◄ CAMBIA CAMPAGNA` are on-screen `pb-btn`/`pb-statusbar-btn` elements that only exist in the DOM on the screen that needs them (sheet-only nav, per-screen ESCI buttons on campaign-select and character-select). The reference case treats every physical control — the `⚙` settings knob and the `✎` editor toggle — as permanent case furniture: always rendered, sized independent of content, inert-but-visible when there's nothing to do. Back/exit navigation is the odd one out, and the user wants it to read the same way: two permanent physical nubs in the case status bar, not text buttons that pop in and out of the screen depending on where you are.

## What Changes

- **BREAKING**: Remove the on-screen `◄ DOSSIER`/`ESCI` sheet-only status-bar nav (`#pb-nav-dossier`, `#pb-nav-logout`, `#pb-statusbar-nav`), the campaign-select `ESCI` button (`#pb-camp-logout`), and the character-select `ESCI`/`◄ CAMBIA CAMPAGNA` buttons (`#pb-char-logout`, `#pb-char-back`). None of these on-screen elements remain.
- Add two new permanent `.pb-nub`-styled physical controls seated centered inside `.pb-statusbar` (between the status dot/label and the `PIP-BOY OS` label) — a **back nub** and an **exit nub** — present in the DOM on every screen (login, campaign-select, character-select/dossier, sheet), fixed-size regardless of whether a glyph is present.
- Back nub is contextual, one control whose glyph/label/target changes per screen, never a fixed "go to dossier" action:
  - login / campaign-select: no glyph, `disabled` (nothing above it to return to)
  - character-select (the DOSSIER screen): glyph `◄`, accessible name `CAMPAGNA`, activates → campaign selection
  - sheet: glyph `◄`, accessible name `DOSSIER`, activates → character selection
- Exit nub: glyph `⏻` (power symbol) when functional, accessible name `ESCI`, logs out and returns to login.
  - login: no glyph, `disabled`
  - campaign-select / character-select / sheet: functional
- Neither new nub ever receives the `.on` lit-LED treatment `#pb-editor-toggle` carries — that persistent glow stays reserved for a mode indicator that survives on the same screen; back/exit are one-shot actions that immediately navigate away, so only ordinary `:active` press feedback applies, never a sticky glow.
- `chrome.js`'s sheet-only `showSheetNav`/`hideSheetNav` API is replaced by a case-nav API every screen drives (its own back-target/label/enabled state and exit-enabled state), rather than only the sheet screen calling it and every other screen only hiding it.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pipboy-app-shell`: the "Navigation between sheet, character selection, campaign selection, and logout" requirement changes from sheet-only on-screen `[◄ DOSSIER][ESCI]` status-bar controls, plus separate on-screen ESCI/CAMBIA CAMPAGNA buttons on campaign-select and character-select, to two permanent physical case nubs present (and contextually enabled/labeled) on every screen.
- `pipboy-terminal-chrome`: the "Case and bezel chrome" requirement's status-bar description changes from "the sheet-only `[◄ DOSSIER][ESCI]` nav" to "two permanent back/exit nubs, styled and sized like the bezel's slider nub"; the "Bezel control lit state" requirement is clarified to state that the lit-state treatment applies only to the config knob and the editor nub, not the new back/exit nubs; the glyph vocabulary gains `⏻`.

## Impact

- `apps/pip-boy/index.html`: remove `#pb-statusbar-nav` and its two buttons; add two new permanent nub buttons inside `#pb-statusbar`.
- `apps/pip-boy/src/engine/chrome.js`: replace `showSheetNav`/`hideSheetNav` with an API every screen calls to set the two nubs' glyph/label/handler/enabled state.
- `apps/pip-boy/src/main.js`: each screen-transition function (`showLogin`, `showCampaignSelect`, `showCharacterSelect`, `showSheet`) drives the new case-nav state instead of only `resetChrome()`/`hideSheetNav()`.
- `apps/pip-boy/src/screens/campaign-select.js`: remove the on-screen `#pb-camp-logout` button; wire logout through the new case-nav call instead.
- `apps/pip-boy/src/screens/character-select.js`: remove the on-screen `#pb-char-logout` and `#pb-char-back` buttons; wire logout and back-to-campaign through the new case-nav call instead.
- `apps/pip-boy/src/screens/sheet.js`: swap its `showSheetNav` call for the new case-nav API.
- `apps/pip-boy/src/styles/pipboy.css`: new nub styles (reusing `.pb-nub`), no-glyph/disabled variant, status-bar layout to fit the two centered nubs.
- Test impact — six existing spec files reference elements being removed and need review/update: `terminal-chrome.spec.ts` (heaviest: the sheet-nav section, the `.pb-nub` count-of-1 assertion, the editor-nub-specific tests need to stay scoped to `#pb-editor-toggle` only), `sheet-layout.spec.ts`, `dice-roller.spec.ts`, `settings.spec.ts`, `responsive-shell.spec.ts`, `map-fullscreen.spec.ts`.

## Testing

- **e2e (Playwright, `apps/pip-boy/tests/`)**: this is a `pipboy-*` (emulator-family, no-build static app) UI change, verified by Playwright loading `index.html` and asserting on the live DOM, superseding manual browser checks. New/updated specs cover:
  - both nubs render on every screen (login, campaign-select, character-select, sheet), always present in the DOM, fixed 40×20 size whether or not a glyph is rendered.
  - per-screen glyph/label/enabled state matrix (login: both inert/no-glyph; campaign-select: back inert/no-glyph, exit functional; character-select: back → campaign-select, exit → logout; sheet: back → character-select, exit → logout).
  - activating the back nub navigates to the correct target per screen; activating the exit nub logs out and returns to login.
  - neither nub ever carries the `.on` class, including immediately after a click, distinguishing them from `#pb-editor-toggle`.
  - existing border-radius/glyph-vocabulary/no-emoji assertions in `terminal-chrome.spec.ts` still pass with the new nubs present.
- No unit-level logic is introduced (no build step, no framework) — behavior lives in DOM wiring, so e2e is the only meaningful layer here.
