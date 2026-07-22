# pipboy-terminal-chrome Specification

## Purpose

The `apps/pip-boy` shared visual system: design tokens (parameterized by the user's chosen phosphor theme), four persistent CRT effect layers, the critical-state ring, the case/bezel chrome, the square-cornered control vocabulary, and the Italian in-universe copy that every screen renders through.

## Requirements

### Requirement: Design tokens

`apps/pip-boy` SHALL express its visual system through a single set of design tokens, declared once in `src/styles/pipboy.css`, and SHALL NOT introduce colors, gradients, or fonts outside this set. The set SHALL be parameterized by the user's chosen phosphor theme (`pipboy-settings`'s `COLORE` row: `green` / `amber` / `white`), so exactly one of three token palettes is active at a time:

| Token | Green (default) | Amber | White | Use |
|---|---|---|---|---|
| Phosphor | `#33ff66` | *(theme rgb)* | *(theme rgb)* | all primary text, borders, icons, active states, glows |
| Phosphor bright | `#aaffc0` | *(theme rgb)* | *(theme rgb)* | link hover, and a rolled `6` die face |
| Screen background | `#06110a` | `#06110a` | `#06110a` | the CRT screen (unchanged across themes) |
| Case gradient | `linear-gradient(160deg, #22261c, #0e100b)` | (unchanged) | (unchanged) | the outer bezel |
| Page background | `radial-gradient(circle at 50% 30%, #14170f 0%, #050604 70%)` | (unchanged) | (unchanged) | the page behind the case |
| Critical red | `#e0685c`-family, distinct from `--neg` | (same, all themes) | (same, all themes) | critical/negative/damage/invalid/error states, in every theme |

The phosphor and phosphor-bright tokens SHALL each be expressed as a single channel-triplet custom property (e.g. `--phosphor-rgb: 51,255,102`), and every rule that previously referenced the literal `rgba(51,255,102,α)` directly SHALL instead reference `rgba(var(--phosphor-rgb), α)`, so that changing the active theme requires updating only the triplet custom properties, not each individual rule.

Green (or the active theme's phosphor color) SHALL be reused at opacity via `rgba(var(--phosphor-rgb),α)`: borders `0.25–0.5` (default `0.4`), hairline dividers `0.15–0.28`, tinted fills and active backgrounds `0.08–0.14` (active tab/segment `0.14`). Dim and secondary labels SHALL use element `opacity` `0.45–0.7`, not a color alpha.

The critical-red token, not amber, SHALL glow with the equivalent of `text-shadow: 0 0 4px rgba(<critical-red>,0.4)`, up to `0 0 6px rgba(<critical-red>,0.5)` for larger or header text — amber carries no such reserved glow role once it is a selectable phosphor color rather than a fixed status color.

Typography SHALL use exactly two Google-hosted faces, `VT323` and `Share Tech Mono`, unaffected by the phosphor theme:
- `VT323` for large numerals and short display values — S.P.E.C.I.A.L. letters and values, PA count, dice pool, net-wear number, dice result label, stepper `−`/`+` glyphs, and screen titles.
- `Share Tech Mono` for everything else — body copy, labels, buttons, inputs, tab labels — at `9–15px`, most body text `10–13px`.

Labels and section headers SHALL be uppercase with `letter-spacing: 1–3px`. Section headers SHALL be prefixed with `▸ ` (U+25B8).

#### Scenario: No color outside the token set
- **WHEN** the stylesheet is inspected under any of the three phosphor themes
- **THEN** every color literal resolves to one of the theme's phosphor tokens, the critical-red token, one of the theme-invariant tokens (screen background, case gradient, page background), or a neutral black-alpha used by the CRT overlays and case shadows

#### Scenario: Only the two specified fonts are loaded
- **WHEN** the app's font requests are inspected
- **THEN** exactly `VT323` and `Share Tech Mono` are requested, and no non-monospace face is used

#### Scenario: Changing theme is a token-only change
- **GIVEN** the user switches the `COLORE` preference
- **WHEN** the phosphor theme changes
- **THEN** only the phosphor-rgb custom properties update; the critical-red token, screen background, case gradient, and page background remain unchanged

### Requirement: CRT effects

The screen SHALL carry four CRT effect layers on every screen (`login`, `select`, `create`, `sheet`), persisting across tab switches:

1. **Phosphor text glow** — `text-shadow: 0 0 4px rgba(51,255,102,0.55)` on all screen text, inherited by children so buttons and inputs glow too.
2. **Screen inner glow** — `box-shadow: inset 0 0 60px rgba(51,255,102,0.14), inset 0 0 6px rgba(51,255,102,0.4)`.
3. **CRT flicker** — an opacity keyframe animation on the screen container: `0%,100% → 0.97`, `50% → 1`, `52% → 0.94`, over `4s`, infinite.
4. **Scanline sweep** — a semi-transparent horizontal band, `linear-gradient(180deg, rgba(51,255,102,0.08), transparent)` at 40% of screen height, whose `translateY` animates from `-100%` to `250%` over `7s`, linear, infinite.

Above the content and below the flicker, two non-interactive overlays SHALL sit: a repeating 1px/3px horizontal-line scanline texture of `rgba(0,0,0,0.18)` stripes, and a radial vignette darkening to `rgba(0,0,0,0.55)` at the edges. Both SHALL be `pointer-events: none`.

The scanline-sweep keyframe SHALL animate a transform, and SHALL be applied to a rendered element — not merely declared. (The current `scanMove` keyframe is declared and never used.)

Scrollbars SHALL be 6px wide with a `rgba(51,255,102,0.3)` thumb and a transparent track.

#### Scenario: All four effect layers are present on the sheet
- **WHEN** the sheet screen is rendered
- **THEN** the screen container carries the phosphor text glow, the inner glow, an active flicker animation, and an animated scanline-sweep element

#### Scenario: Effects persist across tabs
- **WHEN** the user switches from the `S.P.E` tab to the `DADI` tab
- **THEN** all four effect layers remain applied

#### Scenario: Overlays never intercept input
- **WHEN** the scanline texture and vignette overlays are rendered
- **THEN** both compute to `pointer-events: none`, and a control beneath them remains clickable

#### Scenario: The sweep keyframe is actually applied
- **WHEN** the stylesheet and DOM are inspected
- **THEN** the scanline-sweep keyframe is referenced by an `animation` on a rendered element, not left unused

### Requirement: Critical-state ring

When the character is in critical state, the screen SHALL additionally render a critical-red ring — `border: 1px solid rgba(<critical-red>,0.5)` with `box-shadow: inset 0 0 45px rgba(<critical-red>,0.3)` — over the whole screen, and the case status bar's dot and label SHALL swap from the active phosphor color to critical-red. This rendering SHALL be identical across all three phosphor themes: the critical-red token SHALL NOT vary with, or be replaced by, the user's chosen phosphor color.

The ring SHALL be a non-interactive overlay (`pointer-events: none`) matching the screen's `14px` radius, layered above the other CRT overlays, rather than a change to the screen's own border — so entering critical state never shifts the layout beneath it.

This ring is distinct from, and shown together with, the `⚠ STATO CRITICO — NON PUOI AGIRE` banner specified by `pipboy-character-sheet`.

#### Scenario: Critical state applies the critical-red ring
- **GIVEN** a character whose `criticalState` is `true`
- **WHEN** the sheet renders
- **THEN** the screen carries the critical-red border and inset critical-red glow, and the status-bar dot and label render critical-red

#### Scenario: Leaving critical state removes the ring
- **GIVEN** a character in critical state
- **WHEN** the owner removes conditions so that net wear falls below `4`
- **THEN** the critical-red ring and the critical-red status dot are removed and the active phosphor-theme treatment returns

#### Scenario: Critical rendering is the same under every phosphor theme
- **GIVEN** a character in critical state
- **WHEN** the sheet renders under the green, amber, and white phosphor themes in turn
- **THEN** the critical ring and status dot render the same critical-red color in all three cases

### Requirement: Editor-mode ring

While the sheet is in editor mode, the screen SHALL render a ring in the active phosphor theme's color — `border: 1px solid rgba(var(--phosphor-rgb),0.5)` with a matching inset glow — over the whole screen, matching the screen's `14px` radius and layered as a non-interactive overlay (`pointer-events: none`) exactly like the critical-state ring, so entering editor mode never shifts the layout beneath it.

This ring is an additional always-visible signal of editor mode, shown together with the phosphor-colored `◉ EDITOR` strip specified by `pipboy-character-sheet`. When the character is simultaneously in critical state, the critical-red ring SHALL take precedence and the editor-mode ring SHALL NOT be shown, consistent with the critical-red banner taking precedence over the editor strip.

#### Scenario: Editor mode applies the phosphor-colored ring
- **GIVEN** a non-critical character
- **WHEN** the owner turns editor mode on
- **THEN** the screen carries a border and inset glow in the active phosphor theme's color, and it is removed when editor mode is turned off

#### Scenario: Critical ring takes precedence over the editor ring
- **GIVEN** a character in critical state
- **WHEN** editor mode is on
- **THEN** the critical-red ring is shown and the phosphor-colored editor ring is not

### Requirement: Case and bezel chrome

The page SHALL centre a fixed-aspect portrait terminal case:

- **Case** (outer bezel): `border-radius: 26px`, `1px solid #333829`, padding ~`16px 14px 12px`, with `inset 0 2px 3px rgba(120,140,90,0.25), inset 0 -6px 14px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.8)`.
- **Status bar** (inside the case, above the screen): a status dot and label on the left, the sheet-only `[◄ DOSSIER][ESCI]` nav per `pipboy-app-shell`, and an OS label. Neither the `⚙` settings control nor the `✎` editor toggle lives in the status bar — both live in the bottom bezel, below.
- **Screen**: `border-radius: 14px`, `2px solid #05170c`, `overflow: hidden`.
- **Bottom bezel** (below the screen): two circular knobs (radial-gradient `#3a4030`→`#14170f`, border `#444a37`), a ridged speaker grille built from repeating-linear-gradient stripes 6px tall with `border-radius: 3px`, and a pill/slider nub, rounded. The **left knob** is the `⚙` settings control (per `pipboy-settings`) and the **right knob** stays purely decorative and non-interactive, unchanged. The **nub** is the `✎` editor toggle: it grows from the reference `34×12px` sizing enough to hold a fully-contained glyph and a workable tap target, but SHALL NOT exceed the knob's own height, so the bezel's overall rendered height is unaffected. The nub is present on every screen; on screens other than the sheet, or for a sheet viewer without write permission, it renders its glyph but does not respond to activation.

The bottom bezel SHALL be rendered on every screen, and SHALL live **inside** the constraints of `pipboy-responsive-shell`: it must not cause page-level scroll, and `.pb-case`'s rendered bounding box must remain a function of viewport size and orientation only, never of which screen is mounted. Growing the nub to hold the `✎` glyph SHALL NOT change the bezel's rendered height, since the knob (unchanged at its current height) already governs it.

#### Scenario: Bottom bezel is rendered
- **WHEN** any screen is mounted
- **THEN** the case renders two knobs, a ridged speaker grille, and a slider nub beneath the screen

#### Scenario: Config knob and editor nub are the only interactive bezel controls
- **WHEN** any screen is mounted
- **THEN** the left knob and the nub are focusable, activatable controls, the right knob remains a non-interactive decorative element, and the status bar contains neither a `⚙` nor a `✎` control

#### Scenario: Nub growth does not change bezel height
- **GIVEN** the nub is sized to hold its glyph and tap target
- **WHEN** `.pb-bezel`'s rendered height is measured
- **THEN** it is unchanged from a bezel rendered without the nub's grown sizing, because the knob remains the tallest element

#### Scenario: Bezel does not break the responsive shell contract
- **GIVEN** a fixed viewport size and orientation
- **WHEN** the user proceeds from `login` → dossier → `create` → `sheet`
- **THEN** `.pb-case`'s rendered width and height are identical on every screen, and no page-level scrollbar appears

### Requirement: Control vocabulary

Buttons and inputs SHALL be flat and wireframe: transparent background, `1px solid rgba(51,255,102,0.4)` border, glowing text, and **no border-radius**. Dashed borders (`1px dashed rgba(51,255,102,0.45–0.5)`) SHALL mark "add" and optional actions, such as `+ ABILITÀ`, `+ core`, and `+ extra`.

Native `<select>` controls and their option lists SHALL render on the phosphor theme — the option popup background SHALL use the dark screen background token and its text the active phosphor theme color, not the browser-default light popup — to the extent the platform permits styling native option lists.

**No element in the design SHALL carry a non-zero `border-radius`** other than the case (`26px`), the screen (`14px`), the bezel knobs (including the interactive config knob), the grille (`3px`), the slider nub (including the interactive editor toggle), the status-bar LED (`50%` — a round indicator, per the reference), the critical-state ring (`14px`, matching the screen it overlays), and the editor-mode ring (`14px`, matching the screen it overlays). In particular there SHALL be no rounded pill buttons and no separate round "LED" element — a control's lit state is carried by the control's own body (see `Bezel control lit state`).

Iconography SHALL be glyphs only — `◄ ✎ ⚙ ✕ ⚠ ◉ ▸ − +` — and the app SHALL contain **no emoji** and no colored icon set.

The following are explicit anti-patterns and SHALL NOT be introduced: rounded pill buttons, drop-shadowed "cards", any gradient besides the case gradient and the page background, and any non-monospace font.

#### Scenario: Controls are square-cornered
- **WHEN** any button or input other than the case chrome is rendered
- **THEN** its computed `border-radius` is `0`

#### Scenario: Select option lists render on-theme
- **WHEN** a `<select>`'s option list is styled
- **THEN** its option background uses the dark screen token and its text uses the active phosphor theme color, not the browser-default white popup

#### Scenario: Only the named elements are rounded
- **WHEN** every element's computed `border-radius` is inspected
- **THEN** the only non-zero values belong to the case, the screen, the bezel knobs, the grille, the slider nub, the status-bar LED, the critical-state ring, and the editor-mode ring — no standalone LED element exists

#### Scenario: Add actions use dashed borders
- **WHEN** an `+ AGGIUNGI …` action renders in editor mode
- **THEN** its border style is dashed

#### Scenario: No emoji anywhere
- **WHEN** the app's rendered text is inspected across every screen
- **THEN** no emoji character is present, and iconography is drawn only from the glyph set

### Requirement: Bezel control lit state

The bezel's two interactive controls — the config knob and the editor nub — SHALL each carry their own "lit" state directly on their own element; neither is paired with a separate indicator element.

Idle (unlit), a control SHALL render its glyph (`⚙` or `✎`) dim in the active phosphor theme color on the control's normal dark body, fully contained within the control's bounds. Lit, the control's body SHALL fill solid with the active phosphor theme color (matching the intensity the former standalone LED used) with a matching glow, and its glyph SHALL switch to the dark screen-background ink color (`--screen-bg`) so it remains legible against its own bright fill — never phosphor-on-phosphor.

The lit color SHALL always be the active phosphor theme color, never critical-red: critical-red remains reserved for the critical state (the critical ring and the critical status dot/label), so a lit bezel control is never mistakable for a critical signal, and both may be shown at once without conflict, regardless of which phosphor theme is active.

What triggers each control's lit state is defined by the capability that owns that control: the editor nub lights per the editor-mode on/off state (mirroring the phosphor-colored editor-mode ring, above); the config knob's trigger is defined by `pipboy-settings`.

#### Scenario: Idle control shows a dim glyph fully inside its bounds
- **WHEN** a bezel control (config knob or editor nub) is unlit
- **THEN** its glyph renders dim in the active phosphor theme color, entirely within the control's own rendered bounds, with no separate LED element present

#### Scenario: Lit control swaps its glyph color to stay legible
- **WHEN** a bezel control becomes lit
- **THEN** its body fills solid with the active phosphor theme color and a glow, and its glyph switches to the dark screen-background color rather than remaining phosphor-colored

#### Scenario: Lit control returns to its idle look
- **WHEN** a lit bezel control's on-state ends
- **THEN** its body returns to the dark idle fill and its glyph returns to dim in the active phosphor theme color

#### Scenario: A lit control is never critical-red
- **GIVEN** a character in critical state with the editor nub lit
- **WHEN** the sheet renders
- **THEN** the editor nub is lit in the active phosphor theme color while the critical ring and status dot are critical-red — the two indicators do not share a color

#### Scenario: A lit control stays on-theme even under a non-default phosphor theme
- **GIVEN** the phosphor theme is set to amber, and a character in critical state with the editor nub lit
- **WHEN** the sheet renders
- **THEN** the editor nub renders the amber phosphor color, not the critical-red token, remaining visually distinct from the critical-state indicators

### Requirement: Italian in-universe copy

All UI copy SHALL be Italian, written in an in-universe terminal voice rather than a literal translation, and SHALL reproduce the reference's literal strings exactly where the design specifies them — including `▸ APPROCCI · TOCCA PER TIRARE`, `⚠ STATO CRITICO — NON PUOI AGIRE`, `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti`, `NESSUN DOSSIER REGISTRATO`, and the dice legend.

The login screen SHALL follow the reference layout — a `VT323` `M.A.G.N.U.S.` wordmark, the subtitle `ROBCO · TERMINALE DI CAMPO · OS v2.3`, a hairline divider, the flavor lines `> AUTENTICAZIONE RICHIESTA` and `> INSERIRE CREDENZIALI RANGER`, labelled `ID UTENTE` and `CODICE DI ACCESSO` fields, a critical-red `⚠`-prefixed inline error, and a `▸ ACCEDI` primary call to action. Pressing Enter in either field SHALL submit. The login error SHALL render in the critical-red token in every phosphor theme, not the theme's phosphor color, consistent with every other error/warning/critical indicator in the app.

The reference's footnote stating that a first login auto-registers an id locally SHALL **not** be reproduced: `pipboy-app-shell` specifies real-user JWT login, and no local auto-registration exists.

#### Scenario: Login renders the reference copy
- **WHEN** the login screen renders
- **THEN** it shows the `M.A.G.N.U.S.` wordmark, the `ROBCO · TERMINALE DI CAMPO · OS v2.3` subtitle, both flavor lines, the `ID UTENTE` and `CODICE DI ACCESSO` labels, and a `▸ ACCEDI` control

#### Scenario: Login errors render critical-red with a warning glyph
- **WHEN** authentication fails
- **THEN** a critical-red, `⚠`-prefixed inline error appears above the `▸ ACCEDI` control, regardless of the active phosphor theme

#### Scenario: Enter submits from either field
- **WHEN** the user presses Enter in the `ID UTENTE` or `CODICE DI ACCESSO` field
- **THEN** the same handler runs as activating `▸ ACCEDI`

#### Scenario: No local auto-registration footnote
- **WHEN** the login screen renders
- **THEN** no copy claims that a first login registers a new id
