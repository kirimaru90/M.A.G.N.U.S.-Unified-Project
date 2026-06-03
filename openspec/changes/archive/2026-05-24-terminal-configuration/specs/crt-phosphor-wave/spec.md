## MODIFIED Requirements

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

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Live controls panel
**Reason:** The admin-only slider panel toggled with the `p` key is replaced by the
Wave Tuner preview screen defined in the `terminal-configuration` capability.
**Migration:** Wave parameters are now adjusted in the Wave Tuner (opened from the
Options screen), which provides the same seven sliders plus a flicker-frequency
control over a live example node, and applies changes through `applyConfig`.
