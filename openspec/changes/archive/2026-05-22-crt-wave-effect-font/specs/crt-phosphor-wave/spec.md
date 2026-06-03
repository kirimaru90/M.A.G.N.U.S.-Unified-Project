## ADDED Requirements

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
The wave engine SHALL initialize with the following default parameter values when no overrides are provided: `brightnessMin = 0.20`, `brightnessMax = 0.80`, `widthMin = 0.5`, `widthMax = 2.5`, `count = 5`, `speed = 0.6`, `vignetteStrength = 1.0`.

#### Scenario: Default params applied on first mount
- **WHEN** `mountCrtWave(container)` is called with no second argument
- **THEN** the wave engine SHALL use all seven default parameter values as specified

### Requirement: Live controls panel
The system SHALL render a controls panel outside the terminal container with seven sliders as specified in `reference/crt-wave-effect.md` Step 5. Changing any slider SHALL respawn all wave objects with fresh randomized values within the new parameter range. The vignette slider SHALL update the vignette overlay background directly without respawning waves.

#### Scenario: Slider change respawns waves
- **WHEN** the user moves any slider except the vignette slider
- **THEN** the wave engine SHALL generate new wave objects with randomized properties within the updated parameter bounds within one animation frame

#### Scenario: Vignette slider updates overlay
- **WHEN** the user moves the vignette strength slider
- **THEN** `.crt-vignette` background SHALL update to `radial-gradient(ellipse at center, transparent 48%, rgba(0,0,0,<strength>) 100%)` without respawning wave objects

### Requirement: Vignette overlay initialization
The `.crt-vignette` overlay SHALL be initialized with `vignetteStrength = 1.0` immediately after injection, before the first animation frame.

#### Scenario: Vignette visible on mount
- **WHEN** the wave module initializes
- **THEN** `.crt-vignette` SHALL have a radial-gradient background with `rgba(0,0,0,1.00)` at the edges before the first frame renders
