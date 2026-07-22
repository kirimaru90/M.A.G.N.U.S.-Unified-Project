## Context

`apps/pip-boy` is a no-build vanilla JS/CSS/HTML static app. The bezel (`.pb-bezel`, inside `apps/pip-boy/index.html`, styled in `apps/pip-boy/src/styles/pipboy.css`, wired in `apps/pip-boy/src/engine/chrome.js`) is a fixed, always-rendered row of decorative case chrome: two `.pb-knob` circles, a `.pb-grille` strip, and a `.pb-nub` pill. Two of these decorative elements are being turned into the app's only physical-feeling controls: the config knob (settings) and the edit nub (character-editor toggle). Everything here is pure front-end DOM/CSS/event wiring — there is no backend, no data model, and no build step to worry about.

The settings popup itself (`apps/pip-boy/src/engine/settings-popup.js`) is unaffected in content; only how its open/close lifecycle is observed from outside changes.

## Goals / Non-Goals

**Goals:**
- Relocate `⚙` into the left `.pb-knob` and `✎` into `.pb-nub`, reusing those exact elements (no new sibling nodes).
- Each control's own body carries its lit/unlit state — no more separate LED element paired with a button.
- Both glyphs stay fully inside their control's bounds at every state, and stay legible (color-swap) when lit.
- Settings becomes reachable from every screen; the editor toggle stays a sheet-only concept.
- Stay inside the existing token set and the `border-radius` allowlist defined by `pipboy-terminal-chrome` — no new colors, no new rounded elements.

**Non-Goals:**
- Not changing what the settings popup contains, or what editor mode does once toggled on.
- Not solving idle-state discoverability between the (now interactive) left knob and the (still decorative) right knob beyond the glyph itself — flagged as an open question, not addressed here.
- Not introducing a build step, animation library, or any dependency — this stays hand-written CSS/DOM, consistent with the rest of the app.

## Decisions

**Left knob only; right knob untouched.** The right `.pb-knob` stays a `<span>`, `aria-hidden`, identical to today. Splitting one function across two knobs (or making both interactive) would need a second purpose to invent from nothing — there isn't one, so it stays decorative.

**Nub grows in height, bounded by the knob's own height.** The bezel's rendered height today is already governed by the 22px knob (the tallest element in `.pb-bezel`), not by the 12px nub. Growing the nub up toward — but not past — that same ~22px keeps `pipboy-terminal-chrome`'s "bezel presence never changes rendered height" constraint intact for free, while giving `✎` enough room for a legible glyph and a real tap target. Width grows modestly alongside it. Exact pixels are a CSS-polish detail for implementation, bounded by that principle rather than fixed here.

**Span → button, in place.** Both elements upgrade from `<span>` to `<button>` carrying the same class (`pb-knob`, `pb-nub`) plus a new id (`pb-config-knob`, reusing `pb-editor-toggle` for the nub since `chrome.js` already resolves that id). This satisfies "use existing elements, don't create new ones" literally — same class, same slot in the DOM, just the correct interactive tag and an accessible name. The alternative — leaving them `<span>` and bolting on `role="button"` / `tabindex` / manual key handling — reimplements what `<button>` already gives for free and is worse for accessibility, so it's rejected.

**One element owns "lit," not two.** `.pb-bezel-editor`, `.pb-bezel-toggle`, and `#pb-editor-led` are deleted outright. `chrome.js`'s `setEditorChrome(on)` now toggles a single `.on` (or similarly named) class on `#pb-editor-toggle` (the nub itself), which carries both the "active control" look and the "lit" look in one state. Same pattern for the config knob.

**Lit-state glyph color swap reuses an existing token — no new color.** `pipboy-terminal-chrome` forbids colors outside its six-token set. The lit fill is the same solid `--phosphor` fill the old `.pb-editor-led.on` used; the glyph, to stay legible against it, switches to the dark ink already used for the CRT screen background (`--screen-bg`, `#06110a`) rather than introducing a new "ink" token. At rest, the glyph stays dim phosphor-green on the dark knob/nub body, matching every other idle icon in the app.

**Settings lighting is tied to actual popup lifecycle, not a toggle.** Unlike editor mode (a persisted on/off state), opening settings is momentary. `openSettingsPopup()` currently owns a fully private `close()` closure (triggered by the `✕` button or an outside click) with no way for `chrome.js` to know when it fires. The fix is to have `openSettingsPopup()` accept an `onClose` callback (or emit a small custom event on its overlay before removal) and call it from the single `close()` closure — every dismissal path (`✕`, click-outside, and any future path added to that function) reports through the same choke point, so nothing can leave the knob stuck lit.

**Settings wiring moves out of the sheet-mount lifecycle.** Today the `⚙` button is created fresh (and rebound) every time `showSheetNav()` runs, because it lived inside the sheet-only nav. Since the config knob is now part of the always-rendered bezel and reachable from every screen, its click handler is bound once during chrome initialization, not on each sheet mount. `showSheetNav`/`hideSheetNav` no longer touch it at all.

**Read-only viewers keep seeing `✎`, inert.** The nub no longer disappears (`hidden`) for a viewer without write permission — it renders the glyph like any other viewer, but its click/keyboard activation is a no-op and `setEditorChrome` is never invoked for that viewer. This is a deliberate behavior change (called out as **BREAKING** in the proposal): the nub is now permanent bezel furniture, and hiding permanent furniture conditionally would leave a visible gap where the grille meets nothing.

## Risks / Trade-offs

- **[Risk] The interactive left knob and the decorative right knob look identical at idle apart from the glyph** → Mitigation: none applied in this change; flagged as a follow-up UX question if it proves confusing in practice. Not blocking.
- **[Risk] A future close path added to the settings popup (e.g. an Escape-key handler) could bypass the callback and leave the knob lit** → Mitigation: route every dismissal through the single `close()` closure inside `settings-popup.js` (already true today for the two existing paths); the callback fires from that one choke point, so any future path only needs to call `close()`, not re-wire lighting logic itself.
- **[Trade-off] Widening settings reachability to every screen** is a real scope increase (proposal marks it **BREAKING**), decided explicitly rather than defaulted — accepted because the control is now physically part of the case, and a knob that only works on one screen would be a stranger inconsistency than reachability everywhere.
- **[Risk] `apps/pip-boy/tests/terminal-chrome.spec.ts`'s `ROUNDED_ALLOWLIST` and its bezel-geometry assertions reference `.pb-knob`/`.pb-nub`/`.pb-editor-led`/`.pb-bezel-toggle` by class** → Mitigation: covered explicitly in tasks — update the allowlist (drop `.pb-editor-led`, which no longer exists) and any geometry/visibility assertions tied to the removed elements.

## Migration Plan

No backend, no data, no feature flag mechanism in this app — `index.html`, `pipboy.css`, `chrome.js`, and `settings-popup.js` must ship together in one deploy (mismatched old/new ids across files would break the wiring). Rollback is a plain revert of that same set of files; nothing persists across the change that would need a data migration.

## Open Questions

- Should the idle-state left knob carry any visual cue beyond the `⚙` glyph to distinguish it from the purely decorative right knob (e.g. a subtly different border tone)? Left unresolved per the proposal discussion — revisit if real usage shows people missing it.
- Exact final `.pb-nub` width/height and glyph `font-size` — bounded by "no taller than the 22px knob," otherwise a CSS-polish call made during implementation.
- Should the config knob and edit nub get their own `:hover`/`:active` feedback distinct from the "lit" state (so idle users get a pointer affordance before clicking), the way `.pb-bezel-toggle:hover` did? Left to implementation; doesn't affect the spec-level contract.
