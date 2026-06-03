## MODIFIED Requirements

### Requirement: Subtle continuous CRT flicker
The application SHALL render a subtle animated flicker effect simulating CRT
brightness instability via a low-opacity animated overlay. The flicker cycle period
SHALL be driven by the `--crt-flicker-period` CSS custom property, set from
`flickerPeriodSec` in the active configuration. When `flickerPeriodSec` is `0`, the
flicker animation SHALL be disabled entirely (`animation: none`). The flicker SHALL
remain subtle enough not to impair reading text or interacting with controls and
SHALL NOT produce high-contrast full-screen flashing in the photosensitivity danger
range. The flicker overlay SHALL set `pointer-events: none`.

#### Scenario: Flicker period follows configuration
- **WHEN** `flickerPeriodSec` is a positive number and `prefers-reduced-motion` is not `reduce`
- **THEN** `.crt::after` SHALL animate with a cycle duration equal to `--crt-flicker-period`

#### Scenario: Zero period disables flicker
- **WHEN** `flickerPeriodSec` is `0`
- **THEN** `.crt::after` SHALL have `animation: none` and produce no flicker

#### Scenario: Flicker does not block interaction or reading
- **WHEN** the flicker animation is active
- **THEN** text SHALL remain legible and all controls SHALL remain interactable

## ADDED Requirements

### Requirement: Static scanlines independently toggleable
The static scanline + subpixel mask SHALL be toggleable via `scanlinesEnabled` in the
active configuration, independently of the phosphor wave and of the flicker. When
`scanlinesEnabled` is `false`, the static `.crt::before` scanline overlay SHALL not be
rendered; all other effects SHALL be unaffected.

#### Scenario: Scanlines off
- **WHEN** `scanlinesEnabled` is `false`
- **THEN** the static scanline + subpixel overlay SHALL NOT be visible
- **THEN** the wave animation and flicker SHALL be unaffected by this setting

#### Scenario: Scanlines on
- **WHEN** `scanlinesEnabled` is `true`
- **THEN** the static scanline + subpixel overlay SHALL be visible above all screens as before
