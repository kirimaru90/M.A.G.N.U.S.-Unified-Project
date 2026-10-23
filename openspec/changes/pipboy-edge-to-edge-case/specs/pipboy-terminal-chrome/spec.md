## MODIFIED Requirements

### Requirement: Case and bezel chrome

The page SHALL centre a fixed-aspect portrait terminal case:

- **Case** (outer bezel): `border-radius: 26px`, `1px solid #333829`, padding ~`16px 14px 12px`, with `inset 0 2px 3px rgba(120,140,90,0.25), inset 0 -6px 14px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.8)`. When the app is installed (fullscreen/standalone), the outer `border-radius` SHALL be `0` and the outer drop shadow (`0 24px 60px …`) SHALL be dropped, while the inset shadows stay; the case's padding absorbs the safe-area insets per `pipboy-responsive-shell`.
- **Status bar** (inside the case, above the screen): a status dot and label on the left, and an OS label on the right. The status bar SHALL contain **no controls**: its centre stays empty so a centred camera cutout never covers anything interactive. When the device reports a top safe-area inset, the status bar's height SHALL equal that inset and the case SHALL add no padding above it, so the status text sits vertically centred in the band beside the camera. With no top inset, the status bar keeps its normal top spacing (the case's `16px` top padding). Neither the `⚙` settings control nor the `✎` editor toggle lives in the status bar — both live in the bottom bezel, below.
- **Screen**: `border-radius: 14px`, `2px solid #05170c`, `overflow: hidden`.
- **Bottom bezel** (below the screen): exactly three elements, left to right: one circular **knob** (radial-gradient `#3a4030`→`#14170f`, border `#444a37`), which is the `⚙` settings control (per `pipboy-settings`); a ridged speaker grille built from repeating-linear-gradient stripes 6px tall with `border-radius: 3px`, which takes all remaining width; and a pill/slider **nub**, rounded, which is the `✎` editor toggle. There SHALL be no decorative, non-interactive knob. The knob SHALL be at least `36px` in diameter (nominally `38px`) and the nub at least `36px` tall (nominally `64×38px`), on every device and input type, with each glyph fully contained within its control. The nub is present on every screen; on screens other than the sheet, or for a sheet viewer without write permission, it renders its glyph but does not respond to activation.

The larger controls SHALL NOT take height from the screen: the vertical band from the screen's bottom edge to the case's bottom edge SHALL stay `56px` (excluding any bottom safe-area inset the case absorbs per `pipboy-responsive-shell`), with the gap between screen and bezel and the bezel's own padding reduced to make room for the taller controls.

The bottom bezel SHALL be rendered on every screen, and SHALL live **inside** the constraints of `pipboy-responsive-shell`: it must not cause page-level scroll, and `.pb-case`'s rendered bounding box must remain a function of viewport size and orientation only, never of which screen is mounted.

#### Scenario: Bottom bezel is rendered

- **WHEN** any screen is mounted
- **THEN** the case renders one knob, a ridged speaker grille, and a slider nub beneath the screen, and no other knob

#### Scenario: Config knob and editor nub are the only bezel controls

- **WHEN** any screen is mounted
- **THEN** the knob and the nub are focusable, activatable controls, the bezel contains no other control or decorative knob, and the status bar contains no control at all

#### Scenario: Status bar holds only the status and OS labels

- **WHEN** any screen is mounted
- **THEN** the status bar contains the status dot and label and the OS label, and contains no button

#### Scenario: Status bar shares the camera band

- **GIVEN** the device reports a top safe-area inset of 40px
- **WHEN** the shell renders in portrait
- **THEN** the status bar's top edge is at the case's top edge, its height is 40px, and its labels are vertically centred within it

#### Scenario: Bezel controls are large tap targets

- **WHEN** any screen is mounted, on any viewport
- **THEN** the knob's rendered width and height and the nub's rendered height are each at least 36px

#### Scenario: Larger controls do not shrink the screen

- **GIVEN** a viewport with no safe-area insets
- **WHEN** the distance from the screen's bottom edge to the case's bottom edge is measured
- **THEN** it is 56px (±1px)

#### Scenario: Installed case drops its outer radius and shadow

- **GIVEN** the app is installed
- **WHEN** `.pb-case`'s computed style is inspected
- **THEN** its `border-radius` is `0` and its box shadow contains only the inset shadows

#### Scenario: Bezel does not break the responsive shell contract

- **GIVEN** a fixed viewport size and orientation
- **WHEN** the user proceeds from `login` → dossier → `create` → `sheet`
- **THEN** `.pb-case`'s rendered width and height are identical on every screen, and no page-level scrollbar appears

### Requirement: Control vocabulary

Buttons and inputs SHALL be flat and wireframe: transparent background, `1px solid rgba(51,255,102,0.4)` border, glowing text, and **no border-radius**. Dashed borders (`1px dashed rgba(51,255,102,0.45–0.5)`) SHALL mark "add" and optional actions, such as `+ ABILITÀ`, `+ core`, and `+ extra`.

Native `<select>` controls and their option lists SHALL render on the phosphor theme — the option popup background SHALL use the dark screen background token and its text the active phosphor theme color, not the browser-default light popup — to the extent the platform permits styling native option lists.

**No element in the design SHALL carry a non-zero `border-radius`** other than the case (`26px` in a browser tab; `0` when installed), the screen (`14px`), the bezel knob (the interactive config knob), the grille (`3px`), the bezel's editor-toggle nub, the status-bar LED (`50%` — a round indicator, per the reference), the critical-state ring (`14px`, matching the screen it overlays), and the editor-mode ring (`14px`, matching the screen it overlays). In particular there SHALL be no rounded pill buttons and no separate round "LED" element — a control's lit state is carried by the control's own body (see `Bezel control lit state`).

Iconography SHALL be glyphs only — `◄ ✎ ⚙ ✕ ⚠ ◉ ▸ − + ⏻` — and the app SHALL contain **no emoji** and no colored icon set.

The following are explicit anti-patterns and SHALL NOT be introduced: rounded pill buttons, drop-shadowed "cards", any gradient besides the case gradient and the page background, and any non-monospace font.

#### Scenario: Controls are square-cornered

- **WHEN** any button or input other than the case chrome is rendered
- **THEN** its computed `border-radius` is `0`

#### Scenario: Select option lists render on-theme

- **WHEN** a `<select>`'s option list is styled
- **THEN** its option background uses the dark screen token and its text uses the active phosphor theme color, not the browser-default white popup

#### Scenario: Only the named elements are rounded

- **WHEN** every element's computed `border-radius` is inspected
- **THEN** the only non-zero values belong to the case (in a browser tab), the screen, the bezel knob, the grille, the bezel's editor-toggle nub, the status-bar LED, the critical-state ring, and the editor-mode ring — no standalone LED element exists

#### Scenario: Add actions use dashed borders

- **WHEN** an `+ AGGIUNGI …` action renders in editor mode
- **THEN** its border style is dashed

#### Scenario: No emoji anywhere

- **WHEN** the app's rendered text is inspected across every screen
- **THEN** no emoji character is present, and iconography is drawn only from the glyph set

### Requirement: Bezel control lit state

The bezel's two interactive controls — the config knob and the editor nub — SHALL each carry their own "lit" state directly on their own element; neither is paired with a separate indicator element.

Idle (unlit), a control SHALL render its glyph (`⚙` or `✎`) dim in the active phosphor theme color on the control's normal dark body, fully contained within the control's bounds. Lit, the control's body SHALL fill solid with the active phosphor theme color (matching the intensity the former standalone LED used) with a matching glow, and its glyph SHALL switch to the dark screen-background ink color (`--screen-bg`) so it remains legible against its own bright fill — never phosphor-on-phosphor.

The lit color SHALL always be the active phosphor theme color, never critical-red: critical-red remains reserved for the critical state (the critical ring and the critical status dot/label) and for destructive actions, so a lit bezel control is never mistakable for a critical signal, and both may be shown at once without conflict, regardless of which phosphor theme is active.

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
