## MODIFIED Requirements

### Requirement: Case and bezel chrome

The page SHALL centre a fixed-aspect portrait terminal case:

- **Case** (outer bezel): `border-radius: 26px`, `1px solid #333829`, padding ~`16px 14px 12px`, with `inset 0 2px 3px rgba(120,140,90,0.25), inset 0 -6px 14px rgba(0,0,0,0.7), 0 24px 60px rgba(0,0,0,0.8)`.
- **Status bar** (inside the case, above the screen): a status dot and label on the left, two permanent nub controls centred between the left and right groups — a **back nub** and an **exit nub**, styled identically to the bottom bezel's slider nub (see below) and present on every screen per `pipboy-app-shell` — and an OS label on the right. Neither the `⚙` settings control nor the `✎` editor toggle lives in the status bar — both live in the bottom bezel, below.
- **Screen**: `border-radius: 14px`, `2px solid #05170c`, `overflow: hidden`.
- **Bottom bezel** (below the screen): two circular knobs (radial-gradient `#3a4030`→`#14170f`, border `#444a37`), a ridged speaker grille built from repeating-linear-gradient stripes 6px tall with `border-radius: 3px`, and a pill/slider nub, rounded. The **left knob** is the `⚙` settings control (per `pipboy-settings`) and the **right knob** stays purely decorative and non-interactive, unchanged. The **nub** is the `✎` editor toggle: it grows from the reference `34×12px` sizing enough to hold a fully-contained glyph and a workable tap target, but SHALL NOT exceed the knob's own height, so the bezel's overall rendered height is unaffected. The nub is present on every screen; on screens other than the sheet, or for a sheet viewer without write permission, it renders its glyph but does not respond to activation.

The status bar's back and exit nubs SHALL share the bottom bezel nub's fixed sizing and visual body (background gradient, border, border-radius) regardless of whether either currently renders a glyph — the same physical control repeated three times across the case (back, exit, editor toggle), never resized by its own content.

The exit nub renders `✕`, and its glyph SHALL always render in the critical-red token (`var(--critical)`, with `var(--critical-glow)`) whenever the nub is enabled — marking logout as the case's one permanently-destructive one-shot action. This is independent of the character's own critical state: the exit nub reads critical-red on every screen where it is functional, not only while a character is critical. The back nub keeps the active phosphor theme color for its `◄` glyph, unchanged. Both nubs' body, border, and background stay the shared `.pb-nub` styling — only the exit nub's glyph color departs from it.

The bottom bezel SHALL be rendered on every screen, and SHALL live **inside** the constraints of `pipboy-responsive-shell`: it must not cause page-level scroll, and `.pb-case`'s rendered bounding box must remain a function of viewport size and orientation only, never of which screen is mounted. Growing the nub to hold the `✎` glyph SHALL NOT change the bezel's rendered height, since the knob (unchanged at its current height) already governs it.

#### Scenario: Bottom bezel is rendered

- **WHEN** any screen is mounted
- **THEN** the case renders two knobs, a ridged speaker grille, and a slider nub beneath the screen

#### Scenario: Config knob and editor nub are the only interactive bezel controls

- **WHEN** any screen is mounted
- **THEN** the left knob and the nub are focusable, activatable controls, the right knob remains a non-interactive decorative element, and the status bar contains neither a `⚙` nor a `✎` control

#### Scenario: Status bar carries the two permanent nub controls at fixed size

- **WHEN** any screen is mounted
- **THEN** the status bar renders a back nub and an exit nub, each at the same fixed size as the bottom bezel's slider nub, whether or not either currently shows a glyph

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

**No element in the design SHALL carry a non-zero `border-radius`** other than the case (`26px`), the screen (`14px`), the bezel knobs (including the interactive config knob), the grille (`3px`), the case's nub controls — the bottom bezel's editor toggle and the status bar's back and exit nubs, all sharing the same rounding (including the interactive config knob), the status-bar LED (`50%` — a round indicator, per the reference), the critical-state ring (`14px`, matching the screen it overlays), and the editor-mode ring (`14px`, matching the screen it overlays). In particular there SHALL be no rounded pill buttons and no separate round "LED" element — a control's lit state is carried by the control's own body (see `Bezel control lit state`).

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
- **THEN** the only non-zero values belong to the case, the screen, the bezel knobs, the grille, the case's three nub controls (editor toggle, back, exit), the status-bar LED, the critical-state ring, and the editor-mode ring — no standalone LED element exists

#### Scenario: Add actions use dashed borders

- **WHEN** an `+ AGGIUNGI …` action renders in editor mode
- **THEN** its border style is dashed

#### Scenario: No emoji anywhere

- **WHEN** the app's rendered text is inspected across every screen
- **THEN** no emoji character is present, and iconography is drawn only from the glyph set

### Requirement: Bezel control lit state

The bezel's two interactive **lit** controls — the config knob and the editor nub — SHALL each carry their own "lit" state directly on their own element; neither is paired with a separate indicator element. This lit-state treatment (idle dim glyph / lit solid fill with ink-swapped glyph) is exclusive to these two controls: the status bar's back and exit nubs SHALL NEVER receive a lit ("on") class or the solid-fill treatment described below, regardless of activation — see `pipboy-app-shell`'s navigation requirement for why (they are one-shot navigation actions, not persistent mode indicators).

Idle (unlit), a control SHALL render its glyph (`⚙` or `✎`) dim in the active phosphor theme color on the control's normal dark body, fully contained within the control's bounds. Lit, the control's body SHALL fill solid with the active phosphor theme color (matching the intensity the former standalone LED used) with a matching glow, and its glyph SHALL switch to the dark screen-background ink color (`--screen-bg`) so it remains legible against its own bright fill — never phosphor-on-phosphor.

The lit color SHALL always be the active phosphor theme color, never critical-red: critical-red remains reserved for the critical state (the critical ring and the critical status dot/label) among the config knob and editor nub's *lit* treatment specifically, so a lit bezel control is never mistakable for a critical signal, and both may be shown at once without conflict, regardless of which phosphor theme is active. This reservation does not extend to the exit nub's glyph color (above) — the exit nub has no lit state at all (per the scenario below) and its permanent critical-red glyph marks a destructive *action*, not the character's critical *state*; the two remain visually distinguishable because the critical ring/dot/label activate only during critical state while the exit nub's color is constant.

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

#### Scenario: The status-bar nubs never light up

- **GIVEN** either the back nub or the exit nub is enabled
- **WHEN** it is activated, on any screen
- **THEN** it never gains a lit/"on" class or the solid-fill treatment, unlike the config knob and editor nub

#### Scenario: The exit nub's glyph is always critical-red when enabled

- **GIVEN** the exit nub is enabled, and the character (if any is open) is NOT in critical state
- **WHEN** the status bar renders
- **THEN** the exit nub's glyph (`✕`) renders in the critical-red token, the same as it would during critical state, and the back nub's `◄` renders in the active phosphor theme color, unaffected

#### Scenario: The exit nub's critical-red color is unrelated to the lit-state mechanism
- **GIVEN** the exit nub is enabled and rendering critical-red
- **WHEN** the nub is activated
- **THEN** it does not gain a lit/"on" class or solid-fill treatment — its color is a constant idle-state property, not a triggered lit state
