# pipboy-responsive-shell Specification

## Purpose

The `apps/pip-boy` shell SHALL fill the available viewport in every supported orientation, confine scrolling to the terminal's own content pane, and size `.pb-case` based only on viewport size and orientation rather than on which screen is mounted.

## Requirements

### Requirement: Responsive fullscreen shell
`apps/pip-boy` SHALL fill the available viewport in every supported orientation (mobile portrait,
mobile landscape, and desktop/wide landscape), SHALL confine all scrolling to the terminal's own
content pane (`.pb-screen-content`) rather than the page, and SHALL render `.pb-case` at a size that
depends only on viewport size and orientation — never on which screen (`login` / `campaign-select` /
`character-select` / `sheet`) is mounted.

`.pb-case` SHALL grow to fill the available viewport width and height, in both portrait and
landscape, minus a small uniform margin so the case is never flat against the viewport edge. There
SHALL be no fixed pixel `max-width` or `max-height` cap that leaves the case floating in dead space
on a large viewport (in particular, neither the former `460px` portrait cap nor the `900px` landscape
cap). The small margin MAY be expressed as page padding around the case.

#### Scenario: Mobile portrait fills the viewport
- **WHEN** the app loads on a mobile-sized viewport in portrait orientation
- **THEN** `.pb-case` occupies the full available viewport height and width (within its small designed
  margin), with no dead gap left by stale `vh` sizing and no page-level scrollbar

#### Scenario: Mobile or desktop landscape fills the viewport
- **WHEN** the viewport is in landscape orientation (device rotation or a wide desktop window)
- **THEN** `.pb-case` widens to fill the available landscape viewport minus the small margin, rather
  than remaining fixed at a portrait `max-width` or a `900px` landscape cap

#### Scenario: Desktop wide viewport has no dead margin
- **GIVEN** a wide desktop window well beyond `900px`
- **WHEN** the app renders
- **THEN** `.pb-case` fills the viewport minus the small uniform margin, with no large empty band on
  either side

#### Scenario: Scrolling stays inside the terminal screen
- **WHEN** any screen's content is taller than `.pb-screen-content`'s visible area
- **THEN** only `.pb-screen-content` scrolls; `html`/`body` never produce a page-level scrollbar

#### Scenario: Case size is constant across screens
- **GIVEN** a fixed viewport size and orientation
- **WHEN** the user proceeds from `login` → `campaign-select` → `character-select` → `sheet`
- **THEN** `.pb-case`'s rendered width and height are identical on every one of those screens

#### Scenario: Landscape width regression guard
- **WHEN** `.pb-case`'s rendered width in a landscape viewport is measured
- **THEN** it is meaningfully greater than the fixed `460px` portrait cap, confirming the
  orientation-aware sizing rule is in effect rather than the old fixed-width rule
