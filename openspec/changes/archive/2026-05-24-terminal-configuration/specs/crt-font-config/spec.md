## MODIFIED Requirements

### Requirement: Phosphor color CSS custom property
The system SHALL expose `--phosphor-rgb` and `--terminal-green` as CSS custom
properties on `:root`, selected by the `phosphorColor` configuration value. The wave
engine SHALL read `--phosphor-rgb` for `text-shadow` glow color rather than
hardcoding a value. `phosphorColor` SHALL support at least three presets, each
setting both properties together:

| `phosphorColor` | `--terminal-green` | `--phosphor-rgb` |
|---|---|---|
| `green` (default) | `#33ff00` | `51,255,0` |
| `amber` | `#ffb000` | `255,176,0` |
| `white` | `#f0f0f0` | `240,240,240` |

#### Scenario: Phosphor RGB available to wave engine
- **WHEN** the wave engine reads `getComputedStyle(document.documentElement).getPropertyValue('--phosphor-rgb')`
- **THEN** the returned value SHALL be a comma-separated RGB triplet matching the active `phosphorColor` preset

#### Scenario: Switching phosphor preset recolors the terminal
- **WHEN** `phosphorColor` is set to `amber`
- **THEN** `--terminal-green` SHALL become `#ffb000` and `--phosphor-rgb` SHALL become `255,176,0`
- **THEN** terminal text and the wave glow SHALL render in amber

#### Scenario: Default preset is green
- **WHEN** `phosphorColor` is unset or `green`
- **THEN** `--terminal-green` SHALL be `#33ff00` and `--phosphor-rgb` SHALL be `51,255,0` (the existing palette is preserved)
