# emulator-crt-phosphor-wave Specification

## Purpose

Injected non-interactive CRT overlays and a config-driven per-row Gaussian phosphor brightness/glow wave engine with calmed flicker, runtime enable/disable with style reset, reduced-motion honoring, and vignette init.

## Requirements

### Requirement: Phosphor wave overlay injection
The system SHALL inject three absolutely-positioned overlay `div` elements — `.crt-scanlines`, `.crt-vignette`, `.crt-flicker` — as direct children of the terminal container via JavaScript. All overlays SHALL have `pointer-events: none`. The existing CSS `::before` / `::after` pseudo-element scanlines MAY remain for non-terminal screens; the injected overlays take precedence inside the terminal container.

#### Scenario: Overlays present after terminal mount
- **WHEN** the terminal module is mounted
- **THEN** `#terminal-container` SHALL contain a `.crt-scanlines` div, a `.crt-vignette` div, and a `.crt-flicker` div as children

#### Scenario: Overlays do not intercept pointer events
- **WHEN** a user clicks or taps anywhere inside the terminal container
- **THEN** the click SHALL reach the underlying interactive element (button, input) without obstruction from any overlay div

### Requirement: Reduced flicker frequency
The global CRT flicker animation on `.crt::after` SHALL have a cycle period of at least 8 seconds. The visible flash portion of the cycle SHALL occupy no more than 5% of the total period, so the effect reads as an occasional glitch rather than a continuous strobe.

#### Scenario: Flicker duration is calmed
- **WHEN** the page loads and `.crt::after` animation is active
- **THEN** a visible opacity change on `.crt::after` SHALL occur no more than once every 8 seconds on average

#### Scenario: Reduced-motion preference honored
- **WHEN** the OS reports `prefers-reduced-motion: reduce`
- **THEN** `.crt::after` animation SHALL be disabled entirely

### Requirement: Per-row phosphor brightness wave
The system SHALL animate each `.crt-line` row element's `opacity`, CSS `filter: brightness()`, and `text-shadow` on every animation frame using the Gaussian wave algorithm described in `reference/crt-wave-effect.md`. The wave position SHALL advance over time at a configurable speed.

#### Scenario: Wave brightens rows near peak
- **WHEN** the wave engine is running and a row is within the wave's influence radius
- **THEN** that row's `filter: brightness()` SHALL be between `brightnessMin` and `brightnessMax`, interpolated by the Gaussian function

#### Scenario: Wave dims rows away from peak
- **WHEN** a row is far from any wave peak (Gaussian value near 0)
- **THEN** that row's `filter: brightness()` SHALL be at or near `brightnessMin` and its `opacity` SHALL be at or near `0.42`

#### Scenario: Glow applied to bright rows
- **WHEN** a row's Gaussian contribution exceeds `0.4`
- **THEN** that row SHALL have a non-`none` `text-shadow` with the phosphor color RGB triplet

#### Scenario: Wave engine cleans up on destroy
- **WHEN** the `destroy()` function returned by `mountCrtWave()` is called
- **THEN** the `requestAnimationFrame` loop SHALL be cancelled and no further style mutations SHALL occur on row elements

### Requirement: Wave parameter defaults
The wave engine SHALL initialize from `DEFAULT_CONFIG.crtWave` with the following
default values when no overrides are provided: `brightnessMin = 0.80`,
`brightnessMax = 1.40`, `widthMin = 0.5`, `widthMax = 2.5`, `count = 7`,
`speed = 0.6`, `vignetteStrength = 1.0`. These defaults SHALL NOT be duplicated as
literals inside `crt-wave.js`; they SHALL come from `DEFAULT_CONFIG`.

#### Scenario: Default params applied on first mount
- **WHEN** `mountCrtWave(container)` is called with no override params
- **THEN** the wave engine SHALL use `brightnessMin 0.80`, `brightnessMax 1.40`, `widthMin 0.5`, `widthMax 2.5`, `count 7`, `speed 0.6`, `vignetteStrength 1.00`

#### Scenario: Defaults sourced from config
- **WHEN** `DEFAULT_CONFIG.crtWave` is changed
- **THEN** the wave engine's defaults SHALL change accordingly with no other edits

### Requirement: Runtime-toggleable wave with style reset
The wave engine SHALL support being enabled and disabled at runtime via `enable()`
and `disable()` returned from `mountCrtWave`. `disable()` SHALL cancel the
`requestAnimationFrame` loop AND SHALL remove the inline `opacity`, `filter`, and
`text-shadow` properties the engine set on every row, returning rows to their CSS
baseline; it SHALL also hide or remove the vignette overlay. When
`crtEffectsEnabled` is `false` at mount time, the loop SHALL NOT start and no inline
row styles SHALL be written.

#### Scenario: Disable resets rows to baseline
- **WHEN** the wave is running and `disable()` is called
- **THEN** the rAF loop SHALL be cancelled
- **THEN** every row's inline `opacity`, `filter`, and `text-shadow` set by the engine SHALL be cleared
- **THEN** rows SHALL render at their CSS-defined appearance (no frozen brightness)

#### Scenario: Re-enable resumes the wave
- **WHEN** `enable()` is called after `disable()`
- **THEN** the rAF loop SHALL restart and rows SHALL animate again

#### Scenario: Disabled at mount writes nothing
- **WHEN** `crtEffectsEnabled` is `false` when the wave is mounted
- **THEN** the rAF loop SHALL NOT start
- **THEN** no inline `opacity` / `filter` / `text-shadow` SHALL be written to any row

### Requirement: Wave honors reduced-motion when configured
The wave SHALL be forced off when `respectReducedMotion` is `true` and the user agent
reports `prefers-reduced-motion: reduce`, regardless of `crtEffectsEnabled`, and the
engine SHALL expose this forced-off state so the Options screen can reflect it
honestly. When `respectReducedMotion` is `false`, the wave SHALL follow
`crtEffectsEnabled` only.

#### Scenario: Reduced-motion forces the wave off
- **WHEN** `respectReducedMotion` is `true` and the OS reports reduced-motion
- **THEN** the wave SHALL be disabled (rows at baseline) even if `crtEffectsEnabled` is `true`

#### Scenario: Reduced-motion ignored when opted out
- **WHEN** `respectReducedMotion` is `false`
- **THEN** the wave SHALL run or not run based solely on `crtEffectsEnabled`

### Requirement: Vignette overlay initialization
The `.crt-vignette` overlay SHALL be initialized with `vignetteStrength = 1.0` immediately after injection, before the first animation frame.

#### Scenario: Vignette visible on mount
- **WHEN** the wave module initializes
- **THEN** `.crt-vignette` SHALL have a radial-gradient background with `rgba(0,0,0,1.00)` at the edges before the first frame renders
