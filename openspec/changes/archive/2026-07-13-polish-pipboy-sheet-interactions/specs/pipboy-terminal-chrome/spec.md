## ADDED Requirements

### Requirement: Editor-mode case LED

The case bezel SHALL host, adjacent to the bottom-right `✎` editor toggle, a small round "LED" indicator that signals editor mode. The LED SHALL be **green** — using the phosphor-green token with a matching glow — and SHALL light only while editor mode is active, sitting dark/unlit otherwise. It SHALL mirror the same on/off state as the `✎` toggle's active state and the green editor-mode ring.

The LED SHALL use green (never amber): amber remains reserved for the critical state (the critical ring and the amber status dot/label). The editor LED and the amber critical treatment therefore never share a color, so an active editor LED is never mistakable for a critical signal, and both may be shown at once without conflict.

The LED SHALL be a non-interactive indicator (it issues no action; the adjacent `✎` toggle owns activation).

#### Scenario: LED lights green while editor mode is on
- **GIVEN** a character sheet open for its owner
- **WHEN** editor mode is turned on
- **THEN** the bezel LED lights green (glowing) alongside the active `✎` toggle, and it goes dark when editor mode is turned off

#### Scenario: Editor LED stays green even while critical
- **GIVEN** a character in critical state with editor mode on
- **WHEN** the sheet renders
- **THEN** the bezel editor LED is green while the critical ring and status dot are amber — the two indicators do not share a color

## MODIFIED Requirements

### Requirement: Case and bezel chrome

The page SHALL centre a fixed-aspect portrait terminal case:

- **Case** (outer bezel): `border-radius: 26px`, `1px solid #333829`, padding ~`16px 14px 12px`, with `inset 0 2px 3px rgba(120,140,90,0.25), inset 0 -6px 14px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.8)`.
- **Status bar** (inside the case, above the screen): a status dot and label on the left, the sheet-only `[◄ DOSSIER][ESCI]` nav per `pipboy-app-shell`, and an OS label. The `✎` editor toggle no longer lives in the status bar (it moves to the bottom bezel, below).
- **Screen**: `border-radius: 14px`, `2px solid #05170c`, `overflow: hidden`.
- **Bottom bezel** (below the screen): two circular 22px knobs (radial-gradient `#3a4030`→`#14170f`, border `#444a37`), a ridged speaker grille built from repeating-linear-gradient stripes 6px tall with `border-radius: 3px`, and a small pill/slider nub of `34×12px`, rounded. On the sheet screen, for a user who may write the character, the bottom-right of the bezel SHALL additionally host the `✎` editor toggle and its green editor-mode LED (per `Editor-mode case LED`); on every other screen these are absent.

The bottom bezel SHALL be rendered on every screen, and SHALL live **inside** the constraints of `pipboy-responsive-shell`: it must not cause page-level scroll, and `.pb-case`'s rendered bounding box must remain a function of viewport size and orientation only, never of which screen is mounted. The presence of the `✎` toggle/LED in the bezel on the sheet screen SHALL NOT change the bezel's rendered height (it occupies the existing bezel band rather than adding a new row).

#### Scenario: Bottom bezel is rendered
- **WHEN** any screen is mounted
- **THEN** the case renders two knobs, a ridged speaker grille, and a slider nub beneath the screen

#### Scenario: Editor toggle and LED live in the bezel on the sheet
- **WHEN** the owning player (or an admin) opens a character sheet
- **THEN** the `✎` toggle and its editor LED are rendered in the bottom-right of the bezel, and the status bar contains no `✎` toggle

#### Scenario: Bezel does not break the responsive shell contract
- **GIVEN** a fixed viewport size and orientation
- **WHEN** the user proceeds from `login` → dossier → `create` → `sheet`
- **THEN** `.pb-case`'s rendered width and height are identical on every screen, and no page-level scrollbar appears

### Requirement: Control vocabulary

Buttons and inputs SHALL be flat and wireframe: transparent background, `1px solid rgba(51,255,102,0.4)` border, glowing text, and **no border-radius**. Dashed borders (`1px dashed rgba(51,255,102,0.45–0.5)`) SHALL mark "add" and optional actions, such as `+ ABILITÀ`, `+ core`, and `+ extra`.

Native `<select>` controls and their option lists SHALL render on the phosphor theme — the option popup background SHALL use the dark screen background token and its text the phosphor green, not the browser-default light popup — to the extent the platform permits styling native option lists.

**No element in the design SHALL carry a non-zero `border-radius`** other than the case (`26px`), the screen (`14px`), the bezel knobs, the grille (`3px`), the slider nub, the status-bar LED (`50%` — a round indicator, per the reference), the editor-mode case LED (`50%` — a round indicator matching the status-bar LED), the critical-state ring (`14px`, matching the screen it overlays), and the editor-mode ring (`14px`, matching the screen it overlays). In particular there SHALL be no rounded pill buttons.

Iconography SHALL be glyphs only — `◄ ✎ ✕ ⚠ ◉ ▸ − +` — and the app SHALL contain **no emoji** and no colored icon set.

The following are explicit anti-patterns and SHALL NOT be introduced: rounded pill buttons, drop-shadowed "cards", any gradient besides the case gradient and the page background, and any non-monospace font.

#### Scenario: Controls are square-cornered
- **WHEN** any button or input is rendered
- **THEN** its computed `border-radius` is `0`

#### Scenario: Select option lists render on-theme
- **WHEN** a `<select>`'s option list is styled
- **THEN** its option background uses the dark screen token and its text uses phosphor green, not the browser-default white popup

#### Scenario: Only the named elements are rounded
- **WHEN** every element's computed `border-radius` is inspected
- **THEN** the only non-zero values belong to the case, the screen, the bezel knobs, the grille, the slider nub, the status-bar LED, the editor-mode case LED, the critical-state ring, and the editor-mode ring

#### Scenario: Add actions use dashed borders
- **WHEN** an `+ AGGIUNGI …` action renders in editor mode
- **THEN** its border style is dashed

#### Scenario: No emoji anywhere
- **WHEN** the app's rendered text is inspected across every screen
- **THEN** no emoji character is present, and iconography is drawn only from the glyph set
