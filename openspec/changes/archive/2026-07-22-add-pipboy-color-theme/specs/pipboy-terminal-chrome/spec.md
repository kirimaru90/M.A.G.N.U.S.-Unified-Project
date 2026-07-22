## MODIFIED Requirements

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

### Requirement: Editor-mode case LED

The case bezel SHALL host, adjacent to the bottom-right `✎` editor toggle, a small round "LED" indicator that signals editor mode. The LED SHALL use the active phosphor theme's color, with a matching glow, and SHALL light only while editor mode is active, sitting dark/unlit otherwise. It SHALL mirror the same on/off state as the `✎` toggle's active state and the editor-mode ring.

The LED SHALL always render in the phosphor theme color, never in critical-red: critical-red remains reserved for the critical state (the critical ring and the critical status dot/label). The editor LED and the critical-state treatment therefore never share a color regardless of which phosphor theme is active, so an active editor LED is never mistakable for a critical signal, and both may be shown at once without conflict.

The LED SHALL be a non-interactive indicator (it issues no action; the adjacent `✎` toggle owns activation).

#### Scenario: LED lights in the phosphor theme color while editor mode is on
- **GIVEN** a character sheet open for its owner
- **WHEN** editor mode is turned on
- **THEN** the bezel LED lights in the active phosphor theme's color (glowing) alongside the active `✎` toggle, and it goes dark when editor mode is turned off

#### Scenario: Editor LED stays on-theme even while critical
- **GIVEN** a character in critical state with editor mode on
- **WHEN** the sheet renders
- **THEN** the bezel editor LED renders the active phosphor theme's color while the critical ring and status dot are critical-red — the two indicators do not share a color

#### Scenario: Editor LED never renders critical-red
- **WHEN** the phosphor theme is set to amber
- **AND** editor mode is on
- **THEN** the editor LED renders the amber phosphor color, not the critical-red token, remaining visually distinct from a critical-state indicator

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
