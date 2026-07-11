
# Handoff: M.A.G.N.U.S. Pip-Boy Field Terminal — Character Sheet

## Overview
A Fallout-inspired tabletop-RPG companion app: a CRT "Pip-Boy" field terminal for managing
player characters. Flow: **Login → Dossier list (character select) → 6-step character
creation wizard → live character sheet** (S.P.E.C.I.A.L. approaches, Tag Skills/Talents,
Health/Logoramento tracker, Gear/Inventory, Dice roller). All UI copy is in **Italian** —
keep it that way; it is written in an in-universe terminal voice, not literal translation.

This is a solo-use digital character sheet, not a multiplayer app — "login" is a local
profile switcher (data lives in the browser), not a real auth system.

## About the design files
The files in this bundle (`reference/Field Deck.dc.html`, `reference/conditions.json`,
`mockups/*.png`) are **design references**. `Field Deck.dc.html` is our internal prototyping
format — a single-file component description, not production React. **Do not copy its markup
or "compile" it directly.** Your task is to **recreate this design faithfully in React**,
using your project's existing component patterns, state management, and build tooling (or,
if this is a fresh project, plain React + CSS-in-JS/modules — whichever fits your stack).
Treat the `.dc.html` file as ground truth for exact copy, exact values, and the state machine
described in §5 below — read it like a spec, not like a template to paste.

## Fidelity
**High-fidelity.** Every color, font size, spacing value, and border you see in the mockups
is final and taken verbatim from the working prototype (not eyeballed off a screenshot). Where
this doc gives a hex code, px value, or literal copy string, use it exactly — do not
approximate. The previous implementation attempt drifted from these specifics; this doc exists
to close that gap.

## Screens / views
See the numbered PNGs in `mockups/` alongside each section. All screens are Italian in-universe
copy — reproduce the exact strings shown.

1. **Login** (`07-login.png`) — `screen: 'login'`
2. **Dossier / character select** (`08-dossier-with-character.png`) — `screen: 'select'`
3. **Character creation wizard**, 6 steps (`09`–`14-*.png`) — `screen: 'create'`
4. **Character sheet**, 5 tabs (`01`–`06-*.png`, `15`, `16`) — `screen: 'sheet'`

---

## 1. Design tokens

### Colors (literal values — do not invent new ones)
- **Phosphor green** `#33ff66` — all primary text, borders, icons, active states, glows.
- **Bright green** `#aaffc0` — link hover, and a rolled "6" die face.
- **Amber warning** `#ffb02e` — critical/negative states, damage, alerts, logoramento net-positive.
  Amber text glow: `text-shadow: 0 0 4px rgba(255,176,46,0.4)` (up to `0 0 6px rgba(255,176,46,0.5)`
  for larger/header text).
- **Screen background** `#06110a`.
- **Case gradient** `linear-gradient(160deg, #22261c, #0e100b)`.
- **Page background** `radial-gradient(circle at 50% 30%, #14170f 0%, #050604 70%)`.
- Green is reused at many opacities via `rgba(51,255,102, α)`:
  - Borders: `0.25–0.5` (default `0.4`)
  - Hairline dividers: `0.15–0.28`
  - Dim/secondary label opacity: `0.45–0.7` (applied as element opacity, not color alpha)
  - Tinted fills / active backgrounds: `0.08–0.14` (active tab/segment bg is `rgba(51,255,102,0.14)`)
  - Hover/active glow: `box-shadow: 0 0 6px #33ff66` or `0 0 8px #33ff66` (dice/CTA)

### Typography
Google Fonts: `VT323` and `Share Tech Mono` (loaded together:
`https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap`).
- **`VT323`** (a pixel/terminal display face) — all big numerals and short display values:
  S.P.E.C.I.A.L. letters (26–30px) and values, PA count, dice pool ("4d6", 40px), net-wear
  number (40px), dice result label (26px), stepper `−`/`+` glyphs (22px), screen titles like
  "M.A.G.N.U.S." (46px) and "CREAZIONE" (26–30px).
- **`Share Tech Mono`** — everything else: body copy, labels, buttons, inputs, tab labels.
  Sizes range 9–15px; most body text is 10–13px.
- Labels and section headers are **uppercase** with `letter-spacing: 1–3px`. Small meta labels
  sit at `font-size: 9–12px` with reduced opacity (0.45–0.7).
- Section headers are prefixed with `▸ ` (U+25B8), e.g. `▸ APPROCCI · TOCCA PER TIRARE`.

### Glow & CRT effects (all four apply to the "sheet" screen and persist across tabs)
- Phosphor text glow on all screen text: `text-shadow: 0 0 4px rgba(51,255,102,0.55)` — children
  inherit it, so buttons/inputs glow too.
- Screen inner glow: `box-shadow: inset 0 0 60px rgba(51,255,102,0.14), inset 0 0 6px rgba(51,255,102,0.4)`.
- CRT flicker: opacity keyframes `0%,100% → 0.97; 50% → 1; 52% → 0.94`, 4s infinite, applied to
  the screen container.
- Scanline sweep: a semi-transparent horizontal band
  (`linear-gradient(180deg, rgba(51,255,102,0.08), transparent)`, 40% of screen height)
  translateY animates from `-100%` to `250%` over 7s, linear, infinite.
- A repeating 1px/3px horizontal-line overlay (`rgba(0,0,0,0.18)` stripes) sits above content for
  a scanline texture, plus a radial vignette (`rgba(0,0,0,0.55)` at the edges) — both
  `pointer-events: none`, layered above content, below the flicker.
- **Critical state** adds an amber ring: `border: 1px solid rgba(255,176,46,0.5)` +
  `box-shadow: inset 0 0 45px rgba(255,176,46,0.3)` over the whole screen, plus a status dot/label
  color swap (green → amber) and an amber alert banner (see §5.3).

### Shape & chrome
- **Case** (outer bezel): border-radius `26px`, `1px solid #333829`, padding ~`16px 14px 12px`,
  shadow `inset 0 2px 3px rgba(120,140,90,0.25), inset 0 -6px 14px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.8)`.
- **Screen**: border-radius `14px`, `2px solid #05170c`, `overflow: hidden`.
- **Bottom bezel**: two small circular "knobs" (22px, radial-gradient `#3a4030`→`#14170f`,
  border `#444a37`), a ridged speaker grille (repeating-linear-gradient stripes, 6px tall,
  border-radius 3px), and a small pill/slider nub (34×12px, rounded).
- **Buttons/inputs**: flat & wireframe. Transparent background, `1px solid rgba(51,255,102,0.4)`
  border, **no border-radius anywhere in this design**, glowing text. Dashed borders
  (`1px dashed rgba(51,255,102,0.45–0.5)`) mark "add" / optional actions
  (e.g. `+ ABILITÀ`, `+ core`/`+ extra` tag buttons).
- Custom scrollbar: 6px wide, thumb `rgba(51,255,102,0.3)`, transparent track.
- No emoji. Iconography is glyphs only: `◄ ✎ ✕ ⚠ ◉ ▸ − +`.

**Anti-patterns — do not introduce:** rounded pill buttons, drop-shadowed "cards", any gradient
besides the two named above, any non-monospace font, colored icon sets, emoji.

---

## 2. Layout skeleton (applies to every screen)

```
page (radial dark bg, centered, 100dvh, 12px padding)
 └ CASE (gradient bezel, rounded 26px)
    ├ status bar: green dot + label  ·  [◄ DOSSIER][ESCI] nav (sheet only)  ·  OS label
    └ SCREEN (#06110a, CRT glow + flicker, overflow hidden)
       ├ per-screen content (login / select / create / sheet — see below)
       └ CRT overlays: scanline texture, vignette, scanline sweep, (critical ring)
    └ bottom bezel (2 knobs · grille · slider pill)
```

The whole case is a **fixed-aspect portrait terminal**: preview canvas 460×960 (phone-shaped).
On wide/landscape viewports the design caps content width (`max-width: 480–1600px` per screen,
computed from an `orientation` state) and centers it — it is not a responsive reflow, more a
"terminal in a bigger frame." When you port to React, treat this as a **mobile-first fixed-width
component**; add your own breakpoint strategy only if the target app needs true responsive
layout beyond what's described here.

### Sheet screen structure (`01`–`06`, `15`, `16`)
```
HEADER   name + species chip + "PA · <source approach>"  |  PUNTI AZIONE pips + [−][+]
TABS     S.P.E · ABIL · SALUTE · ZAINO · DADI  +  [✎] editor toggle (52px, far right)
banner   (conditional: amber "STATO CRITICO" strip, or green "EDITOR" strip)
CONTENT  (scrolling, 14px padding) — one panel per tab, see §4
FOOTER   current tab name (left) · "TAPPI n" (center) · HH:MM clock (right)
```
- Tabs: 5 equal-width flex buttons + 1 fixed 52px editor-toggle button, each divided by a
  `1px solid rgba(51,255,102,0.15)` right border. Active tab: bg `rgba(51,255,102,0.14)`,
  opacity `1`, plus a `2px` glowing green underline (`box-shadow: 0 0 8px #33ff66`) pinned to its
  bottom edge. Inactive tabs: opacity `0.5`.
- Header PA control: label "PUNTI AZIONE" (11px, 2px letter-spacing, opacity 0.65) above a row of
  15×15px pip squares (bordered, filled+glowing 9×9px inner square when "on") sized to `paMax`,
  then a `[−][+]` stepper row (38px square buttons, VT323 22px glyphs).

---

## 3. Recurring UI patterns (reuse these; don't invent new controls)

- **Stepper**: `[−] value [+]` — two 38–40px-wide square wireframe buttons (VT323 `−`/`+` glyph,
  22px) flanking a VT323 value (24–26px). Used for PA, S.P.E.C.I.A.L. edits, resource quantities,
  dice pool modifier.
- **Pips**: small bordered squares (11×18px for S.P.E.C.I.A.L. ratings, 15×15px for PA); filled =
  solid `#33ff66` inner square + `box-shadow: 0 0 5–6px #33ff66`. Empty = just the border.
- **Tag chip**: bordered inline chip — `CORE` tags solid-ish (`bg rgba(51,255,102,0.14)`,
  `1px solid rgba(51,255,102,0.6)`), `EXTRA` tags outlined-only (`1px dashed
  rgba(51,255,102,0.45)`). Each chip has a tiny kind-label (`CORE`/`EXTRA`, 8px, bordered) before
  the tag text. Tap (view mode) toggles strike-through + 0.4 opacity = "DANNEGGIATA" (damaged/
  inactive); tap (editor mode) turns the label into an inline text input with a `✕` remover.
- **Row card**: `1px solid rgba(51,255,102,0.25–0.28)` box, `9px 10px` padding, `8px` bottom
  margin. Holds one skill / talent / weapon / armor entry; switches between a compact view
  layout and an edit layout with inputs + `✕`.
- **Editor mode** (`✎` toggle in the tab bar): every editable list gains a dashed
  `+ AGGIUNGI ABILITÀ` / `+ TALENTO` / `+ ARMA` / etc. button, inline `<input>`s replace static
  text, and a `✕` remove button appears per row. A green `◉ EDITOR — modifica S.P.E.C.I.A.L.,
  abilità e talenti` strip appears under the tab bar while active. Gate every list with a
  view/edit pair, never a single mutable render.
- **Section header**: `▸ LABEL IN MAIUSCOLO` — 12px, 2px letter-spacing, opacity 0.6.

---

## 4. Screen-by-screen detail

### 4.1 Login (`07-login.png`)
- Centered form, max-width 480px (landscape) / full width (portrait), `26px 22px` padding.
- Big VT323 wordmark "M.A.G.N.U.S." (46px, line-height 0.85, 2px letter-spacing).
- Subtitle: "ROBCO · TERMINALE DI CAMPO · OS v2.3" (11px, 3px letter-spacing, opacity 0.6).
- 1px green hairline divider (18px vertical margin).
- Two flavor lines: "> AUTENTICAZIONE RICHIESTA" / "> INSERIRE CREDENZIALI RANGER" (12px, opacity 0.7).
- Field "ID UTENTE" — text input, placeholder "es. RANGER-01".
- Field "CODICE DI ACCESSO" — password input, placeholder "••••••", 3px letter-spacing.
- Inline error (amber, ⚠ prefix) appears above the button on failed auth, e.g.
  "⚠ INSERIRE ID UTENTE" / "⚠ CODICE DI ACCESSO ERRATO".
- Primary CTA: "▸ ACCEDI" — full width, VT323 26px, `rgba(51,255,102,0.14)` bg,
  solid `#33ff66` border, strong glow.
- Footnote (9px, opacity 0.45): first login on an ID auto-registers it locally, no separate
  signup.
- Enter key in either field submits (same handler as clicking ACCEDI).

### 4.2 Dossier / character select (`08-dossier-with-character.png`)
- Header: VT323 "DOSSIER RANGER" (30px) + "UTENTE · <id> — SELEZIONA O CREA" (10px, opacity 0.6).
- Character cards in a grid (`1fr` portrait / `1fr 1fr` landscape), each:
  - Name (VT323 26px) + species/PA/tappi meta line, with a bordered amber `✕` delete button
    top-right (stops click-through to opening the card).
  - A 7-column row of tiny S.P.E.C.I.A.L. mini-stats (letter above value, bordered box each).
  - Optional skills line: `▸ Skill A · Skill B · Skill C` (opacity 0.55).
  - Whole card is clickable to open that character.
- Empty state (no dossiers yet): dashed border box, centered copy "NESSUN DOSSIER
  REGISTRATO / Crea il tuo primo personaggio."
- Bottom: dashed "+ NUOVO PERSONAGGIO" button, full width, VT323 22px.

### 4.3 Character creation wizard (`09`–`14-*.png`)
Header shows "CREAZIONE", the step counter (`N/6 · STEP LABEL`), and a 6-segment progress bar
(each segment a 3px-tall bar, solid green if `i <= currentStep` else `rgba(51,255,102,0.2)`).
Footer nav: `◄ INDIETRO` (always enabled, goes back a step or exits to select on step 0) and
either `AVANTI ▸` (steps 0–4, disabled/dimmed — opacity 0.4 — until the step's validation
passes) or `✓ CREA PERSONAGGIO` (step 5, flex:2, brighter fill).

1. **IDENTITÀ** (`09`) — Name text input (VT323 24px). Species picker: 2×2 grid of 4 buttons
   (Umano/Ghoul/Supermutante/Robot), selected = active-green bg. Below: a bordered info box
   showing that species' "PERMESSO —" (green) and "SVANTAGGIO —" (amber, glowing) copy. **Next**
   requires a non-empty name.
2. **S.P.E.C.I.A.L.** (`09b` empty / `10` filled) — "18 punti · min 1 · max 4 per attributo" hint.
   A "N rimasti" counter (VT323 22px) top-right — amber while > 0, green glow at exactly 0. Each
   of the 7 approaches gets a stepper row (min 1, max 4, and increments are blocked once all 18
   points are spent). **Next** requires exactly 0 remaining.
3. **PUNTI AZIONE MASSIMI** (`11`) — explains this is a permanent choice tied to Agilità or
   Resistenza. Two side-by-side selectable panels showing each attribute's current value; the
   chosen one previews as "PA MASSIMI" in a bordered box below (VT323 44px).
4. **TAG SKILLS** (`12`) — hint line: "Competente 1 · Esperto 2 · Maestro 3 · budget N (Umano +1)
   · «—» azzera". A running cost readout top-right: "MAESTRIA {cost}/{budget}". 3 skill row-cards,
   each a `<select>` of the fixed skill list + a 4-way segmented control (`—`/`COMP`/`ESP`/`MAE`).
   Budget is 4 for Umano, 3 for other species. **Next** is blocked (amber warning shown) if two
   rows pick the same skill ("ABILITÀ DUPLICATE") or total cost exceeds budget ("MAESTRIA OLTRE
   IL BUDGET (N)").
5. **EQUIPAGGIAMENTO** (`13`) — vertical list of selectable weapon-kit rows (name + tag summary),
   then armor-kit rows, same pattern. Below: a bordered "ROTTAMI INIZIALI · 1d6" row with a live
   value and a "TIRA" button that rolls 1–6. Then a free-text "OGGETTO SIGNIFICATIVO" input
   (the character's keepsake item). Footnote: "Dotazione fissa: 2 Stimpack inclusi."
6. **RIEPILOGO** (`14`) — read-only summary: name, "{species} · PA {max} ({source name}) · TAPPI
   {luck}", the 7-stat mini-row (reused from the dossier card), trained skills list, and an
   equipment bullet list (weapon, armor, rottami + stimpack line, keepsake if set).

On submit, a new character is generated with derived talents ("SPECIE · {SPECIES}" = the
species' permanent-bonus copy, and "SVANTAGGIO" = its drawback copy), `wear: []`,
`critico: false`, and the player is dropped straight onto the live sheet.

### 4.4 Character sheet tabs

**S.P.E.C.I.A.L. — "S.P.E"** (`01`)
- View: header "▸ APPROCCI · TOCCA PER TIRARE" + hint "Il valore = numero di d6 nel pool"
  (opacity 0.45). Each of 7 approaches is a full-width row button: big VT323 letter (30px) ·
  name (14px) + description (10px, opacity 0.5) · a 5-slot pip row (11×18px). Tapping a row
  jumps to the DADI tab with that approach pre-selected. Footer note box (bordered): dice-result
  legend — "6 = Successo Pieno · 4/5 = Successo con Costo · 1/2/3 = Fallimento. Ogni 6 oltre il
  primo restituisce 1 PA."
- Edit: header "▸ MODIFICA S.P.E.C.I.A.L.", 7 stepper rows (letter · name · stepper, 0–8 range),
  then a "FONTE PA" `<select>` (which approach feeds max PA) and a "MAX PA" stepper (0–8).

**Abilità — "ABIL"** (`02`)
- "▸ TAG SKILLS · MAESTRIA" section: row-cards, each showing skill name + VT323 maestria
  abbreviation (view) or name+`<select>`+`✕` (edit). Maestria affects Risk per §6.
- "▸ TALENTI" section: row-cards, name + description (view) or name input + `✕` and a dashed
  description input (edit).
- View-only "▸ SPESA PA" reference block: 3 dashed-divider lines — RITIRA FALLITI (1 PA,
  requires relevant Tag Skill), RUBA LA SCENA (1 PA, act out of turn/again), V.A.T.S. (1 PA,
  exploit an advantage / targeted effect).

**Salute (Logoramento) — "SALUTE"** (`03`, critical state `16`)
- Header: "▸ TRACCIATO DEL LOGORAMENTO" (left) vs. "VALORE NETTO" + big VT323 net number
  (right, green normally / amber+glow when > 0) + "neg − pos" caption.
- Active condition list: each a full-width button (tap to remove — represents resting/using a
  stimpack/RadAway), colored amber (negative) or green (positive), showing a `−`/`+` prefix
  glyph, the name, a "BASE" / "MODERATA ×2" weight tag, and a `✕`. Empty state: dashed box
  "nessuna condizione attiva". Negatives are sorted before positives.
- Hint line explaining sign/weight rules, with inline colored spans for "negative" (amber) and
  "positive" (green).
- "▸ CONDIZIONI RAPIDE": wrapping row of preset buttons (from `conditions.json`, fallback to a
  4-item hardcoded list), each showing sign glyph + name + optional "×2".
- "▸ CONDIZIONE PERSONALIZZATA": name text input, a NEGATIVA/POSITIVA sign toggle row, a
  BASE ×1/MODERATA ×2 weight toggle row, and a full-width "+ AGGIUNGI CONDIZIONE" submit
  (VT323 18px).
- **Critical state** (`16`, net ≥ 4): status bar flips to amber "STATO CRITICO" +
  right label "⚠ CRITICO"; an amber banner reading "⚠ STATO CRITICO — NON PUOI AGIRE" appears
  under the tabs on every tab, not just Salute; the whole screen gets the amber inset ring
  described in §1.

**Zaino (Gear) — "ZAINO"** (`04`)
- 3 resource boxes in a row (TAPPI / ROTTAMI / BOBBLEHEAD), each a bordered box with a
  label, a `[−] value [+]` stepper (value is also a direct-editable numeric input).
- "▸ ARMI" and "▸ ARMATURE": row-cards per item — name input/text, a "DANNEGGIATA" amber tag if
  any of its tags is marked damaged, wrapping tag chips (see §3), and in editor mode `+ core` /
  `+ extra` buttons to add tags.
- "▸ CONSUMABILI": compact dashed-divider rows — name, `×qty` (VT323 18px), `[−][+]` stepper,
  `✕` (edit mode only).
- Footnote: tapping a tag marks it DANNEGGIATO (struck-through, inactive until repaired); add/
  rename items and tags only in editor mode.

**Dadi (Dice roller) — "DADI"** (`05`, rolled state `15`)
- "▸ POOL DI DADI" header + current approach name (right-aligned).
- 7-segment approach picker (S/P/E/C/I/A/L single-letter buttons), selecting one sets the pool
  source stat.
- VANTAGGIO / SVANTAGGIO two-button toggle row (mutually exclusive; advantage adds +1 die,
  disadvantage removes the highest rolled die).
- "CONDIZIONI / BONUS — dadi ± al pool" stepper (−6..+6) for situational modifiers.
- Fortuna-only note box: "FORTUNA · il Rischio sale di un grado · nessun PA dai 6" (shown only
  when the Fortuna approach is selected).
- Centered "POOL" readout — VT323 40px "{n}d6".
- Dice face grid: 42×42px bordered squares, VT323 26px pip value. A rolled 6 glows bright
  (`#aaffc0` text, `rgba(51,255,102,0.15)` bg, strong glow); 4–5 are plain green; 1–3 are dim
  green. A die dropped by Svantaggio is 0.28 opacity + strikethrough. Tap a die (when not
  rolling) to select it for reroll — selected = thicker solid border + tinted bg.
- Result box (bordered): VT323 26px result label ("SUCCESSO PIENO"/"SUCCESSO CON COSTO"/
  "FALLIMENTO", or "— TIRA I DADI —" pre-roll) + a sub-line with individual face values and any
  PA gained.
- "Tocca i dadi da ritirare · N selezionati" hint, then a full-width VT323 26px "TIRA" button
  (rolls with a ~540ms tumble animation — re-randomizes faces every 60ms for 9 ticks before
  settling).
- "RILANCIA CON" — `<select>` of the character's Tag Skills — plus a "RITIRA SELEZIONATI −1 PA"
  button (disabled unless: not rolling, PA > 0, a skill is chosen, and ≥1 die is selected).
  Rerolling costs 1 PA regardless of outcome and never grants PA back.
  Footnote: "Il ritiro richiede la Tag Skill pertinente."
- "▸ REGISTRO" — scrolling history list (last 8 rolls), each row: dice expression (e.g. "P 4d6+1")
  vs. outcome ("PIENO"/"COSTO"/"FALLIMENTO").

---

## 5. Interactions & state machine

### 5.1 Screens
`login → select ⇄ create → sheet`. `sheet` has an in-place `◄ DOSSIER` (back to select) and
`ESCI` (logout) in the status bar — those only appear on the sheet screen.

### 5.2 Persistence model
This is a **local-only, no-backend app**. Recreate the same shape so saved data round-trips:
- One `localStorage` key holds an accounts DB: `{ [userId]: { pass, chars: Character[], lastId } }`.
- A second key holds the current session's user id (empty = logged out).
- "Login" with a new id auto-registers it (no separate signup flow); an existing id checks the
  stored password verbatim (plaintext local-only — this is a hobby app, not a security surface).
- On boot: if a session exists, load that user's `lastId` character straight to the sheet;
  otherwise go to `select` (or `login` if no session at all).
- The active character autosaves on every state change while the sheet is open.
- Deleting a dossier removes it from the accounts DB and clears `lastId` if it was active.

### 5.3 Derived / computed values (compute these, don't store them)
- **Pool size** = the selected approach's S.P.E.C.I.A.L. value + (1 if Vantaggio) + situational
  modifier, minimum 1.
- **Roll outcome**: any die showing 6 → "Successo Pieno"; else any 4 or 5 → "Successo con Costo";
  else → "Fallimento". Svantaggio removes the single highest-value die before evaluating.
  Fortuna approach never grants PA from 6s; every other approach refunds `max(0, sixes_rolled − 1)`
  PA on a roll (not on a reroll).
- **Rerolling** selected (non-dropped) dice costs 1 PA flat and requires choosing one of the
  character's Tag Skills; it never grants PA.
- **Maestria** tiers change the *Risk* a GM applies narratively: COMPETENTE raises Risk one
  grade, ESPERTO leaves it unchanged, MAESTRO lowers it one grade. (This is fictional-consequence
  text shown to the player, not a mechanical dice change in the app itself.)
- **Logoramento net value** = sum of negative-condition weights − sum of positive-condition
  weights (a "MODERATA" condition weighs 2, "BASE" weighs 1). Net ≥ 4 → **critico** (locks in
  the amber "STATO CRITICO — NON PUOI AGIRE" banner across the whole sheet).
- **Character creation validation**: step "IDENTITÀ" needs a non-blank name; "S.P.E.C.I.A.L."
  needs exactly 0 of 18 points remaining (each attribute clamped 1–4); "TAG SKILLS" needs no
  duplicate skill picks and total maestria cost (Competente=1/Esperto=2/Maestro=3) ≤ budget
  (4 for Umano, 3 otherwise).
- PA max is tied to whichever of Agilità/Resistenza the player chose in step "PUNTI AZIONE
  MASSIMI" — current PA clamps to the new max if max is ever lowered.

### 5.4 Fixed game data (reference `Field Deck.dc.html`'s top-of-class constants directly —
these lists are content, not layout, and must match verbatim)
- 7 S.P.E.C.I.A.L. approaches (letter, name, one-line description).
- 4 species (Umano/Ghoul/Supermutante/Robot), each with a "permesso" (benefit) and "svantaggio"
  (drawback) description used both during creation and as auto-generated talents.
- 10-entry default skill list for the Tag Skill picker.
- 4 starter weapon kits / 3 starter armor kits, each with named tags split into `BASE` (core)
  and `EXTRA` kinds.
- Quick-condition presets are **data, not code** — fetched at runtime from `conditions.json`
  (falls back to a small hardcoded list if the fetch fails). Keep this externalized so game
  masters can reskin conditions without a rebuild.

---

## 6. Assets
No image/icon assets — everything is typography, borders, and CSS gradients/box-shadows. Fonts
are Google-hosted (`VT323`, `Share Tech Mono`), loaded via a standard `<link>` tag. No SVGs, no
raster art, no emoji.

## Files in this bundle
- `reference/Field Deck.dc.html` — the full source of truth: exact copy strings, exact style
  values (colors/sizes/spacing/borders as inline styles), the complete state machine, all
  validation rules, and the fixed game-data lists (species, skills, weapon/armor kits). Read the
  template markup for structure/values and the `class Component` logic block for behavior —
  don't run or embed this file itself.
- `reference/conditions.json` — the quick-condition preset data (name/sign/weight), fetched at
  runtime in the original; port this as a data file or API response in your app too.
- `mockups/*.png` — numbered screenshots of every screen and state, referenced by filename
  throughout this doc.
