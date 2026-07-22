## Why

The `⚙` settings control and the `✎` editor toggle are visually disconnected from the case's physical control language: `⚙` sits in the status bar as flat text, and `✎` sits in its own small rectangle bolted onto the bezel alongside a separate LED dot. Neither reads as part of the terminal's physical hardware. Folding both controls into the case's existing decorative knob and nub — and having each control's own body double as its "on" light, rather than pairing it with a separate LED — makes the bezel read as a real instrument panel instead of a row of web buttons glued to it.

## What Changes

- **BREAKING**: The `⚙` settings control moves out of `#pb-statusbar-nav` (top status bar) into the bottom bezel, replacing the left `.pb-knob`. The status bar nav becomes `[◄ DOSSIER][ESCI]` only.
- **BREAKING**: Settings reachability widens from sheet-only to every screen (login, campaign-select, character-select, sheet) — the config knob is part of the bezel, which is always rendered, and is active everywhere.
- The left `.pb-knob` becomes a real `<button>` (`id="pb-config-knob"`), carrying the `⚙` glyph fully contained within its 22px circle, plus an Italian accessible name (`Impostazioni`). The right `.pb-knob` is untouched — still a decorative, non-interactive `<span>`.
- **BREAKING**: The `✎` editor toggle and its separate round LED (`#pb-editor-led`) collapse into one element: `.pb-nub` becomes the toggle button itself (`id="pb-editor-toggle"`, glyph fully contained). The `.pb-bezel-editor` wrapper, `.pb-bezel-toggle` class, and `.pb-editor-led` element are removed. `pb-nub` grows (primarily in height) enough to hold a legible glyph and a workable tap target — exact dimensions are a design.md decision.
- On the sheet, for a viewer without write permission, the edit nub keeps rendering its `✎` glyph at all times (no `hidden`) but does not respond to activation — it no longer disappears the way the old toggle+LED pair did.
- Off the sheet (login, select screens), the edit nub is present but inert — editor mode is a sheet-only concept, and it carries no settings-style "everywhere" widening.
- Both controls' "lit" state is now carried by the control itself, not a neighboring dot: when active, the knob/nub fills with solid phosphor green (the same full-fill treatment the old standalone LED used) and its glyph **swaps to a dark ink color** so it stays legible against its own bright fill, instead of disappearing into it. At rest the glyph renders dim phosphor-green on the dark knob/nub body, as today's icons do.
- The config knob lights only while the settings popup is open, and goes dark the instant it closes — this requires `settings-popup.js`'s `openSettingsPopup()` to report closure back to its caller (currently `close()` is a closure fully private to that module), so `chrome.js` can un-light the knob.
- The edit nub keeps its existing lit semantics: lit for as long as editor mode is on, exactly as the old LED did.

## Capabilities

### New Capabilities
(none — this reshapes existing chrome, it does not introduce a new capability)

### Modified Capabilities
- `pipboy-terminal-chrome`: "Case and bezel chrome" and "Editor-mode case LED" requirements change — the bottom bezel's left knob and nub become the settings and editor controls respectively (not separate elements bolted alongside them), each control's own body carries its lit state, and the status bar's control vocabulary loses its `✎`-toggle carve-out language accordingly.
- `pipboy-settings`: "Settings entry point in the status bar" requirement changes — the control moves from the status bar nav to the bottom bezel's left knob, and its reachability widens from sheet-only to every screen.

## Impact

- `apps/pip-boy/index.html` — remove `#pb-nav-settings` from the status bar nav; change the left `<span class="pb-knob">` and the `<span class="pb-nub">` to `<button>` elements with the appropriate ids/labels; remove `.pb-bezel-editor`, `.pb-bezel-toggle`, `#pb-editor-led`.
- `apps/pip-boy/src/styles/pipboy.css` — new idle/lit styling for `.pb-knob` (interactive variant) and `.pb-nub`, including the glyph color swap on the lit state; resize `.pb-nub`; retire `.pb-bezel-toggle`/`.pb-editor-led` rules.
- `apps/pip-boy/src/engine/chrome.js` — settings button wiring moves from `showSheetNav`/`hideSheetNav` (sheet-gated) to unconditional bezel setup (mounted once, not per sheet-mount); `setEditorChrome` toggles one element instead of two; new logic to light/unlight the config knob keyed to the popup's open/closed lifecycle.
- `apps/pip-boy/src/engine/settings-popup.js` — `openSettingsPopup()` needs to signal closure to its caller (callback, event, or return value) instead of keeping `close()` fully private.

## Testing

- **E2E (Playwright)**: extend `apps/pip-boy/tests/terminal-chrome.spec.ts` — the bezel still renders two knobs, a grille, and a nub on every screen; the left knob and the nub carry glyphs fully inside their bounds; the lit-state glyph color swap is asserted via computed style; the right knob remains inert and unchanged.
- **E2E (Playwright)**: extend `apps/pip-boy/tests/settings.spec.ts` — the settings control opens the popup from the login/select screens as well as the sheet (new: it no longer requires a mounted sheet); the config knob lights while the popup is open and goes dark on close (both close-button and click-outside paths).
- **E2E (Playwright)**: extend sheet-focused specs (`terminal-chrome.spec.ts` and/or a dedicated editor-mode spec) — a read-only viewer sees the `✎` glyph on the nub but activating it does nothing; an editor sees the nub light on toggle-on and go dark on toggle-off, matching today's LED assertions minus the separate LED element.
