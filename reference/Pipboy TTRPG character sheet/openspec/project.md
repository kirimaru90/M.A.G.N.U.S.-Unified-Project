# Project Conventions — M.A.G.N.U.S. Field Terminal

## Purpose
A Fallout-inspired tabletop-RPG companion: a CRT "Pip-Boy" field terminal that manages player
characters (login → dossiers → live character sheet with S.P.E.C.I.A.L., abilities, health, gear,
and a dice roller). All UI copy is in **Italian**.

## Tech stack
- **Single Design Component**: `Field Deck.dc.html` — one `class Component extends DCLogic`
  containing the whole app (template + logic). Rendered by `support.js` (runtime; never edit).
- **No build step, no framework, no bundler, no npm dependencies.** Plain static files served over
  HTTP.
- **Data**: `conditions.json` (runtime-fetched presets). Character/account data persists in
  `localStorage` under `pipboy_db` and `pipboy_session`.

## Design authority
`CLAUDE.md` at the repo root is the definitive spec for the visual system and code architecture.
Every proposal and implementation MUST conform to it. Key rules:
- Inline styles only; the sole `<style>` block holds fonts, `@keyframes`, and body resets.
- Template holes are dotted paths only (`{{ a.name }}`); all logic/colors/style-strings are computed
  in `renderVals()` and exposed by name.
- Phosphor-green palette (`#33ff66`), amber for alerts (`#ffb02e`), VT323 + Share Tech Mono fonts,
  CRT glow/flicker. No emoji, no rounded pills, no gradients beyond the two defined.

## Conventions
- Match the terminal voice: Italian, uppercase labels, terse `> …` status phrasing.
- Reuse existing UI patterns (steppers, pips, tag chips, row cards, `▸` section headers, editor-mode
  gating) before inventing new UI.
- New persisted fields go on the character object, saved through `_saveDB()`. Never touch the two
  localStorage keys directly, and never clear them.
- Fixed game-data lists (species, weapon/armor kits, skills) live in constant arrays on the class —
  extend those rather than hardcoding inline.

## When to use OpenSpec
Use it for behavior changes (new tabs, game rules, persistence). Skip it for one-line tweaks
(a color, a copy edit, an animation-timing fix).
