# Pip-Boy TTRPG Character Sheet — Project Instructions

This project is **M.A.G.N.U.S.**, a Fallout-inspired tabletop RPG companion built as a single
Design Component (`Field Deck.dc.html`). It renders a CRT "Pip-Boy" field terminal: login →
character dossiers → live character sheet (S.P.E.C.I.A.L., abilities, health, gear, dice roller).
All copy is in **Italian**. Keep it that way.

When adding to or editing this project, follow the visual + code conventions below so new work is
indistinguishable from what's already there.

---

## 1. Design language — CRT Pip-Boy

Everything reads like phosphor text glowing on a dark green terminal inside a chunky plastic case.

### Color tokens (use these literals — do not invent new colors)
- **Phosphor green** `#33ff66` — all primary text, borders, icons, active states.
- **Bright green** `#aaffc0` — link hover only.
- **Amber warning** `#ffb02e` — critical/negative states, damage, alerts. Its glow is
  `text-shadow: 0 0 4px rgba(255,176,46,0.4)` (up to `0 0 6px rgba(255,176,46,0.5)` for headers).
- **Screen bg** `#06110a`; **case gradient** `linear-gradient(160deg,#22261c,#0e100b)`;
  **page bg** `radial-gradient(circle at 50% 30%, #14170f 0%, #050604 70%)`.
- Green is expressed at many opacities via `rgba(51,255,102,α)`:
  borders `0.25–0.5`, hairlines/dividers `0.15–0.28`, dim labels via `opacity: 0.45–0.7`,
  tinted fills `0.08–0.14`.

### Typography (Google Fonts, already linked in `<helmet>`)
- **`'VT323'`** — big display numerals & values (S.P.E.C.I.A.L. letters, PA count, dice pool,
  net-wear number, headings). Sizes 18–46px.
- **`'Share Tech Mono'`** — everything else: body, labels, buttons, inputs. Default 10–15px.
- Uppercase + `letter-spacing: 1–3px` for labels and section headers. Small labels sit at
  `font-size: 9–12px` with reduced opacity.

### Glow & CRT effects
- Phosphor text glow: `text-shadow: 0 0 4px rgba(51,255,102,0.55)`. Children inherit it
  (`text-shadow: inherit`) so buttons/inputs stay glowing.
- Screen inner glow: `box-shadow: inset 0 0 60px rgba(51,255,102,0.14), inset 0 0 6px rgba(51,255,102,0.4)`.
- Active-pip / hot-element glow: `box-shadow: 0 0 6px #33ff66`.
- `@keyframes crtFlicker` (subtle opacity wobble, `animation: crtFlicker 4s infinite`) on the screen.
- `@keyframes scanMove` exists for a scanline sweep. Keep both keyframes if you touch `<helmet>`.

### Shape & chrome
- The **case**: rounded `26px`, inset+drop shadows, `1px solid #333829` border, soft plastic feel.
- The **screen**: rounded `14px`, `2px solid #05170c`, overflow hidden, holds the CRT glow + flicker.
- Controls are **flat & wireframe**: transparent background, `1px solid rgba(51,255,102,0.4)` border,
  no border-radius, glowing text. Dashed borders (`1px dashed`) mark "add/optional" actions.
- Section headers use a `▸` prefix. Dividers are 1px solid or dashed green hairlines.
- Custom green scrollbar (6px thumb `rgba(51,255,102,0.3)`).

Avoid: rounded pill buttons, drop-shadowed cards, gradients other than the two above, emoji
(the terminal uses `◄ ✎ ✕ ⚠ ◉ ▸ − +` glyphs instead), any non-monospace font.

---

## 2. Layout skeleton

```
page (radial dark bg, centered)
 └ CASE (gradient, rounded 26px)
    ├ status bar (dot + label · nav buttons · OS label)
    └ SCREEN (#06110a, CRT glow + flicker)
       ├ HEADER  (name + species chips · PUNTI AZIONE pips + −/+)
       ├ TABS    (S.P.E.C.I.A.L. · ABILITÀ · SALUTE · ZAINO · DADI + ✎ editor toggle)
       ├ banner  (critico / editor mode strip, conditional)
       ├ CONTENT (scrolling — one panel per tab)
       └ FOOTER  (tab name · TAPPI n · clock)
```

The sheet is sized for a phone-ish portrait terminal (`$preview` 460×960) but the wrapper is
responsive via `wrapMaxW`/`wrapMaxH` and orientation detection. Screens are switched by
`state.screen` (`login` / `select` / `create` / `sheet`) and `state.tab` within the sheet.

### Recurring UI patterns to reuse
- **Stepper**: `[−] value [+]` — two square wireframe buttons (VT323 `−`/`+`, ~38–40px wide)
  around a VT323 value. Used for PA, S.P.E.C.I.A.L. edits, quantities, dice modifier.
- **Pips**: small bordered squares; filled = `background:#33ff66` + glow. Used for PA and each
  approach's rating (value = number of d6).
- **Tag chips**: bordered inline chips with a tiny `BASE`/`EXTRA` kind-label; tap to strike-through
  (mark `DANNEGGIATA`), rename in editor. Used on weapons & armor.
- **Row card**: `1px solid rgba(51,255,102,0.28)` box with view/edit variants inside.
- **Editor mode** (`✎`): each list gains `+ AGGIUNGI`, inline `<input>`s, and `✕` removers.
  View mode shows read-only text. Gate with `<sc-if value="{{ editMode }}">` / `{{ viewMode }}`.

---

## 3. Code architecture (this is a Design Component)

- **One file, one `class Component extends DCLogic`.** Do not split into child DCs unless something
  genuinely repeats ≥4× with real props. `<sc-for>` handles all repetition here.
- **Inline styles only.** No CSS classes, no stylesheets. The only `<helmet><style>` content is the
  body reset, font `@font-face`/links, the two `@keyframes`, and scrollbar rules.
- **Template holes are dotted paths only** (`{{ a.name }}`, `{{ viewMode }}`). Any logic (ternaries,
  color choices, `.map`) is computed in `renderVals()` and exposed by name — e.g. `statusColor`,
  `netColor`, `t.bg`, `tg.border` are all pre-computed style strings.
- **Control flow**: `<sc-if value="{{ flag }}" hint-placeholder-val="{{ … }}">` and
  `<sc-for list="{{ arr }}" as="x" hint-placeholder-count="n">`. Always set the hint.
- Prefer `dc_html_str_replace` / `dc_js_str_replace` for edits so the preview streams/hot-reloads;
  use `dc_write` only for a full rewrite. Never `write_file` on the `.dc.html`.

### State & persistence
- Game data persists to **`localStorage`** under two keys: `pipboy_db` (all accounts + characters)
  and `pipboy_session` (logged-in user id). Read via `_db()`, write via `_saveDB(db)`.
  `componentDidUpdate` auto-saves the active character while on the sheet (`saveActive()`).
- **Never clear or overwrite these keys except through the existing helpers** — they hold the user's
  real characters. New persisted fields go on the character object saved into `pipboy_db`.
- The default sample character (MARTA VOSS) lives in the initial `state`. Preserve its shape when
  adding fields; give new fields sensible defaults so old saves still load.

### Game rules encoded (keep consistent with the manual references in comments)
- **S.P.E.C.I.A.L.** approaches: FORZA/PERCEZIONE/RESISTENZA/CARISMA/INTELLIGENZA/AGILITÀ/FORTUNA.
  A stat's value = number of d6 rolled. Dice: `6` = Successo Pieno, `4/5` = Successo con Costo,
  `1/2/3` = Fallimento; each 6 beyond the first refunds 1 PA. FORTUNA raises Risk a step, no PA from 6s.
- **Maestria** tiers: `COMPETENTE` (Risk +1 grade), `ESPERTO` (unchanged), `MAESTRO` (Risk −1 grade).
- **Punti Azione (PA)**: capped at `paMax`; spent on reroll (needs the relevant Tag Skill),
  "ruba la scena", V.A.T.S.
- **Logoramento / conditions**: negatives add, positives subtract, `MODERATA` weighs ×2; net wear ≥
  `CRIT` (4) triggers `critico` ("STATO CRITICO — NON PUOI AGIRE"). Presets come from
  `conditions.json` (fetched on mount, with a hardcoded fallback array).
- **Species** & starter weapon/armor kits are fixed lists from the manual — extend the constant
  arrays (`SPECIES`, `WEAPON_KITS`, etc.) rather than hardcoding inline.

`conditions.json` is data, not code — edit it to change the quick-condition presets. Each entry:
`{ name, sign: "neg"|"pos", weight, note }`.

---

## 4. When you extend this

1. Match the terminal voice: Italian, uppercase labels, terse status-line phrasing (`&gt; …`),
   RobCo/Fallout flavor. New copy should sound like a field terminal, not a web app.
2. Reuse the patterns in §2 (steppers, pips, chips, row cards, editor gating) before inventing UI.
3. Compute all conditional styles/colors in `renderVals()`; keep the template holes as plain paths.
4. Any new toggle-able behavior or theme option should be a **prop** in the DC's `data-props`
   (read via `this.props.x ?? default`) so it surfaces in the host Tweaks panel — don't hand-roll a
   settings panel.
5. New persisted data → onto the character object, saved through `_saveDB`. Never touch the two
   localStorage keys directly.
