## ADDED Requirements

### Requirement: Runtime font configuration via APP_CONFIG
The system SHALL read a `useModernFont` boolean from a `APP_CONFIG` object exported by `src/config.js`. When `useModernFont` is `false` (the default), the terminal SHALL use Fixedsys Excelsior as the primary font. When `useModernFont` is `true`, the terminal SHALL use Share Tech Mono as the primary font.

#### Scenario: Default font is Fixedsys Excelsior
- **WHEN** `APP_CONFIG.useModernFont` is `false` or not set
- **THEN** `document.body` SHALL have the class `font-fixedsys` applied
- **AND** the effective `font-family` on `body` SHALL resolve to `'Fixedsys Excelsior'` (or its fallback if the TTF is unavailable)

#### Scenario: Modern font is Share Tech Mono
- **WHEN** `APP_CONFIG.useModernFont` is `true`
- **THEN** `document.body` SHALL have the class `font-sharetech` applied
- **AND** the effective `font-family` on `body` SHALL resolve to `'Share Tech Mono'`

### Requirement: Fixedsys Excelsior self-hosted font
The system SHALL declare a `@font-face` rule in `terminal.css` loading `FixedsysExcelsior.ttf` from the `fonts/` directory. The font SHALL be referenced as `'Fixedsys Excelsior'` in the font stack.

#### Scenario: Font file accessible
- **WHEN** the page loads and `fonts/FixedsysExcelsior.ttf` is present
- **THEN** text rendered with `.font-fixedsys` SHALL use the bitmap-style Fixedsys Excelsior glyphs

#### Scenario: Font file absent — graceful fallback
- **WHEN** `fonts/FixedsysExcelsior.ttf` is not found
- **THEN** the browser SHALL fall back to `'Courier New', monospace` without errors or layout shifts

### Requirement: Share Tech Mono CDN preload
When `useModernFont` is `true`, the system SHALL load Share Tech Mono from Google Fonts. The `<link>` preconnect and stylesheet tags SHALL be present in `index.html` unconditionally so the font is available without JS-injected DOM mutations.

#### Scenario: Share Tech Mono available when useModernFont true
- **WHEN** `APP_CONFIG.useModernFont` is `true`
- **AND** the Google Fonts CDN is reachable
- **THEN** text in `.font-sharetech` SHALL render in Share Tech Mono

#### Scenario: CDN unavailable — graceful fallback
- **WHEN** the Google Fonts CDN is unreachable
- **THEN** text in `.font-sharetech` SHALL fall back to `'Courier New', monospace` without errors

### Requirement: Font utility CSS classes
`terminal.css` SHALL define two utility classes: `.font-fixedsys` sets `font-family: 'Fixedsys Excelsior', 'Courier New', monospace`. `.font-sharetech` sets `font-family: 'Share Tech Mono', 'Courier New', monospace`. Only one of these classes SHALL be applied to `<body>` at a time.

#### Scenario: Font class applied once
- **WHEN** the terminal initializes
- **THEN** `document.body` SHALL have exactly one of `.font-fixedsys` or `.font-sharetech` — never both

### Requirement: Phosphor color CSS custom property
The system SHALL expose `--phosphor-rgb` as a CSS custom property on `:root` set to the RGB triplet of `--terminal-green` (e.g. `77,255,0`). The wave engine SHALL read this property for `text-shadow` glow color rather than hardcoding a value.

#### Scenario: Phosphor RGB available to wave engine
- **WHEN** the wave engine reads `getComputedStyle(document.documentElement).getPropertyValue('--phosphor-rgb')`
- **THEN** the returned value SHALL be a comma-separated RGB triplet matching the active phosphor color
