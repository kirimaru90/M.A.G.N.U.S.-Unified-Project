# pipboy-terminal-chrome Specification

## Purpose

The `apps/pip-boy` shared visual system: design tokens, four persistent CRT effect layers, the critical-state amber ring, the case/bezel chrome, the square-cornered control vocabulary, and the Italian in-universe copy that every screen renders through.

## Requirements

### Requirement: Design tokens

`apps/pip-boy` SHALL express its visual system through a single set of design tokens, declared once in `src/styles/pipboy.css`, and SHALL NOT introduce colors, gradients, or fonts outside this set:

| Token | Value | Use |
|---|---|---|
| Phosphor green | `#33ff66` | all primary text, borders, icons, active states, glows |
| Bright green | `#aaffc0` | link hover, and a rolled `6` die face |
| Amber warning | `#ffb02e` | critical/negative states, damage, alerts, net-positive logoramento |
| Screen background | `#06110a` | the CRT screen |
| Case gradient | `linear-gradient(160deg, #22261c, #0e100b)` | the outer bezel |
| Page background | `radial-gradient(circle at 50% 30%, #14170f 0%, #050604 70%)` | the page behind the case |

Green SHALL be reused at opacity via `rgba(51,255,102,α)`: borders `0.25–0.5` (default `0.4`), hairline dividers `0.15–0.28`, tinted fills and active backgrounds `0.08–0.14` (active tab/segment `0.14`). Dim and secondary labels SHALL use element `opacity` `0.45–0.7`, not a color alpha.

Amber text SHALL glow with `text-shadow: 0 0 4px rgba(255,176,46,0.4)`, up to `0 0 6px rgba(255,176,46,0.5)` for larger or header text.

Typography SHALL use exactly two Google-hosted faces, `VT323` and `Share Tech Mono`:
- `VT323` for large numerals and short display values — S.P.E.C.I.A.L. letters and values, PA count, dice pool, net-wear number, dice result label, stepper `−`/`+` glyphs, and screen titles.
- `Share Tech Mono` for everything else — body copy, labels, buttons, inputs, tab labels — at `9–15px`, most body text `10–13px`.

Labels and section headers SHALL be uppercase with `letter-spacing: 1–3px`. Section headers SHALL be prefixed with `▸ ` (U+25B8).

#### Scenario: No color outside the token set
- **WHEN** the stylesheet is inspected
- **THEN** every color literal resolves to one of the six tokens above or to `rgba(51,255,102, α)` / `rgba(255,176,46, α)` / a neutral black-alpha used by the CRT overlays and case shadows

#### Scenario: Only the two specified fonts are loaded
- **WHEN** the app's font requests are inspected
- **THEN** exactly `VT323` and `Share Tech Mono` are requested, and no non-monospace face is used

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

When the character is in critical state, the screen SHALL additionally render an amber ring — `border: 1px solid rgba(255,176,46,0.5)` with `box-shadow: inset 0 0 45px rgba(255,176,46,0.3)` — over the whole screen, and the case status bar's dot and label SHALL swap from green to amber.

The ring SHALL be a non-interactive overlay (`pointer-events: none`) matching the screen's `14px` radius, layered above the other CRT overlays, rather than a change to the screen's own border — so entering critical state never shifts the layout beneath it.

This ring is distinct from, and shown together with, the `⚠ STATO CRITICO — NON PUOI AGIRE` banner specified by `pipboy-character-sheet`.

#### Scenario: Critical state applies the amber ring
- **GIVEN** a character whose `criticalState` is `true`
- **WHEN** the sheet renders
- **THEN** the screen carries the amber border and inset amber glow, and the status-bar dot and label render amber

#### Scenario: Leaving critical state removes the ring
- **GIVEN** a character in critical state
- **WHEN** the owner removes conditions so that net wear falls below `4`
- **THEN** the amber ring and the amber status dot are removed and the green treatment returns

### Requirement: Case and bezel chrome

The page SHALL centre a fixed-aspect portrait terminal case:

- **Case** (outer bezel): `border-radius: 26px`, `1px solid #333829`, padding ~`16px 14px 12px`, with `inset 0 2px 3px rgba(120,140,90,0.25), inset 0 -6px 14px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.8)`.
- **Status bar** (inside the case, above the screen): a status dot and label on the left, the sheet-only `[◄ DOSSIER][ESCI]` nav per `pipboy-app-shell`, and an OS label.
- **Screen**: `border-radius: 14px`, `2px solid #05170c`, `overflow: hidden`.
- **Bottom bezel** (below the screen): two circular 22px knobs (radial-gradient `#3a4030`→`#14170f`, border `#444a37`), a ridged speaker grille built from repeating-linear-gradient stripes 6px tall with `border-radius: 3px`, and a small pill/slider nub of `34×12px`, rounded.

The bottom bezel SHALL be rendered on every screen, and SHALL live **inside** the constraints of `pipboy-responsive-shell`: it must not cause page-level scroll, and `.pb-case`'s rendered bounding box must remain a function of viewport size and orientation only, never of which screen is mounted.

#### Scenario: Bottom bezel is rendered
- **WHEN** any screen is mounted
- **THEN** the case renders two knobs, a ridged speaker grille, and a slider nub beneath the screen

#### Scenario: Bezel does not break the responsive shell contract
- **GIVEN** a fixed viewport size and orientation
- **WHEN** the user proceeds from `login` → dossier → `create` → `sheet`
- **THEN** `.pb-case`'s rendered width and height are identical on every screen, and no page-level scrollbar appears

### Requirement: Control vocabulary

Buttons and inputs SHALL be flat and wireframe: transparent background, `1px solid rgba(51,255,102,0.4)` border, glowing text, and **no border-radius**. Dashed borders (`1px dashed rgba(51,255,102,0.45–0.5)`) SHALL mark "add" and optional actions, such as `+ ABILITÀ`, `+ core`, and `+ extra`.

**No element in the design SHALL carry a non-zero `border-radius`** other than the case (`26px`), the screen (`14px`), the bezel knobs, the grille (`3px`), the slider nub, the status-bar LED (`50%` — a round indicator, per the reference), and the critical-state ring (`14px`, matching the screen it overlays). In particular there SHALL be no rounded pill buttons.

Iconography SHALL be glyphs only — `◄ ✎ ✕ ⚠ ◉ ▸ − +` — and the app SHALL contain **no emoji** and no colored icon set.

The following are explicit anti-patterns and SHALL NOT be introduced: rounded pill buttons, drop-shadowed "cards", any gradient besides the case gradient and the page background, and any non-monospace font.

#### Scenario: Controls are square-cornered
- **WHEN** any button or input is rendered
- **THEN** its computed `border-radius` is `0`

#### Scenario: Only the named elements are rounded
- **WHEN** every element's computed `border-radius` is inspected
- **THEN** the only non-zero values belong to the case, the screen, the bezel knobs, the grille, the slider nub, the status-bar LED, and the critical-state ring

#### Scenario: Add actions use dashed borders
- **WHEN** an `+ AGGIUNGI …` action renders in editor mode
- **THEN** its border style is dashed

#### Scenario: No emoji anywhere
- **WHEN** the app's rendered text is inspected across every screen
- **THEN** no emoji character is present, and iconography is drawn only from the glyph set

### Requirement: Italian in-universe copy

All UI copy SHALL be Italian, written in an in-universe terminal voice rather than a literal translation, and SHALL reproduce the reference's literal strings exactly where the design specifies them — including `▸ APPROCCI · TOCCA PER TIRARE`, `⚠ STATO CRITICO — NON PUOI AGIRE`, `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti`, `NESSUN DOSSIER REGISTRATO`, and the dice legend.

The login screen SHALL follow the reference layout — a `VT323` `M.A.G.N.U.S.` wordmark, the subtitle `ROBCO · TERMINALE DI CAMPO · OS v2.3`, a hairline divider, the flavor lines `> AUTENTICAZIONE RICHIESTA` and `> INSERIRE CREDENZIALI RANGER`, labelled `ID UTENTE` and `CODICE DI ACCESSO` fields, an amber `⚠`-prefixed inline error, and a `▸ ACCEDI` primary call to action. Pressing Enter in either field SHALL submit.

The reference's footnote stating that a first login auto-registers an id locally SHALL **not** be reproduced: `pipboy-app-shell` specifies real-user JWT login, and no local auto-registration exists.

#### Scenario: Login renders the reference copy
- **WHEN** the login screen renders
- **THEN** it shows the `M.A.G.N.U.S.` wordmark, the `ROBCO · TERMINALE DI CAMPO · OS v2.3` subtitle, both flavor lines, the `ID UTENTE` and `CODICE DI ACCESSO` labels, and a `▸ ACCEDI` control

#### Scenario: Login errors render amber with a warning glyph
- **WHEN** authentication fails
- **THEN** an amber, `⚠`-prefixed inline error appears above the `▸ ACCEDI` control

#### Scenario: Enter submits from either field
- **WHEN** the user presses Enter in the `ID UTENTE` or `CODICE DI ACCESSO` field
- **THEN** the same handler runs as activating `▸ ACCEDI`

#### Scenario: No local auto-registration footnote
- **WHEN** the login screen renders
- **THEN** no copy claims that a first login registers a new id
